import makeWASocket, { DisconnectReason, fetchLatestBaileysVersion, useMultiFileAuthState } from "@whiskeysockets/baileys";
import P from "pino";
import qrcode from "qrcode-terminal";
import { cfg } from "./lib/config.js";
import { log, safeErr } from "./lib/log.js";
import { registerAdminNaturalHandler } from "./features/adminHandlers.js";
import { registerStudentNaturalHandler } from "./features/studentHandlers.js";

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeCommandName(value) {
  return String(value || "").replace(/^\//, "").trim().toLowerCase();
}

function unwrapMessage(rawMessage) {
  const message = rawMessage?.message || {};
  return message.ephemeralMessage?.message ||
    message.viewOnceMessage?.message ||
    message.viewOnceMessageV2?.message ||
    message.documentWithCaptionMessage?.message ||
    message;
}

function extractText(rawMessage) {
  const message = unwrapMessage(rawMessage);
  return String(
    message.conversation ||
    message.extendedTextMessage?.text ||
    message.imageMessage?.caption ||
    message.videoMessage?.caption ||
    ""
  ).trim();
}

function phoneFromJid(jid) {
  return String(jid || "").split("@")[0].replace(/\D/g, "");
}

class WhatsAppBot {
  constructor() {
    this.commands = new Map();
    this.textMiddlewares = [];
    this.processedIds = [];
    this.processedSet = new Set();
    this.started = false;
    this.stopping = false;
    this.sock = null;
    this.reconnectMs = 2000;
  }

  command(name, handler) {
    this.commands.set(normalizeCommandName(name), handler);
  }

  on(eventName, handler) {
    if (eventName === "message:text") {
      this.textMiddlewares.push(handler);
    }
  }

  async start() {
    if (this.started) return;
    this.started = true;
    await this.connect();
  }

  async stop() {
    this.stopping = true;
    if (this.sock) {
      try {
        await this.sock.logout();
      } catch (err) {
        log.warn("whatsapp logout skipped", { error: safeErr(err) });
      }
      this.sock = null;
    }
  }

  rememberProcessed(id) {
    if (!id) return false;
    if (this.processedSet.has(id)) return true;
    this.processedSet.add(id);
    this.processedIds.push(id);
    while (this.processedIds.length > 5000) {
      const old = this.processedIds.shift();
      this.processedSet.delete(old);
    }
    return false;
  }

  async connect() {
    log.info("whatsapp connect start", { authDirSet: Boolean(cfg.WHATSAPP_AUTH_DIR) });
    const { state, saveCreds } = await useMultiFileAuthState(cfg.WHATSAPP_AUTH_DIR);
    const { version } = await fetchLatestBaileysVersion();

    this.sock = makeWASocket({
      version,
      auth: state,
      printQRInTerminal: false,
      browser: ["CookMyBots", "Chrome", "1.0.0"],
      logger: P({ level: "silent" })
    });

    this.sock.ev.on("creds.update", saveCreds);
    this.sock.ev.on("connection.update", async (update) => {
      const { connection, lastDisconnect, qr } = update;
      if (qr) {
        log.info("whatsapp qr received", { scanRequired: true });
        qrcode.generate(qr, { small: true });
      }
      if (connection === "open") {
        this.reconnectMs = 2000;
        log.info("whatsapp connection open", {});
      }
      if (connection === "close") {
        const statusCode = lastDisconnect?.error?.output?.statusCode;
        const loggedOut = statusCode === DisconnectReason.loggedOut;
        log.warn("whatsapp connection closed", { statusCode: statusCode || "unknown", loggedOut });
        this.sock = null;
        if (!this.stopping && !loggedOut) {
          const delay = this.reconnectMs;
          this.reconnectMs = Math.min(this.reconnectMs === 2000 ? 5000 : this.reconnectMs * 2, 20000);
          log.info("whatsapp reconnect scheduled", { delayMs: delay });
          await sleep(delay);
          await this.connect();
        }
      }
    });

    this.sock.ev.on("messages.upsert", async ({ messages, type }) => {
      log.info("whatsapp message cycle", { type, count: messages?.length || 0 });
      for (const message of messages || []) {
        await this.handleMessage(message).catch((err) => {
          log.error("whatsapp message handling failed", { error: safeErr(err) });
        });
      }
    });
  }

  createContext(rawMessage, text, match = "") {
    const remoteJid = rawMessage.key?.remoteJid || "";
    const senderJid = rawMessage.key?.participant || remoteJid;
    const isGroup = remoteJid.endsWith("@g.us");

    return {
      match,
      bot: this,
      message: {
        text,
        raw: rawMessage,
        key: rawMessage.key
      },
      chat: {
        id: remoteJid,
        type: isGroup ? "group" : "private"
      },
      from: {
        id: senderJid,
        phone: phoneFromJid(senderJid)
      },
      reply: async (replyText) => {
        await this.sock.sendMessage(remoteJid, { text: String(replyText || "") }, { quoted: rawMessage });
      },
      sendImage: async ({ buffer, url, caption = "" }) => {
        try {
          if (buffer) {
            await this.sock.sendMessage(remoteJid, { image: buffer, caption }, { quoted: rawMessage });
            return;
          }
          if (url) {
            await this.sock.sendMessage(remoteJid, { image: { url }, caption }, { quoted: rawMessage });
            return;
          }
          throw new Error("No image buffer or URL provided");
        } catch (err) {
          log.warn("whatsapp image send failed, using text fallback", { error: safeErr(err), hasUrl: Boolean(url) });
          if (url) {
            await this.sock.sendMessage(remoteJid, { text: caption ? `${caption}\n${url}` : url }, { quoted: rawMessage });
          } else {
            throw err;
          }
        }
      }
    };
  }

  async runTextMiddlewares(ctx) {
    let index = -1;
    const dispatch = async (i) => {
      if (i <= index) throw new Error("next called multiple times");
      index = i;
      const middleware = this.textMiddlewares[i];
      if (!middleware) return;
      await middleware(ctx, () => dispatch(i + 1));
    };
    await dispatch(0);
  }

  async handleMessage(rawMessage) {
    if (!rawMessage?.message || rawMessage.key?.fromMe) return;
    const messageId = rawMessage.key?.id || "";
    if (this.rememberProcessed(messageId)) return;

    const text = extractText(rawMessage);
    if (!text) return;

    if (text.startsWith("/")) {
      const match = text.match(/^\/(\S+)\s*([\s\S]*)$/);
      const command = normalizeCommandName(match?.[1] || "");
      const args = String(match?.[2] || "").trim();
      const handler = this.commands.get(command);
      if (!handler) {
        const ctx = this.createContext(rawMessage, text, args);
        await ctx.reply("Unknown command. Send /help to see what I can do.");
        return;
      }
      const ctx = this.createContext(rawMessage, text, args);
      log.info("whatsapp command start", { command, chatType: ctx.chat.type });
      try {
        await handler(ctx);
        log.info("whatsapp command success", { command });
      } catch (err) {
        log.error("whatsapp command failed", { command, error: safeErr(err) });
        await ctx.reply("Sorry, I could not complete that command right now.");
      }
      return;
    }

    await this.runTextMiddlewares(this.createContext(rawMessage, text));
  }
}

export function createBot() {
  return new WhatsAppBot();
}

export function registerBotFeatures(bot) {
  registerAdminNaturalHandler(bot);
  registerStudentNaturalHandler(bot);
}

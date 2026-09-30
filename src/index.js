import "dotenv/config";
import { cfg, logEnvSanity } from "./lib/config.js";
import { log, safeErr } from "./lib/log.js";

let botInstance = null;
let stopping = false;

process.on("unhandledRejection", (err) => {
  log.error("unhandled rejection", { error: safeErr(err) });
  process.exit(1);
});

process.on("uncaughtException", (err) => {
  log.error("uncaught exception", { error: safeErr(err) });
  process.exit(1);
});

function logMemory() {
  const m = process.memoryUsage();
  console.log("[mem]", { rssMB: Math.round(m.rss / 1e6), heapUsedMB: Math.round(m.heapUsed / 1e6) });
}

async function stopBot() {
  if (!botInstance) return;
  try {
    await botInstance.stop();
  } catch (err) {
    log.warn("whatsapp stop failed", { error: safeErr(err) });
  } finally {
    botInstance = null;
  }
}

async function boot() {
  try {
    log.info("boot start", { platform: "whatsapp" });
    logEnvSanity();

    const { createBot, registerBotFeatures } = await import("./bot.js");
    const { registerCommands } = await import("./commands/loader.js");

    botInstance = createBot();
    await registerCommands(botInstance);
    registerBotFeatures(botInstance);

    setInterval(logMemory, 60000).unref();

    process.once("SIGTERM", async () => {
      stopping = true;
      await stopBot();
      process.exit(0);
    });
    process.once("SIGINT", async () => {
      stopping = true;
      await stopBot();
      process.exit(0);
    });

    await botInstance.start();
    log.info("whatsapp bot started", { authDirSet: Boolean(cfg.WHATSAPP_AUTH_DIR), stopping });
  } catch (err) {
    log.error("boot failure", { error: safeErr(err), code: err?.code || "" });
    if (err?.code === "ERR_MODULE_NOT_FOUND") {
      console.error("Check that all imported files exist and relative ESM imports include .js extensions.");
    }
    process.exit(1);
  }
}

boot();

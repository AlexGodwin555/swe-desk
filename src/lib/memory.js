import { getDb } from "./db.js";
import { log, safeErr } from "./log.js";

const MEMORY_COLLECTION = "memory_messages";
const inMemoryTurns = [];
const MAX_IN_MEMORY_TURNS = 500;

function pushFallback(doc) {
  inMemoryTurns.push(doc);
  while (inMemoryTurns.length > MAX_IN_MEMORY_TURNS) inMemoryTurns.shift();
}

export async function addTurn({ mongoUri, platform, userId, chatId, role, text }) {
  const doc = {
    platform: String(platform || "whatsapp"),
    userId: String(userId || ""),
    chatId: chatId ? String(chatId) : "",
    role: String(role || "user"),
    text: String(text || "").slice(0, 2000),
    createdAt: new Date(),
    ts: new Date()
  };

  const db = await getDb(mongoUri);
  if (!db) {
    pushFallback(doc);
    return;
  }

  try {
    await db.collection(MEMORY_COLLECTION).insertOne(doc);
  } catch (err) {
    log.error("db write failed", { collection: MEMORY_COLLECTION, operation: "insertOne", error: safeErr(err) });
    pushFallback(doc);
  }
}

export async function getRecentTurns({ mongoUri, platform, userId, chatId, limit = 10 }) {
  const q = {
    platform: String(platform || "whatsapp"),
    userId: String(userId || "")
  };
  if (chatId) q.chatId = String(chatId);

  const db = await getDb(mongoUri);
  if (!db) {
    return inMemoryTurns
      .filter((item) => item.platform === q.platform && item.userId === q.userId && (!q.chatId || item.chatId === q.chatId))
      .slice(-limit)
      .map((item) => ({ role: item.role, text: item.text }));
  }

  try {
    const rows = await db.collection(MEMORY_COLLECTION).find(q).sort({ ts: -1 }).limit(limit).toArray();
    return rows.reverse().map((item) => ({ role: item.role, text: item.text }));
  } catch (err) {
    log.error("db read failed", { collection: MEMORY_COLLECTION, operation: "find", error: safeErr(err) });
    return [];
  }
}

export async function clearUserMemory({ mongoUri, platform, userId, chatId }) {
  const q = {
    platform: String(platform || "whatsapp"),
    userId: String(userId || "")
  };
  if (chatId) q.chatId = String(chatId);

  for (let i = inMemoryTurns.length - 1; i >= 0; i -= 1) {
    const item = inMemoryTurns[i];
    if (item.platform === q.platform && item.userId === q.userId && (!q.chatId || item.chatId === q.chatId)) {
      inMemoryTurns.splice(i, 1);
    }
  }

  const db = await getDb(mongoUri);
  if (!db) return;

  try {
    await db.collection(MEMORY_COLLECTION).deleteMany(q);
  } catch (err) {
    log.error("db write failed", { collection: MEMORY_COLLECTION, operation: "deleteMany", error: safeErr(err) });
  }
}

export async function auditAdminAction({ mongoUri, userId, action, sheet, target, ok, details = {} }) {
  const db = await getDb(mongoUri);
  if (!db) return;

  try {
    await db.collection("admin_audit").insertOne({
      platform: "whatsapp",
      userId: String(userId || ""),
      action: String(action || ""),
      sheet: String(sheet || ""),
      target: String(target || ""),
      ok: Boolean(ok),
      details,
      createdAt: new Date(),
      ts: new Date()
    });
  } catch (err) {
    log.error("db write failed", { collection: "admin_audit", operation: "insertOne", error: safeErr(err) });
  }
}

import { MongoClient } from "mongodb";
import { log, safeErr } from "./log.js";

let client = null;
let db = null;

export async function getDb(mongoUri) {
  if (!mongoUri) return null;
  if (db) return db;

  try {
    client = new MongoClient(mongoUri, { maxPoolSize: 5, ignoreUndefined: true });
    await client.connect();
    db = client.db();
    await db.collection("memory_messages").createIndex({ platform: 1, userId: 1, chatId: 1, ts: -1 });
    await db.collection("admin_audit").createIndex({ ts: -1 });
    log.info("db connected", { collections: ["memory_messages", "admin_audit"] });
    return db;
  } catch (err) {
    log.error("db connect failed", { collection: "memory_messages", operation: "connect", error: safeErr(err) });
    return null;
  }
}

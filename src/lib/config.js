function splitCsv(value) {
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizePhone(value) {
  return String(value || "").replace(/\D/g, "");
}

function numberWithDefault(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

export const cfg = {
  WHATSAPP_AUTH_DIR: process.env.WHATSAPP_AUTH_DIR || ".auth/whatsapp",
  WHATSAPP_ADMIN_NUMBERS: splitCsv(process.env.WHATSAPP_ADMIN_NUMBERS || "").map(normalizePhone).filter(Boolean),
  MONGODB_URI: process.env.MONGODB_URI || "",
  GOOGLE_SHEETS_SPREADSHEET_ID: process.env.GOOGLE_SHEETS_SPREADSHEET_ID || "",
  GOOGLE_SERVICE_ACCOUNT_EMAIL: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || "",
  GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY: String(process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY || "").replace(/\\n/g, "\n"),
  GOOGLE_APPLICATION_CREDENTIALS: process.env.GOOGLE_APPLICATION_CREDENTIALS || "",
  ADMIN_ACCESS_CODE: process.env.ADMIN_ACCESS_CODE || "",
  CACHE_TTL_MS: numberWithDefault(process.env.CACHE_TTL_MS || "30000", 30000)
};

export function logEnvSanity() {
  console.log("[boot] env sanity", {
    WHATSAPP_AUTH_DIR_set: Boolean(cfg.WHATSAPP_AUTH_DIR),
    WHATSAPP_ADMIN_NUMBERS_count: cfg.WHATSAPP_ADMIN_NUMBERS.length,
    MONGODB_URI_set: Boolean(cfg.MONGODB_URI),
    GOOGLE_SHEETS_SPREADSHEET_ID_set: Boolean(cfg.GOOGLE_SHEETS_SPREADSHEET_ID),
    GOOGLE_SERVICE_ACCOUNT_EMAIL_set: Boolean(cfg.GOOGLE_SERVICE_ACCOUNT_EMAIL),
    GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY_set: Boolean(cfg.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY),
    GOOGLE_APPLICATION_CREDENTIALS_set: Boolean(cfg.GOOGLE_APPLICATION_CREDENTIALS),
    ADMIN_ACCESS_CODE_set: Boolean(cfg.ADMIN_ACCESS_CODE)
  });
}

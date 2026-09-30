import { google } from "googleapis";
import { cfg } from "../lib/config.js";
import { log, safeErr } from "../lib/log.js";

export const SHEETS = {
  Announcements: {
    name: "Announcements",
    keyField: "AnnouncementID",
    headers: ["AnnouncementID", "Title", "Category", "Level", "CourseCode", "Message", "DatePosted", "ExpiryDate", "Priority", "Status"]
  },
  Lecturers: {
    name: "Lecturers",
    keyField: "LecturerID",
    headers: ["LecturerID", "FullName", "Title", "DepartmentRole", "OfficeLocation", "PhoneNumber", "Email", "CoursesTaught", "OfficeHours", "Bio", "PhotoURL", "Status"]
  },
  Courses: {
    name: "Courses",
    keyField: "CourseCode",
    headers: ["CourseCode", "CourseTitle", "Level", "Semester", "LecturerName", "Venue", "Schedule", "Description", "Status"]
  },
  Timetable: {
    name: "Timetable",
    keyField: "CourseCode",
    headers: ["Level", "CourseCode", "CourseTitle", "Day", "Time", "Venue", "LecturerName", "Status"]
  },
  DepartmentInfo: {
    name: "DepartmentInfo",
    keyField: "InfoType",
    headers: ["InfoType", "Title", "Details", "ContactPerson", "ContactPhone", "LastUpdated", "Status"]
  }
};

let sheetsClient = null;
let initialized = false;
const cache = new Map();

export function sheetsConfigured() {
  return Boolean(
    cfg.GOOGLE_SHEETS_SPREADSHEET_ID &&
    (cfg.GOOGLE_APPLICATION_CREDENTIALS || (cfg.GOOGLE_SERVICE_ACCOUNT_EMAIL && cfg.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY))
  );
}

function sheetDef(sheetKey) {
  const def = SHEETS[sheetKey];
  if (!def) throw new Error(`Unknown sheet: ${sheetKey}`);
  return def;
}

function columnName(index) {
  let n = index;
  let name = "";
  while (n > 0) {
    const mod = (n - 1) % 26;
    name = String.fromCharCode(65 + mod) + name;
    n = Math.floor((n - mod) / 26);
  }
  return name;
}

async function getClient() {
  if (!sheetsConfigured()) {
    throw new Error("Google Sheets is not configured. Set GOOGLE_SHEETS_SPREADSHEET_ID and service account credentials.");
  }

  if (sheetsClient) return sheetsClient;

  let auth;
  if (cfg.GOOGLE_APPLICATION_CREDENTIALS) {
    auth = new google.auth.GoogleAuth({
      keyFile: cfg.GOOGLE_APPLICATION_CREDENTIALS,
      scopes: ["https://www.googleapis.com/auth/spreadsheets"]
    });
  } else {
    auth = new google.auth.JWT({
      email: cfg.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      key: cfg.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY,
      scopes: ["https://www.googleapis.com/auth/spreadsheets"]
    });
  }

  sheetsClient = google.sheets({ version: "v4", auth });
  return sheetsClient;
}

async function ensureWorkbook() {
  if (initialized) return;
  const client = await getClient();
  const spreadsheetId = cfg.GOOGLE_SHEETS_SPREADSHEET_ID;

  const meta = await client.spreadsheets.get({ spreadsheetId });
  const existing = new Set((meta.data.sheets || []).map((sheet) => sheet.properties?.title).filter(Boolean));
  const requests = [];

  for (const def of Object.values(SHEETS)) {
    if (!existing.has(def.name)) {
      requests.push({ addSheet: { properties: { title: def.name } } });
    }
  }

  if (requests.length) {
    await client.spreadsheets.batchUpdate({ spreadsheetId, requestBody: { requests } });
    log.info("google sheets created missing tabs", { count: requests.length });
  }

  for (const def of Object.values(SHEETS)) {
    const lastCol = columnName(def.headers.length);
    const range = `'${def.name}'!A1:${lastCol}1`;
    const current = await client.spreadsheets.values.get({ spreadsheetId, range }).catch(() => ({ data: { values: [] } }));
    const headerRow = current.data.values?.[0] || [];
    const needsHeader = def.headers.some((header, index) => headerRow[index] !== header);
    if (needsHeader) {
      await client.spreadsheets.values.update({
        spreadsheetId,
        range,
        valueInputOption: "RAW",
        requestBody: { values: [def.headers] }
      });
    }
  }

  initialized = true;
  log.info("google sheets ready", { spreadsheetConfigured: true });
}

function valuesToRows(values, headers) {
  return values.slice(1).map((row, index) => {
    const item = { _rowNumber: index + 2 };
    headers.forEach((header, i) => {
      item[header] = row[i] || "";
    });
    return item;
  });
}

export async function listRows(sheetKey, { force = false } = {}) {
  const def = sheetDef(sheetKey);
  const cached = cache.get(sheetKey);
  if (!force && cached && Date.now() - cached.ts < cfg.CACHE_TTL_MS) return cached.rows;

  try {
    await ensureWorkbook();
    const client = await getClient();
    const lastCol = columnName(def.headers.length);
    const range = `'${def.name}'!A1:${lastCol}`;
    const res = await client.spreadsheets.values.get({ spreadsheetId: cfg.GOOGLE_SHEETS_SPREADSHEET_ID, range });
    const values = res.data.values || [def.headers];
    const rows = valuesToRows(values, def.headers);
    cache.set(sheetKey, { ts: Date.now(), rows });
    log.info("google sheets read", { collection: def.name, operation: "list", count: rows.length });
    return rows;
  } catch (err) {
    log.error("google sheets read failed", { collection: def.name, operation: "list", error: safeErr(err) });
    throw err;
  }
}

export async function appendRow(sheetKey, record) {
  const def = sheetDef(sheetKey);
  try {
    await ensureWorkbook();
    const client = await getClient();
    const values = def.headers.map((header) => record[header] || "");
    await client.spreadsheets.values.append({
      spreadsheetId: cfg.GOOGLE_SHEETS_SPREADSHEET_ID,
      range: `'${def.name}'!A1`,
      valueInputOption: "USER_ENTERED",
      insertDataOption: "INSERT_ROWS",
      requestBody: { values: [values] }
    });
    cache.delete(sheetKey);
    log.info("google sheets write", { collection: def.name, operation: "append" });
  } catch (err) {
    log.error("google sheets write failed", { collection: def.name, operation: "append", error: safeErr(err) });
    throw err;
  }
}

export async function updateRowByField(sheetKey, field, value, patch) {
  const def = sheetDef(sheetKey);
  const rows = await listRows(sheetKey, { force: true });
  const match = rows.find((row) => String(row[field] || "").trim().toLowerCase() === String(value || "").trim().toLowerCase());
  if (!match) return null;

  const updated = { ...match, ...patch };
  delete updated._rowNumber;
  const values = def.headers.map((header) => updated[header] || "");
  const lastCol = columnName(def.headers.length);

  try {
    const client = await getClient();
    await client.spreadsheets.values.update({
      spreadsheetId: cfg.GOOGLE_SHEETS_SPREADSHEET_ID,
      range: `'${def.name}'!A${match._rowNumber}:${lastCol}${match._rowNumber}`,
      valueInputOption: "USER_ENTERED",
      requestBody: { values: [values] }
    });
    cache.delete(sheetKey);
    log.info("google sheets write", { collection: def.name, operation: "update", field });
    return updated;
  } catch (err) {
    log.error("google sheets write failed", { collection: def.name, operation: "update", error: safeErr(err) });
    throw err;
  }
}

export async function softDeleteRow(sheetKey, field, value) {
  return updateRowByField(sheetKey, field, value, { Status: "deleted" });
}

export async function upsertRowByField(sheetKey, field, value, record) {
  const updated = await updateRowByField(sheetKey, field, value, record);
  if (updated) return { mode: "updated", record: updated };
  await appendRow(sheetKey, record);
  return { mode: "created", record };
}

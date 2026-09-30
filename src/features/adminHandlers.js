import { cfg } from "../lib/config.js";
import { log, safeErr } from "../lib/log.js";
import { auditAdminAction } from "../lib/memory.js";
import { appendRow, softDeleteRow, updateRowByField, upsertRowByField } from "../services/googleSheets.js";
import { formatAdminRecord, formatAnnouncementList } from "../services/formatters.js";
import { findAnnouncements, findLecturers } from "../services/departmentRecords.js";

const verifiedAdmins = new Set();
const pendingForms = new Map();

const FORM_DEFS = {
  addannouncement: {
    sheet: "Announcements",
    action: "append",
    keyField: "AnnouncementID",
    fields: ["AnnouncementID", "Title", "Category", "Level", "CourseCode", "Message", "DatePosted", "ExpiryDate", "Priority", "Status"],
    defaults: () => ({ AnnouncementID: `ANN-${Date.now()}`, DatePosted: new Date().toISOString().slice(0, 10), Status: "active" })
  },
  addlecturer: {
    sheet: "Lecturers",
    action: "append",
    keyField: "LecturerID",
    fields: ["LecturerID", "FullName", "Title", "DepartmentRole", "OfficeLocation", "PhoneNumber", "Email", "CoursesTaught", "OfficeHours", "Bio", "PhotoURL", "Status"],
    defaults: () => ({ LecturerID: `LEC-${Date.now()}`, Status: "active" })
  },
  addcourse: {
    sheet: "Courses",
    action: "append",
    keyField: "CourseCode",
    fields: ["CourseCode", "CourseTitle", "Level", "Semester", "LecturerName", "Venue", "Schedule", "Description", "Status"],
    defaults: () => ({ Status: "active" })
  },
  updatetimetable: {
    sheet: "Timetable",
    action: "append",
    keyField: "CourseCode",
    fields: ["Level", "CourseCode", "CourseTitle", "Day", "Time", "Venue", "LecturerName", "Status"],
    defaults: () => ({ Status: "active" })
  },
  departmentinfo: {
    sheet: "DepartmentInfo",
    action: "upsert",
    keyField: "InfoType",
    fields: ["InfoType", "Title", "Details", "ContactPerson", "ContactPhone", "LastUpdated", "Status"],
    defaults: () => ({ LastUpdated: new Date().toISOString().slice(0, 10), Status: "active" })
  }
};

function normalizePhone(value) {
  return String(value || "").replace(/\D/g, "");
}

function userId(ctx) {
  return normalizePhone(ctx.from?.phone || ctx.from?.id || "");
}

function isApprovedId(ctx) {
  const id = userId(ctx);
  return Boolean(id && cfg.WHATSAPP_ADMIN_NUMBERS.includes(id));
}

export function isAdmin(ctx) {
  return isApprovedId(ctx) || verifiedAdmins.has(userId(ctx));
}

function commandArg(ctx) {
  return String(ctx.match || "").trim();
}

function parseKeyValues(text) {
  const result = {};
  const pieces = String(text || "").split(/\n|;/).map((item) => item.trim()).filter(Boolean);
  for (const piece of pieces) {
    const match = piece.match(/^([^:=]+)\s*[:=]\s*([\s\S]*)$/);
    if (match) result[match[1].trim()] = match[2].trim();
  }
  return result;
}

function requireAdminMessage() {
  return "Admin access is required. Use /admin your-access-code first.";
}

async function audit(ctx, action, sheet, target, ok, details = {}) {
  await auditAdminAction({ mongoUri: cfg.MONGODB_URI, userId: userId(ctx), action, sheet, target, ok, details });
}

async function requireAdmin(ctx) {
  if (isAdmin(ctx)) return true;
  await ctx.reply(requireAdminMessage());
  return false;
}

function promptForForm(def, command) {
  return [
    `Send the ${command} details as Field=Value lines.`,
    `Required fields are: ${def.fields.join(", ")}.`,
    "You can send only the fields you know, but key fields should be included.",
    "Example:",
    def.fields.slice(0, 4).map((field) => `${field}=`).join("\n"),
    "Send cancel to stop."
  ].join("\n");
}

async function executeForm(ctx, command, values) {
  const def = FORM_DEFS[command];
  const record = { ...def.defaults(), ...values };
  if (def.action === "upsert") {
    const keyValue = record[def.keyField];
    if (!keyValue) return ctx.reply(`${def.keyField} is required.`);
    const result = await upsertRowByField(def.sheet, def.keyField, keyValue, record);
    await audit(ctx, command, def.sheet, keyValue, true, { mode: result.mode });
    return ctx.reply(`${def.sheet} ${result.mode}.\n\n${formatAdminRecord(record)}`);
  }

  await appendRow(def.sheet, record);
  await audit(ctx, command, def.sheet, record[def.keyField] || "new", true);
  await ctx.reply(`${def.sheet} record added.\n\n${formatAdminRecord(record)}`);
}

export async function handleAdmin(ctx) {
  const arg = commandArg(ctx);
  if (isApprovedId(ctx)) {
    verifiedAdmins.add(userId(ctx));
    await ctx.reply("Admin access confirmed for your WhatsApp number.");
    return;
  }
  if (!cfg.ADMIN_ACCESS_CODE) {
    await ctx.reply("Admin access code is not configured yet. Ask the bot owner to set ADMIN_ACCESS_CODE or WHATSAPP_ADMIN_NUMBERS.");
    return;
  }
  if (!arg) {
    await ctx.reply("Send /admin followed by your access code.");
    return;
  }
  if (arg === cfg.ADMIN_ACCESS_CODE) {
    verifiedAdmins.add(userId(ctx));
    log.info("admin verified", { platform: "whatsapp", userId: userId(ctx) });
    await ctx.reply("Admin access verified. You can now manage department records.");
    return;
  }
  log.warn("admin verification failed", { platform: "whatsapp", userId: userId(ctx) });
  await ctx.reply("Invalid admin access code.");
}

export async function handleCreateForm(ctx, command) {
  if (!(await requireAdmin(ctx))) return;
  const def = FORM_DEFS[command];
  const arg = commandArg(ctx);
  if (!arg) {
    pendingForms.set(String(ctx.chat.id), { command });
    await ctx.reply(promptForForm(def, command));
    return;
  }
  try {
    await executeForm(ctx, command, parseKeyValues(arg));
  } catch (err) {
    await audit(ctx, command, def.sheet, "", false, { error: safeErr(err) });
    await ctx.reply("I could not save that record to Google Sheets. Please check the fields and try again.");
  }
}

export async function handlePendingAdminFlow(ctx, next) {
  const raw = ctx.message?.text || "";
  if (raw.startsWith("/")) return next();
  const key = String(ctx.chat?.id || "");
  const pending = pendingForms.get(key);
  if (!pending) return next();
  if (!(await requireAdmin(ctx))) {
    pendingForms.delete(key);
    return;
  }
  if (raw.trim().toLowerCase() === "cancel") {
    pendingForms.delete(key);
    await ctx.reply("Admin form cancelled.");
    return;
  }
  try {
    await executeForm(ctx, pending.command, parseKeyValues(raw));
  } catch (err) {
    log.error("admin form failed", { command: pending.command, error: safeErr(err) });
    await ctx.reply("I could not save that record to Google Sheets. Please check the fields and try again.");
  } finally {
    pendingForms.delete(key);
  }
}

export async function handleUpdateAnnouncement(ctx) {
  if (!(await requireAdmin(ctx))) return;
  const [id, ...rest] = commandArg(ctx).split(/\s+/);
  if (!id || rest.length === 0) return ctx.reply("Usage: /updateannouncement AnnouncementID Field=Value; Message=Updated text");
  try {
    const updated = await updateRowByField("Announcements", "AnnouncementID", id, parseKeyValues(rest.join(" ")));
    await audit(ctx, "updateannouncement", "Announcements", id, Boolean(updated));
    await ctx.reply(updated ? `Announcement updated.\n\n${formatAdminRecord(updated)}` : "AnnouncementID not found.");
  } catch (err) {
    log.error("announcement update failed", { error: safeErr(err) });
    await ctx.reply("I could not update that announcement.");
  }
}

export async function handleDeleteAnnouncement(ctx) {
  if (!(await requireAdmin(ctx))) return;
  const id = commandArg(ctx);
  if (!id) return ctx.reply("Usage: /deleteannouncement AnnouncementID");
  try {
    const updated = await softDeleteRow("Announcements", "AnnouncementID", id);
    await audit(ctx, "deleteannouncement", "Announcements", id, Boolean(updated));
    await ctx.reply(updated ? "Announcement marked as deleted." : "AnnouncementID not found.");
  } catch (err) {
    log.error("announcement delete failed", { error: safeErr(err) });
    await ctx.reply("I could not delete that announcement.");
  }
}

export async function handleActiveAnnouncements(ctx) {
  if (!(await requireAdmin(ctx))) return;
  try {
    const rows = await findAnnouncements("");
    await ctx.reply(rows.length ? formatAnnouncementList(rows) : "No active announcements found.");
  } catch (err) {
    log.error("active announcements read failed", { error: safeErr(err) });
    await ctx.reply("I could not read active announcements right now.");
  }
}

export async function handleUpdateLecturer(ctx) {
  if (!(await requireAdmin(ctx))) return;
  const [id, ...rest] = commandArg(ctx).split(/\s+/);
  if (!id || rest.length === 0) return ctx.reply("Usage: /updatelecturer LecturerID Field=Value; OfficeHours=...");
  const updated = await updateRowByField("Lecturers", "LecturerID", id, parseKeyValues(rest.join(" ")));
  await audit(ctx, "updatelecturer", "Lecturers", id, Boolean(updated));
  await ctx.reply(updated ? `Lecturer updated.\n\n${formatAdminRecord(updated)}` : "LecturerID not found.");
}

export async function handleFindLecturer(ctx) {
  if (!(await requireAdmin(ctx))) return;
  const query = commandArg(ctx);
  if (!query) return ctx.reply("Usage: /findlecturer Dr Ahmed");
  const rows = await findLecturers(query);
  await ctx.reply(rows.length ? rows.slice(0, 5).map(formatAdminRecord).join("\n\n") : "No lecturer record found.");
}

export async function handleUpdateCourse(ctx) {
  if (!(await requireAdmin(ctx))) return;
  const match = commandArg(ctx).match(/^([A-Za-z]{2,4}\s*-?\s*\d{3})\s+([\s\S]+)$/);
  if (!match) return ctx.reply("Usage: /updatecourse SWE 201 Field=Value; Venue=...");
  const code = match[1].replace(/\s*-\s*/, " ").toUpperCase();
  const updated = await updateRowByField("Courses", "CourseCode", code, parseKeyValues(match[2]));
  await audit(ctx, "updatecourse", "Courses", code, Boolean(updated));
  await ctx.reply(updated ? `Course updated.\n\n${formatAdminRecord(updated)}` : "CourseCode not found.");
}

export async function registerAdminNaturalHandler(bot) {
  bot.on("message:text", handlePendingAdminFlow);
}

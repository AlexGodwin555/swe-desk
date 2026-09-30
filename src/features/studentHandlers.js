import { cfg } from "../lib/config.js";
import { log, safeErr } from "../lib/log.js";
import { addTurn } from "../lib/memory.js";
import { NO_DATA_MESSAGE, extractCourseCode, findAnnouncements, findCourses, findDepartmentInfo, findLatest, findLecturers, findTimetable, normalize } from "../services/departmentRecords.js";
import { formatAnnouncement, formatAnnouncementList, formatCourse, formatDepartmentInfo, formatLecturer, formatTimetable } from "../services/formatters.js";

const GREETING = "Hello, I’m the WhatsApp assistant for the Department of Software Engineering, Faculty of Computing and Information Systems, Federal University Wukari. How can I help you today?";
const GOOGLE_ERROR = "I’m having trouble reaching Google Sheets right now. Please try again shortly.";
const inFlightChats = new Set();
let globalInFlight = 0;
const GLOBAL_CAP = 2;

export function greetingText() {
  return `${GREETING}\n\nYou can ask for the latest announcement, 300 level timetable, department fees, course details, or lecturer details.`;
}

export function helpText() {
  return [
    "Student commands:",
    "/start - Show the official greeting.",
    "/help - Show available commands.",
    "/announcements 300 level - View active announcements.",
    "/latest - Show the latest active announcement or notice.",
    "/timetable 200 level or /timetable today - View timetable entries.",
    "/course SWE 201 - Find course information.",
    "/lecturer Dr Ahmed - Find lecturer details and photo if available.",
    "/department office or /department fees - Get department information.",
    "",
    "Admin commands:",
    "/admin code - Verify admin access.",
    "/addannouncement, /updateannouncement, /deleteannouncement, /activeannouncements.",
    "/addlecturer, /updatelecturer, /findlecturer.",
    "/addcourse, /updatecourse, /updatetimetable, /departmentinfo."
  ].join("\n");
}

function commandArg(ctx) {
  return String(ctx.match || "").trim();
}

async function remember(ctx, role, text) {
  await addTurn({
    mongoUri: cfg.MONGODB_URI,
    platform: "whatsapp",
    userId: ctx.from?.phone || ctx.from?.id,
    chatId: ctx.chat?.id,
    role,
    text
  });
}

async function replyAndRemember(ctx, text) {
  await remember(ctx, "assistant", text);
  await ctx.reply(text);
}

async function runStudent(ctx, intent, fn) {
  const chatKey = String(ctx.chat?.id || ctx.from?.id || "unknown");
  if (inFlightChats.has(chatKey)) {
    await ctx.reply("I’m working on your last request. Please wait a moment.");
    return;
  }
  if (globalInFlight >= GLOBAL_CAP) {
    await ctx.reply("I’m busy right now. Please try again in a moment.");
    return;
  }

  inFlightChats.add(chatKey);
  globalInFlight += 1;
  try {
    log.info("student intent start", { platform: "whatsapp", intent, chatType: ctx.chat?.type || "unknown" });
    await fn();
    log.info("student intent success", { platform: "whatsapp", intent });
  } catch (err) {
    log.error("student intent failed", { platform: "whatsapp", intent, error: safeErr(err) });
    await ctx.reply(GOOGLE_ERROR);
  } finally {
    inFlightChats.delete(chatKey);
    globalInFlight = Math.max(0, globalInFlight - 1);
  }
}

export async function handleStart(ctx) {
  await replyAndRemember(ctx, greetingText());
}

export async function handleHelp(ctx) {
  await replyAndRemember(ctx, helpText());
}

export async function handleAnnouncements(ctx, query = commandArg(ctx)) {
  await remember(ctx, "user", `/announcements ${query}`.trim());
  await runStudent(ctx, "announcements", async () => {
    const rows = await findAnnouncements(query);
    await replyAndRemember(ctx, rows.length ? formatAnnouncementList(rows) : NO_DATA_MESSAGE);
  });
}

export async function handleLatest(ctx) {
  await remember(ctx, "user", "/latest");
  await runStudent(ctx, "latest", async () => {
    const item = await findLatest();
    if (!item) return replyAndRemember(ctx, NO_DATA_MESSAGE);
    const text = item.type === "announcement" ? formatAnnouncement(item.row) : formatDepartmentInfo(item.row);
    await replyAndRemember(ctx, text || NO_DATA_MESSAGE);
  });
}

export async function handleTimetable(ctx, query = commandArg(ctx)) {
  await remember(ctx, "user", `/timetable ${query}`.trim());
  await runStudent(ctx, "timetable", async () => {
    const rows = await findTimetable(query);
    await replyAndRemember(ctx, rows.length ? formatTimetable(rows) : NO_DATA_MESSAGE);
  });
}

export async function handleCourse(ctx, query = commandArg(ctx)) {
  await remember(ctx, "user", `/course ${query}`.trim());
  await runStudent(ctx, "course", async () => {
    const rows = await findCourses(query);
    await replyAndRemember(ctx, rows.length ? rows.slice(0, 3).map(formatCourse).join("\n\n") : NO_DATA_MESSAGE);
  });
}

async function sendLecturerPhoto(ctx, row) {
  const url = String(row.PhotoURL || "").trim();
  if (!url) return;

  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`photo download failed ${res.status}`);
    const buffer = Buffer.from(await res.arrayBuffer());
    await ctx.sendImage({ buffer, url, caption: "Lecturer photo" });
  } catch (err) {
    log.warn("whatsapp lecturer photo fallback link", { error: safeErr(err), hasUrl: Boolean(url) });
    await ctx.reply(`Lecturer photo: ${url}`);
  }
}

export async function handleLecturer(ctx, query = commandArg(ctx)) {
  await remember(ctx, "user", `/lecturer ${query}`.trim());
  await runStudent(ctx, "lecturer", async () => {
    const rows = await findLecturers(query);
    if (!rows.length) return replyAndRemember(ctx, NO_DATA_MESSAGE);
    const row = rows[0];
    await replyAndRemember(ctx, formatLecturer(row));
    await sendLecturerPhoto(ctx, row);
  });
}

export async function handleDepartment(ctx, query = commandArg(ctx)) {
  await remember(ctx, "user", `/department ${query}`.trim());
  await runStudent(ctx, "department", async () => {
    const rows = await findDepartmentInfo(query || "department");
    await replyAndRemember(ctx, rows.length ? rows.slice(0, 4).map(formatDepartmentInfo).join("\n\n") : NO_DATA_MESSAGE);
  });
}

function shouldHandleMessage(ctx, raw) {
  if (ctx.chat?.type === "private") return true;
  const q = normalize(raw);
  return q.startsWith("bot ") || q.includes("department assistant");
}

async function routeNatural(ctx, text) {
  const q = normalize(text);
  if (/^(hi|hello|hey|good morning|good afternoon|good evening)\b/.test(q)) return handleStart(ctx);
  if (q.includes("announcement") || q.includes("notice") || q.includes("test") || q.includes("exam") || q.includes("lecture update") || q.includes("latest")) {
    if (q.includes("latest")) return handleLatest(ctx);
    return handleAnnouncements(ctx, text);
  }
  if (q.includes("timetable") || q.includes("schedule") || q.includes("today") || q.includes("lecture")) return handleTimetable(ctx, text);
  if (q.includes("lecturer") || q.includes("teacher") || q.includes("teaches") || q.includes("picture") || q.includes("photo") || /\b(dr|prof|mr|mrs|miss)\b/.test(q)) return handleLecturer(ctx, text);
  if (extractCourseCode(text) || q.includes("course")) return handleCourse(ctx, text);
  if (q.includes("department") || q.includes("faculty") || q.includes("fees") || q.includes("fee") || q.includes("deadline") || q.includes("office") || q.includes("hod") || q.includes("head of department") || q.includes("contact") || q.includes("venue")) return handleDepartment(ctx, text);
  return replyAndRemember(ctx, NO_DATA_MESSAGE);
}

export function registerStudentNaturalHandler(bot) {
  bot.on("message:text", async (ctx, next) => {
    const raw = ctx.message?.text || "";
    if (raw.startsWith("/")) return next();
    if (!shouldHandleMessage(ctx, raw)) return next();
    const text = raw.replace(/^bot\s+/i, "").trim();
    if (!text) return ctx.reply(greetingText());
    await remember(ctx, "user", text);
    await routeNatural(ctx, text);
  });
}

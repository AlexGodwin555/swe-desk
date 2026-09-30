import { listRows } from "./googleSheets.js";

export const NO_DATA_MESSAGE = "I don’t have confirmed information on that yet. Please check back later or contact the Department of Software Engineering representative.";

export function normalize(value) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

export function extractCourseCode(text) {
  const match = String(text || "").match(/\b([A-Z]{2,4})\s*-?\s*(\d{3})\b/i);
  return match ? `${match[1].toUpperCase()} ${match[2]}` : "";
}

export function extractLevel(text) {
  const match = String(text || "").match(/\b([1-6]00)\s*(level|lvl)?\b/i);
  return match ? match[1] : "";
}

export function extractDay(text) {
  const days = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
  const normalized = normalize(text);
  if (normalized.includes("today")) return new Intl.DateTimeFormat("en-US", { weekday: "long" }).format(new Date());
  return days.find((day) => normalized.includes(day)) || "";
}

function isActive(row, { includeOld = false } = {}) {
  const status = normalize(row.Status || "active");
  if (!["", "active", "current", "published"].includes(status)) return false;
  if (!includeOld && row.ExpiryDate) {
    const expiry = new Date(row.ExpiryDate);
    if (!Number.isNaN(expiry.getTime())) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (expiry < today) return false;
    }
  }
  return true;
}

function scoreAnnouncement(row) {
  const priority = Number(row.Priority || 0);
  const date = new Date(row.DatePosted || 0).getTime() || 0;
  return priority * 10000000000000 + date;
}

function containsAny(row, query, fields) {
  const q = normalize(query);
  if (!q) return true;
  return fields.some((field) => normalize(row[field]).includes(q) || q.includes(normalize(row[field])));
}

export async function findAnnouncements(query = "", opts = {}) {
  const level = extractLevel(query);
  const course = extractCourseCode(query);
  const q = normalize(query);
  const rows = (await listRows("Announcements")).filter((row) => isActive(row, opts));

  return rows
    .filter((row) => {
      if (level && normalize(row.Level) !== normalize(level)) return false;
      if (course && normalize(row.CourseCode) !== normalize(course)) return false;
      if (!level && !course && q) {
        const ignored = ["announcement", "announcements", "latest", "active", "show", "me", "department", "today", "notice", "notices"];
        const meaningful = q.split(" ").filter((word) => !ignored.includes(word)).join(" ");
        if (meaningful && !containsAny(row, meaningful, ["Title", "Category", "Level", "CourseCode", "Message"])) return false;
      }
      return true;
    })
    .sort((a, b) => scoreAnnouncement(b) - scoreAnnouncement(a));
}

export async function findLatest() {
  const announcements = await findAnnouncements("");
  if (announcements.length) return { type: "announcement", row: announcements[0] };

  const infoRows = (await listRows("DepartmentInfo"))
    .filter((row) => isActive(row))
    .sort((a, b) => (new Date(b.LastUpdated || 0).getTime() || 0) - (new Date(a.LastUpdated || 0).getTime() || 0));

  return infoRows.length ? { type: "info", row: infoRows[0] } : null;
}

export async function findTimetable(query = "") {
  const level = extractLevel(query);
  const course = extractCourseCode(query);
  const day = extractDay(query);
  const q = normalize(query);
  return (await listRows("Timetable"))
    .filter((row) => isActive(row))
    .filter((row) => {
      if (level && normalize(row.Level) !== normalize(level)) return false;
      if (course && normalize(row.CourseCode) !== normalize(course)) return false;
      if (day && normalize(row.Day) !== normalize(day)) return false;
      if (!level && !course && !day && q) return containsAny(row, q, ["Level", "CourseCode", "CourseTitle", "Day", "Venue", "LecturerName"]);
      return true;
    })
    .sort((a, b) => `${a.Day} ${a.Time}`.localeCompare(`${b.Day} ${b.Time}`));
}

export async function findCourses(query = "") {
  const course = extractCourseCode(query);
  const q = normalize(course || query);
  return (await listRows("Courses"))
    .filter((row) => isActive(row))
    .filter((row) => containsAny(row, q, ["CourseCode", "CourseTitle", "Level", "Semester", "LecturerName", "Description"]));
}

export async function findLecturers(query = "") {
  const course = extractCourseCode(query);
  const q = normalize(course || query.replace(/^(show|send|find|get|who is|details|lecturer|dr|prof|mr|mrs|miss)\s+/i, ""));
  const lecturers = (await listRows("Lecturers")).filter((row) => isActive(row));
  const direct = lecturers.filter((row) => containsAny(row, q, ["LecturerID", "FullName", "Title", "DepartmentRole", "CoursesTaught", "OfficeLocation", "Email"]));
  if (direct.length) return direct;

  if (course) {
    const courses = await findCourses(course);
    const names = courses.map((row) => normalize(row.LecturerName)).filter(Boolean);
    return lecturers.filter((row) => names.some((name) => normalize(row.FullName).includes(name) || name.includes(normalize(row.FullName))));
  }

  return [];
}

export async function findDepartmentInfo(query = "") {
  const q = normalize(query || "department");
  return (await listRows("DepartmentInfo"))
    .filter((row) => isActive(row))
    .filter((row) => containsAny(row, q, ["InfoType", "Title", "Details", "ContactPerson", "ContactPhone"]));
}

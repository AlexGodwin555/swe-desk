function line(label, value) {
  const text = String(value || "").trim();
  return text ? `${label}: ${text}` : "";
}

function joinLines(lines) {
  return lines.filter(Boolean).join("\n");
}

export function formatAnnouncement(row) {
  return joinLines([
    row.Title || "Department announcement",
    line("Category", row.Category),
    line("Level", row.Level),
    line("Course", row.CourseCode),
    line("Message", row.Message),
    line("Date posted", row.DatePosted),
    line("Expires", row.ExpiryDate)
  ]);
}

export function formatAnnouncementList(rows) {
  return rows.slice(0, 6).map((row, index) => `${index + 1}) ${formatAnnouncement(row)}`).join("\n\n");
}

export function formatCourse(row) {
  return joinLines([
    `${row.CourseCode || "Course"}${row.CourseTitle ? `: ${row.CourseTitle}` : ""}`,
    line("Level", row.Level),
    line("Semester", row.Semester),
    line("Lecturer", row.LecturerName),
    line("Venue", row.Venue),
    line("Schedule", row.Schedule),
    line("Description", row.Description)
  ]);
}

export function formatTimetable(rows) {
  return rows.slice(0, 12).map((row, index) => joinLines([
    `${index + 1}) ${row.Day || "Day not set"} ${row.Time || ""}`.trim(),
    line("Course", `${row.CourseCode || ""} ${row.CourseTitle || ""}`.trim()),
    line("Level", row.Level),
    line("Venue", row.Venue),
    line("Lecturer", row.LecturerName)
  ])).join("\n\n");
}

export function formatLecturer(row) {
  return joinLines([
    row.FullName || "Lecturer",
    line("Title", row.Title),
    line("Department role", row.DepartmentRole),
    line("Office location", row.OfficeLocation),
    line("Phone", row.PhoneNumber),
    line("Email", row.Email),
    line("Courses taught", row.CoursesTaught),
    line("Office hours", row.OfficeHours),
    line("Bio", row.Bio),
    row.PhotoURL ? `Photo: ${row.PhotoURL}` : ""
  ]);
}

export function formatDepartmentInfo(row) {
  return joinLines([
    row.Title || row.InfoType || "Department information",
    line("Details", row.Details),
    line("Contact person", row.ContactPerson),
    line("Contact phone", row.ContactPhone),
    line("Last updated", row.LastUpdated)
  ]);
}

export function formatAdminRecord(row) {
  return Object.entries(row)
    .filter(([key, value]) => !key.startsWith("_") && String(value || "").trim())
    .map(([key, value]) => `${key}: ${value}`)
    .join("\n");
}

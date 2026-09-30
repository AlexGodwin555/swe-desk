export function buildBotProfile() {
  return [
    "Purpose: Official WhatsApp assistant for the Department of Software Engineering, Faculty of Computing and Information Systems, Federal University Wukari.",
    "Source of truth: The bot answers only from configured Google Sheets records for announcements, lecturers, courses, timetables, and department information.",
    "Public student commands: /start, /help, /announcements, /latest, /timetable, /course, /lecturer, /department.",
    "Admin commands: /admin, /addannouncement, /updateannouncement, /deleteannouncement, /activeannouncements, /addlecturer, /updatelecturer, /findlecturer, /addcourse, /updatecourse, /updatetimetable, /departmentinfo.",
    "Rules: Student answers must use active, non-expired records only unless old records are requested. Admin actions require an approved WhatsApp number or access code. If confirmed data is missing, use the exact no-data fallback."
  ].join("\n");
}

export const BOT_PROFILE = buildBotProfile();

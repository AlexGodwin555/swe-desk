# Wukari SWE Bot Documentation

This bot is the Telegram implementation of the official WhatsApp-style assistant for the Department of Software Engineering, Faculty of Computing and Information Systems, Federal University Wukari.

It answers only from Google Sheets records. If confirmed data is missing, it replies:

“I don’t have confirmed information on that yet. Please check back later or contact the Department of Software Engineering representative.”

## Public commands

### /start

Shows the official greeting and example questions.

Usage:

`/start`

### /help

Lists student and admin capabilities.

Usage:

`/help`

### /announcements

Shows active, non-expired announcements from the Announcements sheet. Can filter by level or course code.

Usage:

`/announcements`

`/announcements 300 level`

`/announcements SWE 302`

### /latest

Shows the latest active announcement or department notice.

Usage:

`/latest`

### /timetable

Shows timetable entries by level, day, today, or course code.

Usage:

`/timetable 200 level`

`/timetable today`

`/timetable SWE 201`

### /course

Finds course information from the Courses sheet.

Usage:

`/course SWE 201`

### /lecturer

Finds lecturer details from the Lecturers sheet. If PhotoURL is present, the bot tries to send the image and falls back to a link.

Usage:

`/lecturer Dr Ahmed`

`/lecturer SWE 201`

### /department

Gets approved department information such as fees, deadlines, office, contacts, HOD, venues, faculty identity, and general notices.

Usage:

`/department office`

`/department fees`

`/department faculty`

## Admin commands

Admins must be verified by a Telegram user ID in `TELEGRAM_ADMIN_IDS` or by using `/admin <code>` with `ADMIN_ACCESS_CODE`.

### /admin

Verifies admin access.

Usage:

`/admin your-access-code`

### /addannouncement

Adds an announcement using a guided Field=Value form.

Usage:

`/addannouncement`

Or:

`/addannouncement Title=Test; Level=300; CourseCode=SWE 302; Message=Test holds Friday; Status=active`

### /updateannouncement

Updates an existing announcement by AnnouncementID.

Usage:

`/updateannouncement ANN-123 Message=Updated text; Status=active`

### /deleteannouncement

Soft deletes an announcement by setting Status to deleted.

Usage:

`/deleteannouncement ANN-123`

### /activeannouncements

Shows active announcements currently visible to students.

Usage:

`/activeannouncements`

### /addlecturer

Adds a lecturer record.

Usage:

`/addlecturer`

### /updatelecturer

Updates lecturer details by LecturerID.

Usage:

`/updatelecturer LEC-123 OfficeLocation=Block B; OfficeHours=Tue 10am-12pm`

### /findlecturer

Admin search for lecturer records.

Usage:

`/findlecturer Dr Ahmed`

### /addcourse

Adds a course record.

Usage:

`/addcourse`

### /updatecourse

Updates a course by CourseCode.

Usage:

`/updatecourse SWE 201 Venue=LT 2; Schedule=Monday 10am`

### /updatetimetable

Adds a timetable entry using a guided Field=Value form.

Usage:

`/updatetimetable`

### /departmentinfo

Adds or updates DepartmentInfo by InfoType.

Usage:

`/departmentinfo`

Example fields:

`InfoType=fees`

`Title=Department fees`

`Details=Approved fee details`

`Status=active`

## Environment variables

### TELEGRAM_BOT_TOKEN

Required. Telegram bot token from BotFather.

### GOOGLE_SHEETS_SPREADSHEET_ID

Required for department records. The Google Sheet ID that stores the bot data.

### GOOGLE_SERVICE_ACCOUNT_EMAIL

Required unless using `GOOGLE_APPLICATION_CREDENTIALS`. Service account email with access to the sheet.

### GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY

Required unless using `GOOGLE_APPLICATION_CREDENTIALS`. Service account private key. Store newlines as `\n` if needed.

### GOOGLE_APPLICATION_CREDENTIALS

Optional alternative path to a mounted Google service account JSON file.

### TELEGRAM_ADMIN_IDS

Optional comma-separated Telegram user IDs that are always admins.

### ADMIN_ACCESS_CODE

Optional secret code for `/admin <code>`.

### MONGODB_URI

Optional. Stores conversation turns and admin audit logs. If missing, the bot uses bounded in-memory fallback.

### CACHE_TTL_MS

Optional. Google Sheets read cache duration in milliseconds. Default is 30000.

## Setup

1. Install dependencies with `npm install`.
2. Copy `.env.sample` to `.env`.
3. Add the required Telegram and Google Sheets credentials.
4. Share the Google Sheet with the service account email.
5. Run `npm run dev` locally or `npm start` in production.

## Data accuracy rules

The bot only presents active records. Announcements with past ExpiryDate are excluded unless old records are explicitly requested in future enhancements. If no active matching record exists, the bot uses the exact fallback message and does not guess.

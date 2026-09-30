# Wukari SWE Bot

A Telegram implementation of the official WhatsApp-style department assistant for the Department of Software Engineering, Faculty of Computing and Information Systems, Federal University Wukari.

The bot answers student questions only from Google Sheets. It never invents announcements, fees, dates, venues, lecturer contacts, or department details.

## Features

- Official greeting for Federal University Wukari Software Engineering students.
- Student lookup commands for announcements, latest notices, timetables, courses, lecturers, and department information.
- Natural-language private chat routing for common student questions.
- Admin verification by Telegram user ID or access code.
- Admin commands to add, update, delete, and view records in Google Sheets.
- Google Sheets workbook setup with tabs and headers for Announcements, Lecturers, Courses, Timetable, and DepartmentInfo.
- Lecturer photo delivery from PhotoURL with Telegram media fallbacks.
- Optional MongoDB memory and admin audit logging.
- Render-friendly long polling with webhook cleanup and polling conflict backoff.

## Architecture

- `src/index.js` boots the bot, validates Telegram token presence, clears webhooks, sets Telegram commands, and starts polling with `@grammyjs/runner`.
- `src/bot.js` creates the grammY bot and registers post-command feature handlers.
- `src/commands/*.js` contains public command registration modules.
- `src/features/studentHandlers.js` routes student commands and natural-language queries.
- `src/features/adminHandlers.js` handles admin verification and guided Google Sheets write flows.
- `src/services/googleSheets.js` abstracts Google Sheets as collection-like tabs.
- `src/services/departmentRecords.js` contains active-record filtering and query matching.
- `src/services/formatters.js` formats concise student and admin responses.
- `src/lib/memory.js` optionally stores conversation turns and admin audit records in MongoDB.

## Google Sheets schema

The bot creates or connects these sheets:

1. Announcements
   - AnnouncementID, Title, Category, Level, CourseCode, Message, DatePosted, ExpiryDate, Priority, Status

2. Lecturers
   - LecturerID, FullName, Title, DepartmentRole, OfficeLocation, PhoneNumber, Email, CoursesTaught, OfficeHours, Bio, PhotoURL, Status

3. Courses
   - CourseCode, CourseTitle, Level, Semester, LecturerName, Venue, Schedule, Description, Status

4. Timetable
   - Level, CourseCode, CourseTitle, Day, Time, Venue, LecturerName, Status

5. DepartmentInfo
   - InfoType, Title, Details, ContactPerson, ContactPhone, LastUpdated, Status

Status values should normally be `active`, `inactive`, `expired`, or `deleted`. Students only see active, non-expired records.

## Setup

Prerequisites:

- Node.js 18 or newer.
- A Telegram bot token from BotFather.
- A Google Cloud service account with Google Sheets API access.
- A Google Sheet shared with the service account email as Editor.

Install dependencies:

bash
npm install


Create `.env` from `.env.sample` and fill in values:

bash
cp .env.sample .env


Required:

- `TELEGRAM_BOT_TOKEN`: Telegram bot token.
- `GOOGLE_SHEETS_SPREADSHEET_ID`: The ID from the Google Sheet URL.
- `GOOGLE_SERVICE_ACCOUNT_EMAIL`: Service account email.
- `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY`: Service account private key. Use escaped `\n` newlines if stored in one line.

Admin access:

- `TELEGRAM_ADMIN_IDS`: Comma-separated Telegram numeric user IDs that are automatically admins.
- `ADMIN_ACCESS_CODE`: Optional secret code admins can use with `/admin code`.

Optional:

- `MONGODB_URI`: Stores conversation memory and admin audit logs. If missing, the bot runs with bounded in-memory fallback.
- `CACHE_TTL_MS`: Short Google Sheets read cache duration. Default is 30000.

Run locally:

bash
npm run dev


Production start:

bash
npm start


Build command:

bash
npm run build


## Commands

Student commands:

- `/start`
  - Shows the official department assistant greeting.
  - Example: `/start`

- `/help`
  - Lists student and admin capabilities.
  - Example: `/help`

- `/announcements [filter]`
  - Shows active department announcements, optionally filtered by level or course.
  - Examples: `/announcements`, `/announcements 300 level`, `/announcements SWE 302`

- `/latest`
  - Shows the latest active announcement or department notice.
  - Example: `/latest`

- `/timetable [filter]`
  - Shows timetable entries by level, day, course code, or today.
  - Examples: `/timetable 200 level`, `/timetable today`, `/timetable SWE 201`

- `/course <course code or title>`
  - Finds course details from the Courses sheet.
  - Example: `/course SWE 201`

- `/lecturer <name or course>`
  - Finds lecturer details and sends a photo if PhotoURL is available.
  - Examples: `/lecturer Dr Ahmed`, `/lecturer SWE 201`

- `/department <topic>`
  - Gets department identity, office, fees, contacts, HOD, venues, or general info.
  - Examples: `/department office`, `/department fees`, `/department faculty`

Admin commands:

- `/admin <code>`
  - Verifies admin access using `ADMIN_ACCESS_CODE`, unless the user ID is already listed in `TELEGRAM_ADMIN_IDS`.

- `/addannouncement`
  - Starts a guided form, or accepts Field=Value pairs.
  - Example: `/addannouncement Title=Test; Level=300; CourseCode=SWE 302; Message=Test holds Friday; Status=active`

- `/updateannouncement <AnnouncementID> <Field=Value>`
  - Updates an announcement.

- `/deleteannouncement <AnnouncementID>`
  - Soft deletes an announcement by setting Status to deleted.

- `/activeannouncements`
  - Lists active announcements visible to students.

- `/addlecturer`
  - Adds a lecturer record.

- `/updatelecturer <LecturerID> <Field=Value>`
  - Updates lecturer details.

- `/findlecturer <query>`
  - Searches lecturer records as an admin.

- `/addcourse`
  - Adds a course record.

- `/updatecourse <CourseCode> <Field=Value>`
  - Updates a course record.

- `/updatetimetable`
  - Adds a timetable entry through a guided Field=Value form.

- `/departmentinfo`
  - Adds or updates department info by InfoType.

## Integrations

Google Sheets API:

- Reads records from sheet tabs with short cache.
- Appends new records for add commands.
- Updates rows by key field for update commands.
- Soft deletes announcements by setting Status to deleted.
- Logs read/write failures without exposing secrets.

Telegram API:

- Uses grammY.
- Runs long polling with `@grammyjs/runner`.
- Clears webhook before polling to avoid webhook/getUpdates conflicts.
- Backs off and retries on polling conflicts or transient failures.

MongoDB:

- Optional.
- Collections: `memory_messages`, `admin_audit`.
- Indexes: platform/user/chat/timestamp for memory, timestamp for audit.
- No migrations are required.

## Deployment on Render

Use one Web Service or Worker service that runs:

- Build command: `npm run build`
- Start command: `npm start`

Set environment variables in Render:

- `TELEGRAM_BOT_TOKEN`
- `GOOGLE_SHEETS_SPREADSHEET_ID`
- `GOOGLE_SERVICE_ACCOUNT_EMAIL`
- `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY`
- `TELEGRAM_ADMIN_IDS` or `ADMIN_ACCESS_CODE`
- Optional `MONGODB_URI`

The bot uses long polling and does not require a public webhook URL.

## Troubleshooting

- If the bot exits on boot, confirm `TELEGRAM_BOT_TOKEN` is set.
- If all student queries return a Google Sheets error, confirm the spreadsheet ID and service account credentials.
- Make sure the Google Sheet is shared with the service account email as Editor.
- If admin commands fail, check `TELEGRAM_ADMIN_IDS` or use `/admin your-code` after setting `ADMIN_ACCESS_CODE`.
- If lecturer photos do not send, confirm PhotoURL is a public HTTPS image URL. The bot will fall back to sending the link.
- Logs print environment presence booleans only, never secret values.

## Extending

Add a new command by creating a file in `src/commands/` that exports a default register function. Put shared logic in `src/features/`, `src/services/`, or `src/lib/`, not inside command files.

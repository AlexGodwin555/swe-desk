# Changelog

All notable changes to this bot project are recorded here.

## 2026-09-30 17:49:11. UTC
- Request: in the prompt i sent initially, i asked you to create a whatsapp bot, not a telegram bot, so why did you create a telegram bot? also can you change it to a whatsapp bot?
- Summary: You were right: the original request was for WhatsApp, but the project had been implemented with Telegram. I converted the runtime to WhatsApp using Baileys, removed Telegram boot logic, updated WhatsApp env handling, p…
- Files: .env.sample, package.json, src/bot.js, src/features/adminHandlers.js, src/features/studentHandlers.js, src/index.js, src/lib/botProfile.js, src/lib/config.js, src/lib/memory.js

## 2026-09-30 17:35:01. UTC
- Request: Create a WhatsApp department information and announcement assistant for Federal University Wukari. The bot’s identity: University: Federal University Wukari Faculty: Faculty of Computing and Information Systems Departme…
- Summary: Built the complete Telegram version with Google Sheets records, student lookup commands, admin CRUD flows, safe polling, logging, and docs.
- Files: .env.sample, DOCS.md, README.md, package.json, project.json, src/bot.js, src/commands/activeannouncements.js, src/commands/addannouncement.js, src/commands/addcourse.js, src/commands/addlecturer.js, src/commands/admin.js, src/commands/announcements.js, src/co…


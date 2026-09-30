import { handleTimetable } from "../features/studentHandlers.js";

export default function register(bot) {
  bot.command("timetable", handleTimetable);
}

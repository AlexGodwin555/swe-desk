import { handleLecturer } from "../features/studentHandlers.js";

export default function register(bot) {
  bot.command("lecturer", handleLecturer);
}

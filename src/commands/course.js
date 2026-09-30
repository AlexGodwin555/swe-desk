import { handleCourse } from "../features/studentHandlers.js";

export default function register(bot) {
  bot.command("course", handleCourse);
}

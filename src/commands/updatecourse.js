import { handleUpdateCourse } from "../features/adminHandlers.js";

export default function register(bot) {
  bot.command("updatecourse", handleUpdateCourse);
}

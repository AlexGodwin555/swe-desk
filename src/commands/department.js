import { handleDepartment } from "../features/studentHandlers.js";

export default function register(bot) {
  bot.command("department", handleDepartment);
}

import { handleAdmin } from "../features/adminHandlers.js";

export default function register(bot) {
  bot.command("admin", handleAdmin);
}

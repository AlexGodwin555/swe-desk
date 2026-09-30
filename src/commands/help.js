import { handleHelp } from "../features/studentHandlers.js";

export default function register(bot) {
  bot.command("help", handleHelp);
}

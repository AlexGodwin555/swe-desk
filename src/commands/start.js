import { handleStart } from "../features/studentHandlers.js";

export default function register(bot) {
  bot.command("start", handleStart);
}

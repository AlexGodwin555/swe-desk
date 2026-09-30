import { handleLatest } from "../features/studentHandlers.js";

export default function register(bot) {
  bot.command("latest", handleLatest);
}

import { handleActiveAnnouncements } from "../features/adminHandlers.js";

export default function register(bot) {
  bot.command("activeannouncements", handleActiveAnnouncements);
}

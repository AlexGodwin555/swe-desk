import { handleAnnouncements } from "../features/studentHandlers.js";

export default function register(bot) {
  bot.command("announcements", handleAnnouncements);
}

import { handleUpdateAnnouncement } from "../features/adminHandlers.js";

export default function register(bot) {
  bot.command("updateannouncement", handleUpdateAnnouncement);
}

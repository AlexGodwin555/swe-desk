import { handleDeleteAnnouncement } from "../features/adminHandlers.js";

export default function register(bot) {
  bot.command("deleteannouncement", handleDeleteAnnouncement);
}

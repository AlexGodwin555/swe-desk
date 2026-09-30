import { handleCreateForm } from "../features/adminHandlers.js";

export default function register(bot) {
  bot.command("addannouncement", (ctx) => handleCreateForm(ctx, "addannouncement"));
}

import { handleCreateForm } from "../features/adminHandlers.js";

export default function register(bot) {
  bot.command("updatetimetable", (ctx) => handleCreateForm(ctx, "updatetimetable"));
}

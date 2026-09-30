import { handleCreateForm } from "../features/adminHandlers.js";

export default function register(bot) {
  bot.command("addlecturer", (ctx) => handleCreateForm(ctx, "addlecturer"));
}

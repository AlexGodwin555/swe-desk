import { handleCreateForm } from "../features/adminHandlers.js";

export default function register(bot) {
  bot.command("departmentinfo", (ctx) => handleCreateForm(ctx, "departmentinfo"));
}

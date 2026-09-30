import { handleCreateForm } from "../features/adminHandlers.js";

export default function register(bot) {
  bot.command("addcourse", (ctx) => handleCreateForm(ctx, "addcourse"));
}

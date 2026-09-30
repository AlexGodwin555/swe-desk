import { handleUpdateLecturer } from "../features/adminHandlers.js";

export default function register(bot) {
  bot.command("updatelecturer", handleUpdateLecturer);
}

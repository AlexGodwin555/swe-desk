import { handleFindLecturer } from "../features/adminHandlers.js";

export default function register(bot) {
  bot.command("findlecturer", handleFindLecturer);
}

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const currentDir = path.dirname(fileURLToPath(import.meta.url));

export async function registerCommands(bot) {
  const commandFiles = fs
    .readdirSync(currentDir)
    .filter((file) => file.endsWith(".js") && file !== "loader.js" && !file.startsWith("_"))
    .sort();

  for (const file of commandFiles) {
    const mod = await import(pathToFileURL(path.join(currentDir, file)).href);
    const register = mod.default || mod.register;
    if (typeof register === "function") {
      await register(bot);
    } else {
      console.warn("[commands] skipped file with no register export", { file });
    }
  }
}

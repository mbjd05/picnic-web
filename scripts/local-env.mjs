import { existsSync, readFileSync } from "node:fs";

function parseEnvValue(value) {
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

export function loadLocalEnvFile(envFilePath = ".env") {
  if (!existsSync(envFilePath)) return;

  const contents = readFileSync(envFilePath, "utf8");
  for (const line of contents.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const separator = trimmed.indexOf("=");
    if (separator < 1) continue;
    const name = trimmed.slice(0, separator);
    if (process.env[name]) continue;
    process.env[name] = parseEnvValue(trimmed.slice(separator + 1));
  }
}

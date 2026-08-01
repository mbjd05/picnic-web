import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const ROOT_ENV_PATH = ".env";
const WORKER_DEV_VARS_PATH = path.join("apps", "api", ".dev.vars");
const REQUIRED_KEYS = ["PICNIC_TOKEN"];
const COPIED_KEYS = ["PICNIC_TOKEN", "PICNIC_COUNTRY_CODE"];

function parseEnv(contents) {
  const values = new Map();
  for (const line of contents.split(/\r?\n/)) {
    const match = line.match(/^\s*([^#=\s]+)\s*=\s*(.*)\s*$/);
    if (!match) continue;
    let value = match[2].trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    values.set(match[1], value);
  }
  return values;
}

async function main() {
  let rootEnv;
  try {
    rootEnv = await readFile(ROOT_ENV_PATH, "utf8");
  } catch {
    console.warn(
      `[dev-vars] ${ROOT_ENV_PATH} not found; Wrangler will start without Picnic token.`
    );
    return;
  }

  const values = parseEnv(rootEnv);
  const missing = REQUIRED_KEYS.filter((key) => !values.get(key));
  if (missing.length > 0) {
    console.warn(`[dev-vars] Missing ${missing.join(", ")} in ${ROOT_ENV_PATH}.`);
    return;
  }

  const lines = COPIED_KEYS.filter((key) => values.has(key)).map(
    (key) => `${key}=${values.get(key)}`
  );
  await mkdir(path.dirname(WORKER_DEV_VARS_PATH), { recursive: true });
  await writeFile(WORKER_DEV_VARS_PATH, `${lines.join("\n")}\n`, "utf8");
  console.log(`[dev-vars] Synced ${lines.length} local key(s) for Wrangler.`);
}

await main();

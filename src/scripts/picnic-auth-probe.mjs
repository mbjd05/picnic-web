import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

import PicnicClient from "picnic-api";

import { loadLocalEnvFile } from "./local-env.mjs";

/*
Local auth probe
================

Credential login:
  node .\src\scripts\picnic-auth-probe.mjs login

Token validation:
  $env:PICNIC_TOKEN="YOUR_AUTH_TOKEN"; node .\src\scripts\picnic-auth-probe.mjs token

Options:
  $env:PICNIC_COUNTRY_CODE="NL"
  $env:PICNIC_API_VERSION="17"
  --show-token              Print the full token after success.
  --no-env-file             Do not update the local .env file.
  --print-powershell-env    Print a PowerShell assignment for the current shell.

This script saves the resulting full auth token to .env by default and only
prints a hash prefix unless --show-token is provided.
*/

const envFilePath = ".env";

loadLocalEnvFile(envFilePath);

const mode = process.argv.find((arg, index) => index > 1 && !arg.startsWith("--")) ?? "login";
const countryCode = process.env.PICNIC_COUNTRY_CODE ?? "NL";
const apiVersion = process.env.PICNIC_API_VERSION ?? "17";
const debug2FA = process.env.PICNIC_DEBUG_2FA === "1" || process.argv.includes("--debug-2fa");
const showToken = process.argv.includes("--show-token");
const updateEnvFile = !process.argv.includes("--no-env-file");
const printPowerShellEnv = process.argv.includes("--print-powershell-env");

function createClient(authKey) {
  return new PicnicClient({
    countryCode,
    apiVersion,
    ...(authKey ? { authKey } : {}),
  });
}

function getErrorMessage(error) {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return JSON.stringify(error);
}

function getBaseUrl() {
  return `https://storefront-prod.${countryCode.toLowerCase()}.picnicinternational.com/api/${apiVersion}`;
}

function makeDeviceId() {
  return Math.random().toString(16).slice(2, 14).toUpperCase();
}

function setEnvValue(contents, name, value) {
  const escapedValue = JSON.stringify(value);
  const lines = contents ? contents.split(/\r?\n/) : [];
  let replaced = false;
  const nextLines = lines.map((line) => {
    if (line.startsWith(`${name}=`)) {
      replaced = true;
      return `${name}=${escapedValue}`;
    }
    return line;
  });

  if (!replaced) {
    if (nextLines.length > 0 && nextLines[nextLines.length - 1] !== "") {
      nextLines.push("");
    }
    nextLines.push(`${name}=${escapedValue}`);
  }

  return `${nextLines.join("\n").replace(/\n+$/, "")}\n`;
}

function saveTokenToEnvFile(authKey) {
  const currentContents = existsSync(envFilePath) ? readFileSync(envFilePath, "utf8") : "";
  let nextContents = setEnvValue(currentContents, "PICNIC_TOKEN", authKey);
  nextContents = setEnvValue(nextContents, "PICNIC_COUNTRY_CODE", countryCode);
  writeFileSync(envFilePath, nextContents, { encoding: "utf8", mode: 0o600 });
}

async function generate2FACodeWithDebug(authKey, channel = "SMS") {
  const response = await fetch(`${getBaseUrl()}/user/2fa/generate`, {
    method: "POST",
    headers: {
      "User-Agent": "okhttp/4.9.0",
      "Content-Type": "application/json; charset=UTF-8",
      "Accept-Language": countryCode === "DE" ? "de" : "nl",
      "x-picnic-auth": authKey,
      "x-picnic-agent": "30100;1.228.1-15480;",
      "x-picnic-did": makeDeviceId(),
    },
    body: JSON.stringify({ channel }),
  });

  const body = await response.text();

  if (debug2FA) {
    console.log("");
    console.log("Raw 2FA generate response:");
    console.log(`HTTP ${response.status} ${response.statusText}`);
    for (const header of [
      "content-type",
      "retry-after",
      "x-ratelimit-limit",
      "x-ratelimit-remaining",
      "x-ratelimit-reset",
    ]) {
      const value = response.headers.get(header);
      if (value) console.log(`${header}: ${value}`);
    }
    console.log(body || "<empty body>");
  }

  if (!response.ok) {
    throw new Error(
      `2FA generate failed: ${response.status} ${response.statusText}${body ? ` - ${body}` : ""}`
    );
  }

  return body ? JSON.parse(body) : null;
}

function printTokenStatus(authKey) {
  console.log("");
  console.log(`SHA-256 prefix: ${createHash("sha256").update(authKey).digest("hex").slice(0, 16)}`);

  if (updateEnvFile) {
    saveTokenToEnvFile(authKey);
    console.log(`Saved PICNIC_TOKEN and PICNIC_COUNTRY_CODE to ${envFilePath}.`);
  }

  if (printPowerShellEnv) {
    console.log("");
    console.log("PowerShell assignment for this terminal:");
    console.log(`$env:PICNIC_TOKEN=${JSON.stringify(authKey)}`);
    console.log(`$env:PICNIC_COUNTRY_CODE=${JSON.stringify(countryCode)}`);
  }

  if (showToken) {
    console.log("");
    console.log("Auth token:");
    console.log(authKey);
  }

  console.log("");
}

async function validateAuthKey(authKey) {
  const client = createClient(authKey);
  await client.catalog.getSuggestions("");
}

async function promptHidden(rl, question) {
  const originalWrite = output.write;
  output.write = function maskedWrite(chunk, encoding, callback) {
    if (typeof chunk === "string" && chunk !== question) {
      return originalWrite.call(this, "*".repeat(chunk.length), encoding, callback);
    }
    return originalWrite.call(this, chunk, encoding, callback);
  };

  try {
    return await rl.question(question);
  } finally {
    output.write = originalWrite;
    output.write("\n");
  }
}

async function runTokenMode() {
  const token = process.env.PICNIC_TOKEN;
  if (!token) {
    throw new Error("Set PICNIC_TOKEN before running token mode.");
  }

  try {
    await validateAuthKey(token);
    console.log("Token is valid and fully authenticated.");
    printTokenStatus(token);
    return;
  } catch (error) {
    console.log("Token is not accepted as a full auth token.");
    console.log(getErrorMessage(error));
  }

  const client = createClient(token);
  try {
    await generate2FACodeWithDebug(token, "SMS");
    console.log("2FA appears to be required. A verification code was requested.");
  } catch (error) {
    const message = getErrorMessage(error);
    console.log("2FA generation returned:");
    console.log(message);
    console.log("Continuing anyway in case Picnic already sent a code.");
  }

  const rl = createInterface({ input, output });
  try {
    const code = (await rl.question("2FA code: ")).trim();
    const result = await client.auth.verify2FACode(code);
    const finalToken = result.authKey || client.authKey;
    if (!finalToken) throw new Error("2FA succeeded but no final auth token was returned.");
    await validateAuthKey(finalToken);
    console.log("2FA token verification succeeded.");
    printTokenStatus(finalToken);
  } finally {
    rl.close();
  }
}

async function runLoginMode() {
  const rl = createInterface({ input, output });
  try {
    const email = (process.env.PICNIC_EMAIL ?? (await rl.question("Email: "))).trim();
    const password = process.env.PICNIC_PASSWORD ?? (await promptHidden(rl, "Password: "));

    const client = createClient();
    const loginResult = await client.auth.login(email, password);
    const authKey = loginResult.authKey || client.authKey;
    if (!authKey) throw new Error("Login succeeded but no auth token was returned.");

    console.log("");
    console.log(`2FA required: ${Boolean(loginResult.second_factor_authentication_required)}`);
    console.log(`2FA intro flag: ${Boolean(loginResult.show_second_factor_authentication_intro)}`);

    if (!loginResult.second_factor_authentication_required) {
      await validateAuthKey(authKey);
      console.log("Credential login produced a valid full auth token.");
      printTokenStatus(authKey);
      return;
    }

    console.log("");
    console.log("A partial auth token was received for 2FA verification.");
    if (showToken) {
      console.log("");
      console.log("Partial auth token for web-app 2FA testing:");
      console.log(authKey);
      console.log("");
      console.log("Paste this into the web app's Auth token login mode to test token + 2FA.");
    }

    try {
      await generate2FACodeWithDebug(authKey, "SMS");
      console.log("A 2FA verification code was requested.");
    } catch (error) {
      const message = getErrorMessage(error);
      console.log("2FA generation returned:");
      console.log(message);
      console.log("Continuing anyway in case Picnic already sent a code.");
    }

    const code = (await rl.question("2FA code: ")).trim();
    const verifyResult = await client.auth.verify2FACode(code);
    const finalToken = verifyResult.authKey || client.authKey;
    if (!finalToken) throw new Error("2FA succeeded but no final auth token was returned.");
    await validateAuthKey(finalToken);
    console.log("Credential login + 2FA produced a valid full auth token.");
    printTokenStatus(finalToken);
  } finally {
    rl.close();
  }
}

try {
  if (mode === "token") {
    await runTokenMode();
  } else if (mode === "login") {
    await runLoginMode();
  } else {
    throw new Error(`Unknown mode "${mode}". Use "login" or "token".`);
  }
} catch (error) {
  console.error("");
  console.error("Auth probe failed:");
  console.error(getErrorMessage(error));
  process.exit(1);
}

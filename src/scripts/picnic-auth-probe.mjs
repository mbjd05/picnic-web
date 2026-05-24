import { createHash } from "node:crypto";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

import PicnicClient from "picnic-api";

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

This script prints the resulting auth token. Do not paste its output into logs
or upstream PRs.
*/

const mode = process.argv[2] ?? "login";
const countryCode = process.env.PICNIC_COUNTRY_CODE ?? "NL";
const apiVersion = process.env.PICNIC_API_VERSION ?? "17";

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

function printToken(authKey) {
  console.log("");
  console.log("Auth token:");
  console.log(authKey);
  console.log("");
  console.log(`SHA-256 prefix: ${createHash("sha256").update(authKey).digest("hex").slice(0, 16)}`);
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
    printToken(token);
    return;
  } catch (error) {
    console.log("Token is not accepted as a full auth token.");
    console.log(getErrorMessage(error));
  }

  const client = createClient(token);
  try {
    await client.auth.generate2FACode("SMS");
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
    printToken(finalToken);
  } finally {
    rl.close();
  }
}

async function runLoginMode() {
  const rl = createInterface({ input, output });
  try {
    const email = (process.env.PICNIC_EMAIL ?? await rl.question("Email: ")).trim();
    const password = process.env.PICNIC_PASSWORD ?? await promptHidden(rl, "Password: ");

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
      printToken(authKey);
      return;
    }

    console.log("");
    console.log("Partial auth token for web-app 2FA testing:");
    console.log(authKey);
    console.log("");
    console.log("Paste this into the web app's Auth token login mode to test token + 2FA.");

    try {
      await client.auth.generate2FACode("SMS");
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
    printToken(finalToken);
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

import { createHmac } from "crypto";
import { getCookie } from "@tanstack/react-start/server";

export const DRIVER_SESSION_COOKIE = "tcb_driver_session";

function secret() {
  const value = process.env.DRIVER_SESSION_SECRET;
  if (!value) throw new Error("Driver authentication is not configured");
  return value;
}

export function makeDriverSession(expiresAt: number) {
  const payload = String(expiresAt);
  return `${payload}.${createHmac("sha256", secret()).update(payload).digest("hex")}`;
}

export function isValidDriverSession(value = getCookie(DRIVER_SESSION_COOKIE)) {
  if (!value) return false;
  const [expires, signature] = value.split(".");
  if (!expires || !signature || Number(expires) <= Date.now()) return false;
  const expected = createHmac("sha256", secret()).update(expires).digest("hex");
  if (signature.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < signature.length; i++) diff |= signature.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0;
}

export function requireDriverSession() {
  if (!isValidDriverSession()) throw new Error("UNAUTHORIZED");
}
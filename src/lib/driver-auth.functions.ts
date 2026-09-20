import { createServerFn } from "@tanstack/react-start";
import { setCookie } from "@tanstack/react-start/server";
import { z } from "zod";

export const loginDriver = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ pin: z.string().min(1).max(128) }).parse(input))
  .handler(async ({ data }) => {
    const expected = process.env.DRIVER_KEY;
    if (!expected || data.pin.length !== expected.length) throw new Error("UNAUTHORIZED");
    let diff = 0;
    for (let i = 0; i < data.pin.length; i++) diff |= data.pin.charCodeAt(i) ^ expected.charCodeAt(i);
    if (diff !== 0) throw new Error("UNAUTHORIZED");
    const { DRIVER_SESSION_COOKIE, makeDriverSession } = await import("./driver-auth.server");
    const maxAge = 60 * 60 * 24 * 30;
    setCookie(DRIVER_SESSION_COOKIE, makeDriverSession(Date.now() + maxAge * 1000), {
      httpOnly: true,
      secure: true,
      sameSite: "strict",
      path: "/",
      maxAge,
    });
    return { ok: true };
  });

export const checkDriverSession = createServerFn({ method: "GET" }).handler(async () => {
  const { isValidDriverSession } = await import("./driver-auth.server");
  return { authenticated: isValidDriverSession() };
});
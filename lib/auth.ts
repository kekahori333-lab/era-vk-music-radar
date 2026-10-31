import { createHmac, timingSafeEqual, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
export const COOKIE = "era_session";
export function equal(a: string, b: string) {
  const x = Buffer.from(a),
    y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}
function secret() {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 32)
    throw new Error("SESSION_SECRET должен содержать не менее 32 символов");
  return s;
}
export function signSession() {
  const payload = `${Date.now() + 8 * 3600000}.${randomBytes(16).toString("hex")}`;
  return `${payload}.${createHmac("sha256", secret()).update(payload).digest("hex")}`;
}
export function verifySession(value: string) {
  try {
    const parts = value.split(".");
    if (parts.length !== 3 || !/^\d+$/.test(parts[0])) return false;
    const payload = parts.slice(0, 2).join(".");
    return (
      Number(parts[0]) > Date.now() &&
      equal(
        parts[2],
        createHmac("sha256", secret()).update(payload).digest("hex"),
      )
    );
  } catch {
    return false;
  }
}
export async function isAdmin() {
  return verifySession((await cookies()).get(COOKIE)?.value ?? "");
}
export function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin || origin === "null") return false;
  try {
    const supplied = new URL(origin);
    if (process.env.APP_ORIGIN)
      return origin === new URL(process.env.APP_ORIGIN).origin;
    const target = new URL(request.url);
    // Next.js may normalize request.url to the bind address. Browser Host remains authoritative.
    return (
      supplied.host === (request.headers.get("host") || target.host) &&
      supplied.protocol === target.protocol
    );
  } catch {
    return false;
  }
}
export function cronAllowed(request: Request) {
  const key = process.env.CRON_SECRET;
  return (
    !!key &&
    key.length >= 32 &&
    equal(request.headers.get("authorization") ?? "", `Bearer ${key}`)
  );
}

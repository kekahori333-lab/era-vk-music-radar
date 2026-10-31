import { db } from "@/lib/db";
import { COOKIE, equal, sameOrigin, signSession } from "@/lib/auth";
import { cookies } from "next/headers";
export async function POST(request: Request) {
  if (!sameOrigin(request))
    return Response.json(
      { error: "Недопустимый источник запроса" },
      { status: 403 },
    );
  if (
    !process.env.ADMIN_PASSWORD ||
    process.env.ADMIN_PASSWORD.length < 12 ||
    !process.env.SESSION_SECRET ||
    process.env.SESSION_SECRET.length < 32
  )
    return Response.json(
      {
        error:
          "Администратор не настроен: нужны ADMIN_PASSWORD (от 12 символов) и SESSION_SECRET (от 32)",
      },
      { status: 503 },
    );
  try {
    // Global persistent throttle avoids trusting spoofable forwarded IP headers.
    const row = (
      await db().query(
        `INSERT INTO login_attempts(key,attempts) VALUES('admin',1) ON CONFLICT(key) DO UPDATE SET attempts=CASE WHEN login_attempts.window_start<now()-interval '15 minutes' THEN 1 ELSE login_attempts.attempts+1 END,window_start=CASE WHEN login_attempts.window_start<now()-interval '15 minutes' THEN now() ELSE login_attempts.window_start END RETURNING attempts`,
      )
    ).rows[0];
    if (row.attempts > 10)
      return Response.json(
        { error: "Слишком много попыток. Повторите через 15 минут." },
        { status: 429, headers: { "Retry-After": "900" } },
      );
    const { password } = await request.json();
    if (
      typeof password !== "string" ||
      !equal(password, process.env.ADMIN_PASSWORD)
    )
      return Response.json({ error: "Неверный пароль" }, { status: 401 });
    (await cookies()).set(COOKIE, signSession(), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
      maxAge: 8 * 3600,
    });
    return Response.json({ ok: true });
  } catch {
    return Response.json(
      { error: "Не удалось войти. Проверьте подключение к PostgreSQL." },
      { status: 503 },
    );
  }
}

"use client";
import { useEffect, useState } from "react";
import {
  ArrowLeft,
  LoaderCircle,
  LockKeyhole,
  Play,
  ShieldCheck,
} from "lucide-react";
import type { ProbeReport } from "@/lib/vk-probe";
type Status = {
  vkConfigured: boolean;
  walls: number[];
  runs: {
    id: number;
    started_at: string;
    status: string;
    posts: number;
    error: string | null;
    truncated: boolean;
  }[];
};
export default function Admin() {
  const [password, setPassword] = useState(""),
    [status, setStatus] = useState<Status | null>(null),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [checking, setChecking] = useState(true);
  const [probe, setProbe] = useState<ProbeReport | null>(null);
  async function checkVk() {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/admin/vk/probe", { method: "POST" });
      const data = await response.json();
      if (response.ok) setProbe(data);
      else setMessage(data.error);
    } catch {
      setMessage("Не удалось проверить подключение VK");
    } finally {
      setBusy(false);
    }
  }
  async function refresh() {
    try {
      const r = await fetch("/api/admin/status");
      const data = await r.json();
      if (r.ok) setStatus(data);
      else if (r.status !== 401) setMessage(data.error);
    } catch {
      setMessage("Сервер недоступен");
    } finally {
      setChecking(false);
    }
  }
  useEffect(() => {
    void refresh();
  }, []);
  async function login(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const r = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const d = await r.json();
      if (!r.ok) setMessage(d.error);
      else {
        setPassword("");
        await refresh();
      }
    } catch {
      setMessage("Ошибка подключения");
    } finally {
      setBusy(false);
    }
  }
  async function collect() {
    setBusy(true);
    setMessage("Сбор выполняется. Не закрывайте страницу.");
    try {
      const r = await fetch("/api/admin/collect", { method: "POST" });
      const d = await r.json();
      setMessage(
        r.ok
          ? `Сбор завершён. Обработано публикаций: ${d.posts}${d.truncated ? " · Выборка ограничена лимитом страниц" : ""}`
          : d.error,
      );
      await refresh();
    } catch {
      setMessage(
        "Соединение прервано. Проверьте журнал запусков перед повторным сбором.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="admin-page">
      <a href="/" className="admin-actions">
        <ArrowLeft size={15} />
        Вернуться к радару
      </a>
      <h1>
        <ShieldCheck size={28} />
        Администрирование
      </h1>
      {checking ? (
        <p>Проверяем сессию…</p>
      ) : !status ? (
        <section className="panel">
          <div className="eyebrow">
            <LockKeyhole size={14} />
            ЗАЩИЩЁННЫЙ ДОСТУП
          </div>
          <h2>Вход администратора</h2>
          <p>Управление сбором и журнал запусков доступны после входа.</p>
          <form onSubmit={login}>
            <label>
              Пароль
              <input
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                maxLength={256}
              />
            </label>
            <button className="button" disabled={busy}>
              {busy ? (
                <LoaderCircle className="spin" size={15} />
              ) : (
                <LockKeyhole size={15} />
              )}
              Войти
            </button>
          </form>
        </section>
      ) : (
        <>
          <section className="panel">
            <h2>Сбор публикаций VK</h2>
            <div className="admin-status">
              <span>
                Токен: {status.vkConfigured ? "настроен" : "не настроен"}
              </span>
              <span>Стен: {status.walls.length}</span>
            </div>
            <p>
              Сбор использует только разрешённые публичные стены и доступные
              музыкальные вложения. Секреты задаются на сервере через переменные
              окружения; интерфейс не раскрывает их значения.
            </p>
            <p>
              Страница подключается через официальный токен приложения VK.
              Пароль от страницы и коды подтверждения здесь не запрашиваются.
              Токен добавляется в защищённые настройки сервера.
            </p>
            <div className="admin-actions">
              <button
                className="button muted"
                onClick={checkVk}
                disabled={busy}
              >
                Проверить подключение VK
              </button>
              <button
                className="button"
                disabled={busy || !status.vkConfigured || !status.walls.length}
                onClick={collect}
              >
                {busy ? (
                  <LoaderCircle className="spin" size={15} />
                ) : (
                  <Play size={15} />
                )}
                Запустить сбор
              </button>
              <button
                className="button muted"
                disabled={busy}
                onClick={async () => {
                  await fetch("/api/admin/logout", { method: "POST" });
                  setStatus(null);
                  setProbe(null);
                }}
              >
                Выйти
              </button>
            </div>
          </section>
          {probe && (
            <section className="panel" aria-live="polite">
              <h2>Результат проверки VK</h2>
              {!probe.configured ? (
                <p>
                  Подключения пока нет. Добавьте VK_ACCESS_TOKEN в защищённые
                  настройки среды и перезапустите сервис.
                </p>
              ) : (
                <>
                  {probe.profile ? (
                    <p>
                      Владелец токена:{" "}
                      <a
                        href={probe.profile.url}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {probe.profile.name}
                      </a>
                    </p>
                  ) : (
                    <p>
                      Личная страница не определена. Возможности методов
                      проверяются отдельно.
                    </p>
                  )}
                  {probe.checks.map((check) => (
                    <p key={check.method}>
                      <strong>{check.method}</strong>: {check.message}
                      {check.posts !== undefined &&
                        ` Публикаций: ${check.posts}, аудиовложений: ${check.audio}.`}
                    </p>
                  ))}
                </>
              )}
              <p>{probe.coverage}</p>
            </section>
          )}
          <section className="panel">
            <h2>Журнал запусков</h2>
            {!status.runs.length ? (
              <p>Сбор ещё не запускался.</p>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>ДАТА</th>
                      <th>СТАТУС</th>
                      <th>ПОСТЫ</th>
                      <th>ПРИМЕЧАНИЕ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {status.runs.map((r) => (
                      <tr key={r.id}>
                        <td>
                          {new Date(r.started_at).toLocaleString("ru-RU")}
                        </td>
                        <td>
                          {{
                            success: "Завершён",
                            failed: "Ошибка",
                            running: "Выполняется",
                          }[r.status] || r.status}
                        </td>
                        <td>{r.posts}</td>
                        <td>
                          {r.error || (r.truncated ? "Лимит страниц" : "—")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
      {message && (
        <div role="status" className="admin-message">
          {message}
        </div>
      )}
    </main>
  );
}

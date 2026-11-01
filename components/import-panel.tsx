"use client";
import { useState, useRef } from "react";
import { Upload, FileDown, LoaderCircle, CheckCircle2 } from "lucide-react";
type Preview = {
  rows: number;
  posts: number;
  tracks: number;
  from: string;
  to: string;
  sample: { artist: string; title: string; url: string; date: string }[];
};
export default function ImportPanel({
  onImported,
}: {
  onImported: () => Promise<void>;
}) {
  const [file, setFile] = useState<File | null>(null),
    [source, setSource] = useState(""),
    [confirmed, setConfirmed] = useState(false),
    [preview, setPreview] = useState<Preview | null>(null),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  const input = useRef<HTMLInputElement>(null);
  async function submit(checkOnly: boolean) {
    if (!file) return;
    setBusy(true);
    setMessage("");
    try {
      const csv = await file.text();
      const r = await fetch("/api/admin/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csv, source, preview: checkOnly, confirmed }),
      });
      const data = await r.json();
      if (!r.ok) {
        setPreview(null);
        setMessage(data.error || "Не удалось импортировать CSV");
        return;
      }
      if (checkOnly) {
        setPreview(data.preview);
        setMessage("Файл проверен. Проверьте сводку и подтвердите импорт.");
      } else {
        setPreview(null);
        setFile(null);
        setConfirmed(false);
        if (input.current) input.current.value = "";
        setMessage(
          `Импорт завершён: новых постов ${data.newPosts}, новых связей с треками ${data.newLinks}. Повторные строки не увеличивают счётчики.`,
        );
        await onImported();
      }
    } catch {
      setMessage(
        "Соединение прервано. Импорт можно повторить: уже сохранённые строки не дублируются.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="panel import-panel">
      <div className="eyebrow">
        <Upload size={15} />
        РАБОТА БЕЗ ТОКЕНА VK
      </div>
      <h2>Импорт реальных публикаций</h2>
      <p>
        Загрузите свою разрешённую выгрузку CSV. Рейтинг будет рассчитан по ней,
        а источник данных будет явно указан на главной странице. Сервис не
        проверяет существование постов и наличие музыки через VK API.
      </p>
      <a href="/api/admin/import/template" className="button muted">
        <FileDown size={15} />
        Скачать пустой шаблон CSV
      </a>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void submit(true);
        }}
      >
        <label>
          Название источника
          <input
            value={source}
            disabled={busy}
            minLength={3}
            maxLength={100}
            required
            placeholder="Например: отчёт нашего лейбла за ноябрь"
            onChange={(e) => {
              setSource(e.target.value);
              setPreview(null);
            }}
          />
        </label>
        <label>
          Файл CSV · UTF-8 · до 2 МБ и 5000 строк
          <input
            ref={input}
            type="file"
            accept=".csv,text/csv"
            disabled={busy}
            required
            onChange={(e) => {
              const f = e.target.files?.[0] ?? null;
              setPreview(null);
              setConfirmed(false);
              setMessage("");
              if (f && f.size > 2 * 1024 * 1024) {
                setFile(null);
                setMessage("Файл больше 2 МБ.");
                e.target.value = "";
              } else setFile(f);
            }}
          />
        </label>
        <p>
          Одна строка — один трек в одном посте. Колонки: исполнитель, трек,
          дата, ссылка, автор, репост. Дата — ISO 8601 с часовым поясом; автор —
          числовой VK ID; репост — 1/0. Ссылка — HTTPS-адрес wall-поста VK.
        </p>
        <button
          className="button"
          disabled={busy || !file || source.trim().length < 3}
        >
          {busy ? (
            <LoaderCircle size={15} className="spin" />
          ) : (
            <CheckCircle2 size={15} />
          )}
          Проверить файл
        </button>
      </form>
      {preview && (
        <div className="import-preview">
          <h3>Предпросмотр</h3>
          <p>
            Строк: {preview.rows} · Уникальных постов: {preview.posts} · Треков:{" "}
            {preview.tracks}
          </p>
          <p>
            Период файла: {new Date(preview.from).toLocaleString("ru-RU")} —{" "}
            {new Date(preview.to).toLocaleString("ru-RU")}. В рейтинг выбранного
            периода попадут только соответствующие ему посты.
          </p>
          <ul>
            {preview.sample.map((row, i) => (
              <li key={i}>
                {row.artist} — {row.title}{" "}
                <a href={row.url} target="_blank" rel="noreferrer">
                  Публикация
                </a>
              </li>
            ))}
          </ul>
          <label className="import-confirm">
            <input
              type="checkbox"
              checked={confirmed}
              disabled={busy}
              onChange={(e) => setConfirmed(e.target.checked)}
            />
            Подтверждаю: это реальные публикации и корректные сведения о треках;
            у меня есть право использовать эту выгрузку.
          </label>
          <button
            className="button"
            disabled={busy || !confirmed}
            onClick={() => void submit(false)}
          >
            <Upload size={15} />
            Импортировать в рейтинг
          </button>
        </div>
      )}
      {message && (
        <p className="admin-message" role="status">
          {message}
        </p>
      )}
    </section>
  );
}

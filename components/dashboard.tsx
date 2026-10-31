"use client";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowDownToLine,
  ArrowRight,
  ArrowUp,
  AudioLines,
  ChartNoAxesCombined,
  ChevronDown,
  Clock3,
  Disc3,
  ExternalLink,
  Flame,
  Info,
  LayoutDashboard,
  LoaderCircle,
  Menu,
  Radio,
  Search,
  ShieldCheck,
  Users,
  X,
} from "lucide-react";
import type { Radar, Track } from "@/lib/radar";
const fmt = (n: number) => new Intl.NumberFormat("ru-RU").format(n);
function Spark({
  values,
  dates,
  large = false,
}: {
  values: number[];
  dates?: string[];
  large?: boolean;
}) {
  const max = Math.max(1, ...values);
  const timestamps = dates?.map((day) => Date.parse(day)) ?? [];
  const first = timestamps[0] ?? 0;
  const span = (timestamps.at(-1) ?? 0) - first;
  const x = (i: number) =>
    values.length === 1
      ? 50
      : span > 0
        ? ((timestamps[i] - first) * 100) / span
        : (i * 100) / Math.max(1, values.length - 1);
  const points = values
    .map((v, i) => `${x(i)},${38 - (v / max) * 32}`)
    .join(" ");
  return (
    <svg
      viewBox="0 0 100 42"
      preserveAspectRatio="none"
      className={large ? "spark large" : "spark"}
      role="img"
      aria-label="Динамика публикаций"
    >
      {values.length === 1 && (
        <circle
          cx="50"
          cy={38 - (values[0] / max) * 32}
          r="1.5"
          fill="currentColor"
        />
      )}
      <polyline
        points={points}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
export default function Dashboard() {
  const [period, setPeriod] = useState(1),
    [limit, setLimit] = useState(100),
    [query, setQuery] = useState(""),
    [search, setSearch] = useState(""),
    [section, setSection] = useState("radar"),
    [data, setData] = useState<Radar | null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [selected, setSelected] = useState<Track | null>(null),
    [menu, setMenu] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setSearch(query), 300);
    return () => clearTimeout(timer);
  }, [query]);
  useEffect(() => {
    if (!selected) return;
    const previous = document.activeElement as HTMLElement | null;
    const modal = document.querySelector<HTMLElement>('[role="dialog"]');
    const focusable = () =>
      Array.from(
        modal?.querySelectorAll<HTMLElement>("button, a[href], input") ?? [],
      );
    focusable()[0]?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSelected(null);
      if (event.key !== "Tab") return;
      const items = focusable();
      const first = items[0],
        last = items.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      previous?.focus();
    };
  }, [selected]);
  const params = useMemo(
    () =>
      new URLSearchParams({
        period: String(period),
        limit: String(limit),
        q: search,
        hits: section === "hits" ? "1" : "0",
      }).toString(),
    [period, limit, search, section],
  );
  useEffect(() => {
    const abort = new AbortController();
    setLoading(true);
    setError("");
    fetch(`/api/radar?${params}`, { signal: abort.signal })
      .then(async (r) => {
        const body = await r.json();
        setData(body);
        if (!r.ok) setError(body.message || "Не удалось загрузить данные");
      })
      .catch((e) => {
        if (e.name !== "AbortError")
          setError(
            "Не удалось связаться с сервером. Попробуйте обновить страницу.",
          );
      })
      .finally(() => {
        if (!abort.signal.aborted) setLoading(false);
      });
    return () => abort.abort();
  }, [params]);
  const summary = data?.summary;
  const last = data?.lastRun;
  const cards = [
    {
      label: "Публикации с музыкой",
      value: summary?.publications,
      icon: AudioLines,
      caption: "В наблюдаемой выборке",
    },
    {
      label: "Оригинальные посты",
      value: summary?.originals,
      icon: Disc3,
      caption: "Без учёта репостов",
    },
    {
      label: "Репосты",
      value: summary?.reposts,
      icon: ArrowRight,
      caption: "Публикации с copy_history",
    },
    {
      label: "Уникальные авторы",
      value: summary?.authors,
      icon: Users,
      caption: "По идентификатору автора",
    },
  ];
  return (
    <div className="shell">
      <aside className={menu ? "sidebar open" : "sidebar"}>
        <a className="brand" href="/">
          ЭРА
          <span className="brand-dot" />
        </a>
        <div className="brand-sub">МУЗЫКАЛЬНАЯ АНАЛИТИКА</div>
        <div className="workspace">
          <div className="workspace-icon">
            <AudioLines size={21} />
          </div>
          <div>
            VK Music Radar<small>Панель аналитики</small>
          </div>
          <span className="version">v1.0</span>
        </div>
        <div className="nav-label">ОБЗОР</div>
        <nav>
          <button
            className={section === "radar" ? "active" : ""}
            onClick={() => {
              setSection("radar");
              setMenu(false);
            }}
          >
            <LayoutDashboard size={18} />
            Музыкальный радар
            <span className="nav-indicator" />
          </button>
          <button
            className={section === "hits" ? "active" : ""}
            onClick={() => {
              setSection("hits");
              setMenu(false);
            }}
          >
            <Flame size={18} />
            Новые хиты
          </button>
          <button
            className={section === "method" ? "active" : ""}
            onClick={() => {
              setSection("method");
              setMenu(false);
            }}
          >
            <ChartNoAxesCombined size={18} />О данных
          </button>
        </nav>
        <div className="sidebar-bottom">
          <div className="source-box">
            <div>
              <span className="status-dot" /> Официальный VK API
            </div>
            <p>
              Прозрачные источники.
              <br />
              Реальные наблюдения.
            </p>
          </div>
          <a href="/admin">
            <ShieldCheck size={17} />
            Администрирование
            <ArrowRight size={15} />
          </a>
          <span className="copyright">
            © {new Date().getFullYear()} ЭРА · Аналитика музыки
          </span>
        </div>
      </aside>
      <div className="main">
        <header className="topbar">
          <div className="mobile-brand">
            <button onClick={() => setMenu(!menu)} aria-label="Открыть меню">
              {menu ? <X /> : <Menu />}
            </button>
            <b>ЭРА</b>
          </div>
          <div className="breadcrumb">
            Аналитика <span>/</span> <strong>VK Music Radar</strong>
          </div>
          <div className="topbar-right">
            <span className="live-tag">
              <span className="status-dot" />
              {last?.status === "success" ? "Сбор выполнен" : "Ожидание данных"}
            </span>
            <span className="avatar">Э</span>
          </div>
        </header>
        <main>
          <div className="page-heading">
            <div>
              <div className="eyebrow">
                <Radio size={14} /> МУЗЫКА В ЦИФРАХ
              </div>
              <h1>
                {section === "hits"
                  ? "Новые хиты"
                  : section === "method"
                    ? "О данных"
                    : "Музыкальный радар"}
                <span className="vk-badge">VK</span>
              </h1>
              <p>
                {section === "hits"
                  ? "Треки, которые набирают популярность в наблюдаемой выборке."
                  : "Следите за музыкой, которая звучит во ВКонтакте."}
              </p>
            </div>
            <a className="button export" href={`/api/export?${params}`}>
              <ArrowDownToLine size={16} />
              Экспорт CSV
            </a>
          </div>
          <div className="coverage">
            <Info size={17} />
            <div>
              <strong>Честная аналитика</strong>
              <span>
                {data?.coverage ||
                  "Рейтинг строится только по настроенным публичным стенам, а не по всему ВКонтакте."}
              </span>
            </div>
            <span className="coverage-badge">ОГРАНИЧЕННЫЙ ОХВАТ</span>
          </div>
          {last &&
            (last.status !== "success" ||
              last.truncated ||
              Date.now() - new Date(last.finished_at).getTime() >
                36 * 3600000) && (
              <div className="coverage" role="status">
                <Info size={17} />
                <span>
                  {last.status !== "success"
                    ? "Последний сбор не завершён успешно. Показаны накопленные наблюдения; выборка может быть неполной."
                    : last.truncated
                      ? "Достигнут лимит страниц VK. Часть публикаций не загружена."
                      : "Данные не обновлялись более 36 часов. Рейтинг может быть неполным."}
                </span>
              </div>
            )}
          {section === "method" ? (
            <section className="panel methodology">
              <h2>Как устроен радар</h2>
              <p>
                Мы учитываем только публикации с музыкальными вложениями,
                полученные официальным VK API с настроенных администратором
                публичных стен. Полнота выдачи зависит от прав приложения,
                доступности стен и вложений.
              </p>
              <h3>Что означает рейтинг</h3>
              <p>
                Один пост даёт треку одну публикацию. Повторное аудиовложение в
                том же посте не увеличивает счётчик. Идентичность трека
                определяется парой owner_id / audio_id: разные загрузки одной
                песни могут отображаться отдельно. Для репостов учитываются
                также доступные вложения copy_history.
              </p>
              <h3>Периоды и динамика</h3>
              <p>
                24 часа, 7 и 30 дней — скользящие интервалы. Позиция
                сравнивается с сохранённым вчера рейтингом того же периода. Рост
                сравнивает два соседних равных интервала; при короткой истории
                сравнение неполно. «Новые хиты»: минимум 3 публикации и рост от
                50%, либо отсутствие публикаций в прошлом интервале. Доступная
                история зависит от времени начала наблюдения; первичная загрузка
                ограничена 30 днями.
              </p>
              <h3>Ограничения источника</h3>
              <p>
                Глобальный поиск newsfeed.search проверяется отдельно вашим
                токеном и не используется для заявления о полном охвате VK.
                Недоступные или скрытые аудиовложения не восстанавливаются. Сбор
                сохраняет наблюдения; удалённые после сбора публикации могут
                оставаться в истории.
              </p>
              <a
                href="https://dev.vk.com/ru/method/wall.get"
                target="_blank"
                rel="noreferrer"
              >
                Документация VK API <ExternalLink size={14} />
              </a>
            </section>
          ) : (
            <>
              <section className="metrics">
                {cards.map(({ label, value, icon: Icon, caption }) => (
                  <div className="metric" key={label}>
                    <div className="metric-top">
                      <span>{label}</span>
                      <Icon size={18} />
                    </div>
                    <div className="metric-value">
                      {data?.available && last ? fmt(value ?? 0) : "—"}
                    </div>
                    <div className="metric-caption">
                      <span className="tiny-line" />
                      {caption}
                    </div>
                  </div>
                ))}
              </section>
              <section className="panel ranking">
                <div className="panel-heading">
                  <div>
                    <div className="title-line">
                      <h2>
                        {section === "hits"
                          ? "На волне роста"
                          : "Рейтинг треков"}
                      </h2>
                      <span className="count-badge">
                        {data?.tracks.length ?? 0}
                      </span>
                    </div>
                    <p>По количеству публикаций с аудиовложениями</p>
                  </div>
                  <div className="periods" aria-label="Период">
                    {[
                      [1, "24 часа"],
                      [7, "7 дней"],
                      [30, "30 дней"],
                    ].map(([n, label]) => (
                      <button
                        key={n}
                        className={period === n ? "chosen" : ""}
                        onClick={() => setPeriod(Number(n))}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="table-toolbar">
                  <div className="top-limits" aria-label="Размер рейтинга">
                    {[100, 500, 1000].map((n) => (
                      <button
                        key={n}
                        onClick={() => setLimit(n)}
                        className={limit === n ? "chosen" : ""}
                      >
                        ТОП-{n}
                      </button>
                    ))}
                  </div>
                  <label className="search">
                    <Search size={17} />
                    <input
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="Исполнитель или название трека"
                      aria-label="Поиск по исполнителю и названию"
                    />
                    {query && (
                      <button
                        onClick={() => setQuery("")}
                        aria-label="Очистить поиск"
                      >
                        <X size={15} />
                      </button>
                    )}
                  </label>
                </div>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th className="rank-col">#</th>
                        <th>ТРЕК / ИСПОЛНИТЕЛЬ</th>
                        <th>
                          ПУБЛИКАЦИИ <ArrowDown size={12} />
                        </th>
                        <th>ОРИГИНАЛЫ</th>
                        <th>РЕПОСТЫ</th>
                        <th>АВТОРЫ</th>
                        <th>ДИНАМИКА</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {!loading &&
                        !error &&
                        data?.tracks.map((t) => (
                          <tr key={t.id} onClick={() => setSelected(t)}>
                            <td className="rank-col">{t.position}</td>
                            <td>
                              <button
                                className="track-title"
                                onClick={() => setSelected(t)}
                              >
                                <span className="track-art">
                                  <AudioLines size={22} />
                                </span>
                                <span>
                                  <strong>{t.title}</strong>
                                  <small>{t.artist}</small>
                                </span>
                              </button>
                            </td>
                            <td className="publication-number">
                              {fmt(t.publications)}
                            </td>
                            <td>{fmt(t.originals)}</td>
                            <td>{fmt(t.reposts)}</td>
                            <td>{fmt(t.authors)}</td>
                            <td>
                              <div className="trend">
                                <Spark
                                  values={t.history.map((h) => h.publications)}
                                  dates={t.history.map((h) => h.day)}
                                />
                                <span
                                  className={
                                    t.previousPosition !== null &&
                                    t.previousPosition < t.position
                                      ? "negative"
                                      : "positive"
                                  }
                                >
                                  {t.previousPosition === null ? (
                                    "новый"
                                  ) : t.previousPosition === t.position ? (
                                    "—"
                                  ) : (
                                    <>
                                      {t.previousPosition > t.position ? (
                                        <ArrowUp size={12} />
                                      ) : (
                                        <ArrowDown size={12} />
                                      )}{" "}
                                      {Math.abs(
                                        t.previousPosition - t.position,
                                      )}
                                    </>
                                  )}
                                </span>
                              </div>
                            </td>
                            <td>
                              <ChevronDown size={15} />
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
                {(loading || error || !data?.tracks.length) && (
                  <div className="empty-state" role="status">
                    <div className="empty-visual">
                      {loading ? (
                        <LoaderCircle size={30} className="spin" />
                      ) : (
                        <Radio size={32} />
                      )}
                      <span />
                      <i />
                    </div>
                    <h3>
                      {loading
                        ? "Настраиваем частоту…"
                        : error
                          ? "Радар ожидает подключения"
                          : search
                            ? "Треки не найдены"
                            : section === "hits"
                              ? "Новые хиты пока не обнаружены"
                              : "Пока ни одного сигнала"}
                    </h3>
                    <p>
                      {loading
                        ? "Загружаем наблюдения из базы данных."
                        : error ||
                          (search
                            ? "Попробуйте другое имя исполнителя или название."
                            : "После первого сбора здесь появятся реальные треки, публикации и динамика. Никаких вымышленных показателей.")}
                    </p>
                    {!loading && !search && (
                      <a href="/admin" className="button muted">
                        Настроить сбор <ArrowRight size={15} />
                      </a>
                    )}
                  </div>
                )}
                <div className="table-footer">
                  <span>
                    Показано {data?.tracks.length ?? 0} из {data?.total ?? 0}{" "}
                    наблюдаемых треков
                  </span>
                  <span>
                    <Clock3 size={13} />
                    {last?.finished_at
                      ? `Последний сбор: ${new Date(last.finished_at).toLocaleString("ru-RU")}`
                      : "Сбор ещё не выполнялся"}
                  </span>
                </div>
              </section>
              <section className="bottom-grid">
                <div className="insight-card">
                  <span className="insight-icon">
                    <Flame size={22} />
                  </span>
                  <div>
                    <h3>Услышьте хит раньше остальных</h3>
                    <p>Отслеживайте треки с ростом публикаций от 50%.</p>
                  </div>
                  <button
                    aria-label="Перейти к новым хитам"
                    onClick={() => setSection("hits")}
                  >
                    <ArrowRight size={20} />
                  </button>
                </div>
                <div className="data-note">
                  <ShieldCheck size={22} />
                  <div>
                    <strong>Данные, которым можно доверять</strong>
                    <p>
                      Официальный API. Ссылки на публикации. Открытая
                      методология.
                    </p>
                  </div>
                </div>
              </section>
            </>
          )}
          <footer>
            <span>
              ЭРА <span className="footer-divider">|</span> VK Music Radar
            </span>
            <button onClick={() => setSection("method")}>
              Методология и источники <ExternalLink size={12} />
            </button>
          </footer>
        </main>
      </div>
      {selected && (
        <div className="modal-overlay" onClick={() => setSelected(null)}>
          <section
            className="modal panel"
            role="dialog"
            aria-modal="true"
            aria-label="Статистика трека"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="modal-close"
              onClick={() => setSelected(null)}
              aria-label="Закрыть"
            >
              <X />
            </button>
            <div className="eyebrow">КАРТОЧКА ТРЕКА</div>
            <h2>{selected.title}</h2>
            <p>{selected.artist}</p>
            <div className="detail-numbers">
              <div>
                <strong>{fmt(selected.publications)}</strong>
                <small>Публикаций</small>
              </div>
              <div>
                <strong>
                  {selected.growth === null
                    ? "—"
                    : `${selected.growth > 0 ? "+" : ""}${selected.growth}%`}
                </strong>
                <small>К прошлому периоду</small>
              </div>
            </div>
            <h3>Публикации за 30 дней · UTC</h3>
            {selected.history.length ? (
              <>
                <Spark
                  large
                  values={selected.history.map((h) => h.publications)}
                  dates={selected.history.map((h) => h.day)}
                />
                <div className="history-list">
                  {selected.history.map((h) => (
                    <span key={h.day}>
                      {h.day}: <b>{h.publications}</b>
                    </span>
                  ))}
                </div>
              </>
            ) : (
              <p>Недостаточно истории</p>
            )}
            <h3>Исходные публикации</h3>
            <div className="source-list">
              {selected.sources.map((s) => (
                <a key={s.url} href={s.url} target="_blank" rel="noreferrer">
                  <div>
                    {s.repost ? "Репост" : "Оригинальная публикация"}
                    <small>{new Date(s.date).toLocaleString("ru-RU")}</small>
                  </div>
                  <ExternalLink size={17} />
                </a>
              ))}
            </div>
            <p className="subtle">
              Последние 5 публикаций выбранного периода. История может быть
              неполной.
            </p>
          </section>
        </div>
      )}
    </div>
  );
}

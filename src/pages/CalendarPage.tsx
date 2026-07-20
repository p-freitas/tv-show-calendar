import { useEffect, useMemo, useRef } from "react";
import { Link, useRouter } from "../App";
import { EpisodeCard } from "../components/EpisodeCard";
import { FiltersPanel } from "../components/FiltersPanel";
import { Legend } from "../components/Legend";
import { CalendarSkeleton } from "../components/Skeleton";
import { DEFAULT_COUNTRY } from "../config/app";
import { useCalendarMonth } from "../hooks/useCalendarMonth";
import {
  addMonths,
  dateKeyInTimeZone,
  daysInMonth,
  getCurrentBrazilMonth,
  isoDate,
  monthTitle,
  toMonthPath,
} from "../lib/dates";
import { applyEpisodeFilters, getFilterOptions } from "../lib/filters";
import { useFilterStore } from "../state/filterStore";

function weekdayLabel(year: number, month: number, day: number) {
  return new Intl.DateTimeFormat("pt-BR", {
    weekday: "short",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, day, 12)));
}

function mondayFirstColumnIndex(year: number, month: number, day: number) {
  const sundayFirst = new Date(Date.UTC(year, month - 1, day, 12)).getUTCDay();
  return (sundayFirst + 6) % 7;
}

const weekdayHeaders = ["Seg.", "Ter.", "Qua.", "Qui.", "Sex.", "Sáb.", "Dom."];

export function CalendarPage({ year, month }: { year: number; month: number }) {
  const { navigate } = useRouter();
  const { filters } = useFilterStore();
  const todayRef = useRef<HTMLElement | null>(null);
  const lastScrolledMonthRef = useRef<string | null>(null);
  const safeMonth = month >= 1 && month <= 12 ? month : getCurrentBrazilMonth().month;
  const safeYear = year || getCurrentBrazilMonth().year;
  const previous = addMonths(safeYear, safeMonth, -1);
  const next = addMonths(safeYear, safeMonth, 1);
  const current = getCurrentBrazilMonth();
  const todayDateKey = dateKeyInTimeZone(new Date());
  const isCurrentMonth = safeYear === current.year && safeMonth === current.month;
  const query = useCalendarMonth(safeYear, safeMonth, DEFAULT_COUNTRY);

  const allEpisodes = query.data?.episodes ?? [];
  const filteredEpisodes = useMemo(() => applyEpisodeFilters(allEpisodes, filters), [allEpisodes, filters]);
  const options = useMemo(() => getFilterOptions(allEpisodes), [allEpisodes]);

  const episodesByDay = useMemo(() => {
    const map = new Map<string, typeof filteredEpisodes>();
    filteredEpisodes.forEach((episode) => {
      const currentDay = map.get(episode.brazilianDateKey) ?? [];
      currentDay.push(episode);
      map.set(episode.brazilianDateKey, currentDay);
    });
    return map;
  }, [filteredEpisodes]);

  const dayList = Array.from({ length: daysInMonth(safeYear, safeMonth) }, (_, index) => index + 1);
  const leadingEmptyDays = Array.from({ length: mondayFirstColumnIndex(safeYear, safeMonth, 1) }, (_, index) => index);

  useEffect(() => {
    if (!isCurrentMonth) {
      lastScrolledMonthRef.current = null;
      return;
    }

    const monthKey = `${safeYear}-${safeMonth}`;
    if (query.isLoading || query.isError || lastScrolledMonthRef.current === monthKey) return;

    const frame = window.requestAnimationFrame(() => {
      const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      todayRef.current?.scrollIntoView({
        behavior: prefersReducedMotion ? "auto" : "smooth",
        block: "center",
        inline: "nearest",
      });
      lastScrolledMonthRef.current = monthKey;
    });

    return () => window.cancelAnimationFrame(frame);
  }, [isCurrentMonth, query.isError, query.isLoading, safeMonth, safeYear]);

  return (
    <main className="page-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Calendário de séries</p>
          <h1>{monthTitle(safeYear, safeMonth)}</h1>
        </div>
        <nav className="month-nav" aria-label="Navegação de meses">
          <button type="button" onClick={() => navigate(toMonthPath(previous.year, previous.month))} title="Mês anterior">
            &lt;
          </button>
          <button type="button" onClick={() => navigate(toMonthPath(current.year, current.month))}>
            Hoje
          </button>
          <button type="button" onClick={() => navigate(toMonthPath(next.year, next.month))} title="Próximo mês">
            &gt;
          </button>
        </nav>
      </header>

      <div className="calendar-layout">
        <aside className="filters-sidebar" aria-label="Filtros do calendário">
          <FiltersPanel options={options} visibleCount={filteredEpisodes.length} totalCount={allEpisodes.length} />
          <Legend />
        </aside>

        <div className="calendar-content">
          {query.isError ? (
            <section className="empty-state">
              <h2>Não foi possível carregar este mês</h2>
              <p>{query.error instanceof Error ? query.error.message : "Falha ao consultar o PogDesign."}</p>
              <button className="primary-button" type="button" onClick={() => void query.refetch()}>
                Tentar novamente
              </button>
            </section>
          ) : null}

          {query.isLoading ? <CalendarSkeleton /> : null}

          {!query.isLoading && !query.isError ? (
            <section className="calendar-grid" aria-label={`Calendário de ${monthTitle(safeYear, safeMonth)}`}>
              {weekdayHeaders.map((label) => (
                <div className="weekday-column-header" key={label}>
                  {label}
                </div>
              ))}
              {leadingEmptyDays.map((index) => (
                <div className="day-block day-placeholder" aria-hidden="true" key={`placeholder-${index}`} />
              ))}
              {dayList.map((day) => {
                const dateKey = isoDate(safeYear, safeMonth, day);
                const episodes = episodesByDay.get(dateKey) ?? [];
                const isToday = dateKey === todayDateKey;
                return (
                  <article
                    aria-current={isToday ? "date" : undefined}
                    className={`day-block${isToday ? " day-block-today" : ""}`}
                    key={dateKey}
                    ref={isToday ? todayRef : undefined}
                  >
                    <header className="day-header">
                      <span>{day}</span>
                      <strong>{isToday ? "Hoje" : weekdayLabel(safeYear, safeMonth, day)}</strong>
                    </header>
                    <div className="episode-stack">
                      {episodes.length > 0 ? (
                        episodes.map((episode) => <EpisodeCard key={episode.episodeId} episode={episode} />)
                      ) : (
                        <span className="no-episodes">sem episódios</span>
                      )}
                    </div>
                  </article>
                );
              })}
            </section>
          ) : null}
        </div>
      </div>

      <footer className="footer-note">
        Dados do calendário público do{" "}
        <a href="https://www.pogdesign.co.uk/cat/" target="_blank" rel="noreferrer">
          PogDesign
        </a>
        .
      </footer>
    </main>
  );
}

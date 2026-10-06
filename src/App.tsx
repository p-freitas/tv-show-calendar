import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { CalendarPage } from "./pages/CalendarPage";
import { EpisodePage } from "./pages/EpisodePage";
import { SeriesPage } from "./pages/SeriesPage";
import { NotificationsPage } from "./pages/NotificationsPage";
import { SiteHeader } from "./components/SiteHeader";
import { NotificationsProvider } from "./state/NotificationsProvider";
import { getCurrentBrazilMonth, toMonthPath } from "./lib/dates";

type RouterContextValue = {
  path: string;
  search: string;
  navigate: (path: string) => void;
};

const RouterContext = createContext<RouterContextValue | null>(null);

export function useRouter() {
  const context = useContext(RouterContext);
  if (!context) throw new Error("useRouter precisa estar dentro do App.");
  return context;
}

export function Link({
  href,
  children,
  className,
  title,
  onNavigate,
}: {
  href: string;
  children: ReactNode;
  className?: string;
  title?: string;
  onNavigate?: () => void;
}) {
  const { navigate } = useRouter();
  return (
    <a
      className={className}
      href={href}
      title={title}
      onClick={(event) => {
        if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        event.preventDefault();
        onNavigate?.();
        navigate(href);
      }}
    >
      {children}
    </a>
  );
}

function parseRoute(path: string) {
  if (/^\/notifications\/?$/.test(path)) return { name: "notifications" as const };
  const calendarMatch = path.match(/^\/calendar\/(\d{4})\/(\d{1,2})\/?$/);
  if (calendarMatch) {
    return {
      name: "calendar" as const,
      year: Number(calendarMatch[1]),
      month: Number(calendarMatch[2]),
    };
  }

  const seriesMatch = path.match(/^\/series\/(\d+)\/?$/);
  if (seriesMatch) return { name: "series" as const, showId: Number(seriesMatch[1]) };

  const calendarEpisodeMatch = path.match(/^\/episode\/(\d{4})\/(\d{1,2})\/(\d+)\/?$/);
  if (calendarEpisodeMatch) {
    return {
      name: "calendarEpisode" as const,
      year: Number(calendarEpisodeMatch[1]),
      month: Number(calendarEpisodeMatch[2]),
      episodeId: Number(calendarEpisodeMatch[3]),
    };
  }

  const episodeMatch = path.match(/^\/episode\/(\d+)\/?$/);
  if (episodeMatch) return { name: "episode" as const, episodeId: Number(episodeMatch[1]) };

  return { name: "home" as const };
}

export function App() {
  const [location, setLocation] = useState(window.location.pathname + window.location.search);
  const [path, search = ""] = location.split("?");

  const router = useMemo<RouterContextValue>(
    () => ({
      path,
      search: search ? `?${search}` : "",
      navigate: (nextPath) => {
        window.history.pushState(null, "", nextPath);
        setLocation(window.location.pathname + window.location.search);
        window.scrollTo({ top: 0, behavior: "smooth" });
      },
    }),
    [path, search],
  );

  useEffect(() => {
    const onPopState = () => setLocation(window.location.pathname + window.location.search);
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  useEffect(() => {
    if (path !== "/") return;
    const current = getCurrentBrazilMonth();
    const nextPath = toMonthPath(current.year, current.month);
    window.history.replaceState(null, "", nextPath);
    setLocation(nextPath);
  }, [path]);

  const route = parseRoute(path);

  return (
    <RouterContext.Provider value={router}>
      <NotificationsProvider>
        <SiteHeader />
        {route.name === "calendar" && <CalendarPage year={route.year} month={route.month} />}
        {route.name === "series" && <SeriesPage showId={route.showId} />}
        {route.name === "notifications" && <NotificationsPage />}
        {route.name === "episode" && <EpisodePage episodeId={route.episodeId} />}
        {route.name === "calendarEpisode" && (
          <EpisodePage episodeId={route.episodeId} year={route.year} month={route.month} />
        )}
        {route.name === "home" && <main className="page-shell">Carregando calendário...</main>}
      </NotificationsProvider>
    </RouterContext.Provider>
  );
}

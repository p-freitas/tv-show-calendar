import {
  CALENDAR_DATA_VERSION,
  DEFAULT_COUNTRY,
  EXCLUDED_CHANNELS,
  EXCLUDED_SHOW_GENRES,
  EXCLUDED_SHOW_TYPES,
  LOCAL_CACHE_TTL_MS,
  MAINSTREAM_CHANNELS,
  TV_SCHEDULE_COUNTRIES,
  TVMAZE_BASE_URL,
} from "../config/app";
import { daysInMonth, isoDate } from "../lib/dates";
import { normalizeCalendarEpisode, normalizeEpisode, normalizeShow } from "../lib/normalizers";
import { readCache, writeCache } from "../lib/storageCache";
import type { CalendarEpisode, CalendarMonth, Episode, Show } from "../types/domain";
import type { TVMazeEpisode, TVMazeEpisodeWithShow, TVMazeShow } from "../types/tvmaze";

const memoryShowEpisodes = new Map<number, TVMazeEpisode[]>();

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => globalThis.setTimeout(resolve, ms));
}

async function fetchJson<T>(path: string, attempt = 0): Promise<T> {
  const response = await fetch(`${TVMAZE_BASE_URL}${path}`);

  if ((response.status === 429 || response.status >= 500) && attempt < 3) {
    const retryAfter = Number(response.headers.get("retry-after"));
    const delay = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 600 * 2 ** attempt;
    await sleep(delay);
    return fetchJson<T>(path, attempt + 1);
  }

  if (!response.ok) {
    throw new Error(`TVmaze respondeu ${response.status} para ${path}`);
  }

  return response.json() as Promise<T>;
}

function isAllowedCalendarEpisode(episode: TVMazeEpisodeWithShow): boolean {
  const show = episode.show ?? episode._embedded?.show;
  if (!show) return false;
  const channelNames = [show.network?.name, show.webChannel?.name].filter(Boolean);
  if (channelNames.some((name) => EXCLUDED_CHANNELS.has(String(name)))) return false;
  if (!channelNames.some((name) => MAINSTREAM_CHANNELS.has(String(name)))) return false;
  if (show.type && EXCLUDED_SHOW_TYPES.has(show.type)) return false;
  if ((show.genres ?? []).some((genre) => EXCLUDED_SHOW_GENRES.has(genre))) return false;
  return true;
}

async function mapLimit<T, R>(items: T[], limit: number, mapper: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = [];
  let index = 0;

  async function worker() {
    while (index < items.length) {
      const currentIndex = index;
      index += 1;
      results[currentIndex] = await mapper(items[currentIndex]);
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

export async function getShowEpisodesRaw(showId: number): Promise<TVMazeEpisode[]> {
  const memory = memoryShowEpisodes.get(showId);
  if (memory) return memory;

  const cacheKey = `show-episodes:${showId}`;
  const cached = readCache<TVMazeEpisode[]>(cacheKey);
  if (cached) {
    memoryShowEpisodes.set(showId, cached);
    return cached;
  }

  const episodes = await fetchJson<TVMazeEpisode[]>(`/shows/${showId}/episodes`);
  memoryShowEpisodes.set(showId, episodes);
  writeCache(cacheKey, episodes, LOCAL_CACHE_TTL_MS * 7);
  return episodes;
}

export async function getShow(showId: number): Promise<Show> {
  const cacheKey = `show:${showId}`;
  const cached = readCache<TVMazeShow>(cacheKey);
  if (cached) return normalizeShow(cached);

  const show = await fetchJson<TVMazeShow>(`/shows/${showId}`);
  writeCache(cacheKey, show, LOCAL_CACHE_TTL_MS * 7);
  return normalizeShow(show);
}

export async function getShowEpisodes(showId: number): Promise<Episode[]> {
  const rawEpisodes = await getShowEpisodesRaw(showId);
  return rawEpisodes.map((episode) => normalizeEpisode(episode, rawEpisodes, showId));
}

export async function getEpisode(episodeId: number, fromNotification = false): Promise<{ episode: Episode; show: Show }> {
  const response = await fetch(`/api/episode?episodeId=${episodeId}${fromNotification ? "&source=notification" : ""}`);
  const contentType = response.headers.get("content-type") ?? "";

  if (!contentType.includes("application/json")) {
    throw new Error("Backend não retornou JSON para o episódio.");
  }

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(payload?.error ?? `Backend respondeu ${response.status}.`);
  }

  return response.json() as Promise<{ episode: Episode; show: Show }>;
}

export async function getShowDetail(showId: number): Promise<{ show: Show; episodes: Episode[] }> {
  const response = await fetch(`/api/show?showId=${showId}`);
  const contentType = response.headers.get("content-type") ?? "";

  if (!contentType.includes("application/json")) {
    throw new Error("Backend não retornou JSON para a série.");
  }

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(payload?.error ?? `Backend respondeu ${response.status}.`);
  }

  return response.json() as Promise<{ show: Show; episodes: Episode[] }>;
}

export async function getCalendarEpisode(
  year: number,
  month: number,
  episodeId: number,
): Promise<{ episode: Episode; show: Show; calendarEpisode: CalendarEpisode }> {
  const response = await fetch(`/api/episode?year=${year}&month=${month}&episodeId=${episodeId}`);
  const contentType = response.headers.get("content-type") ?? "";

  if (!contentType.includes("application/json")) {
    throw new Error("Backend não retornou JSON para o episódio.");
  }

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(payload?.error ?? `Backend respondeu ${response.status}.`);
  }

  return response.json() as Promise<{ episode: Episode; show: Show; calendarEpisode: CalendarEpisode }>;
}

async function getDaySchedule(date: string, country: string): Promise<TVMazeEpisodeWithShow[]> {
  const countries = Array.from(new Set([country, ...TV_SCHEDULE_COUNTRIES]));
  const tvSchedules = await Promise.allSettled(
    countries.map((countryCode) => fetchJson<TVMazeEpisodeWithShow[]>(`/schedule?country=${countryCode}&date=${date}`)),
  );
  const web = await fetchJson<TVMazeEpisodeWithShow[]>(`/schedule/web?date=${date}`).then(
    (value) => ({ status: "fulfilled" as const, value }),
    (reason) => ({ status: "rejected" as const, reason }),
  );

  const items: TVMazeEpisodeWithShow[] = [];
  tvSchedules.forEach((tv) => {
    if (tv.status === "fulfilled") {
      items.push(...tv.value.map((item) => ({ ...item, __source: "tv" }) as TVMazeEpisodeWithShow));
    }
  });
  if (web.status === "fulfilled") {
    items.push(...web.value.map((item) => ({ ...item, __source: "web" }) as TVMazeEpisodeWithShow));
  }

  if (tvSchedules.every((tv) => tv.status === "rejected") && web.status === "rejected") {
    throw new Error(`Não foi possível carregar a agenda de ${date}.`);
  }

  const byId = new Map<number, TVMazeEpisodeWithShow>();
  items.forEach((item) => {
    if (!byId.has(item.id)) byId.set(item.id, item);
  });
  return Array.from(byId.values());
}

async function getDayScheduleWithRetry(date: string, country: string): Promise<TVMazeEpisodeWithShow[]> {
  try {
    return await getDaySchedule(date, country);
  } catch {
    await sleep(1200);
    return getDaySchedule(date, country);
  }
}

export async function getCalendarMonthDirect(
  year: number,
  month: number,
  country = DEFAULT_COUNTRY,
): Promise<CalendarMonth> {
  const cacheKey = `month:${country}:${year}-${String(month).padStart(2, "0")}`;
  const cached = readCache<CalendarMonth>(cacheKey);
  if (cached) return cached;

  const dateList = Array.from({ length: daysInMonth(year, month) }, (_, index) => isoDate(year, month, index + 1));
  const failedDays: string[] = [];
  const days = await mapLimit(dateList, 2, async (date) => {
    try {
      return await getDayScheduleWithRetry(date, country);
    } catch {
      failedDays.push(date);
      return [];
    }
  });
  const rawEpisodes = days.flat().filter(isAllowedCalendarEpisode);

  if (rawEpisodes.length === 0 && failedDays.length === dateList.length) {
    throw new Error("Não foi possível carregar a agenda do mês.");
  }

  const episodes = rawEpisodes
    .map((episode) => {
      const source = (episode as TVMazeEpisodeWithShow & { __source?: "tv" | "web" }).__source;
      return normalizeCalendarEpisode(episode, [episode], source);
    })
    .filter(Boolean)
    .sort((a, b) => {
      const dateDelta = a!.brazilianDateKey.localeCompare(b!.brazilianDateKey);
      if (dateDelta !== 0) return dateDelta;
      return (a!.airstamp ?? "").localeCompare(b!.airstamp ?? "");
    });

  const monthData: CalendarMonth = {
    year,
    month,
    episodes: episodes as CalendarMonth["episodes"],
    loadedAt: new Date().toISOString(),
  };

  writeCache(cacheKey, monthData, LOCAL_CACHE_TTL_MS);
  return monthData;
}

async function getCalendarMonthFromBackend(year: number, month: number, country: string): Promise<CalendarMonth | null> {
  if (typeof window === "undefined") return null;

  const response = await fetch(`/api/calendar?year=${year}&month=${month}&country=${country}&v=${CALENDAR_DATA_VERSION}`);
  const contentType = response.headers.get("content-type") ?? "";

  if (!contentType.includes("application/json")) return null;
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(payload?.error ?? `Backend respondeu ${response.status}.`);
  }

  return response.json() as Promise<CalendarMonth>;
}

export async function getCalendarMonth(
  year: number,
  month: number,
  country = DEFAULT_COUNTRY,
): Promise<CalendarMonth> {
  const cacheKey = `month:${CALENDAR_DATA_VERSION}:${country}:${year}-${String(month).padStart(2, "0")}`;
  const cached = readCache<CalendarMonth>(cacheKey);
  if (cached) return cached;

  const backendData = await getCalendarMonthFromBackend(year, month, country);
  if (backendData) {
    writeCache(cacheKey, backendData, LOCAL_CACHE_TTL_MS);
    return backendData;
  }

  throw new Error("A rota /api/calendar não está disponível para carregar o calendário do PogDesign.");
}

export const tvmaze = {
  getCalendarMonth,
  getCalendarMonthDirect,
  getShow,
  getShowEpisodes,
  getEpisode,
  getShowDetail,
  getCalendarEpisode,
  getShowEpisodesRaw,
};

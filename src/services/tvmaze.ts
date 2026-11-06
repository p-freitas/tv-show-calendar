import { CALENDAR_DATA_VERSION, DEFAULT_COUNTRY, LOCAL_CACHE_TTL_MS } from "../config/app";
import { readCache, writeCache } from "../lib/storageCache";
import type { CalendarEpisode, CalendarMonth, Episode, Show } from "../types/domain";

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
  getEpisode,
  getShowDetail,
  getCalendarEpisode,
};

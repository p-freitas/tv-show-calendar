import { episodeCode, classifyEpisode, classifyScheduleEpisode } from "./episodeClassifier";
import { episodeDateKey, formatDateInBrazil, formatTimeInBrazil } from "./dates";
import type { CalendarEpisode, Episode, Show } from "../types/domain";
import type { TVMazeEpisode, TVMazeEpisodeWithShow, TVMazeShow } from "../types/tvmaze";

export function stripHtml(value?: string | null): string {
  if (!value) return "";
  return value.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
}

export function normalizeShow(show: TVMazeShow): Show {
  return {
    showId: show.id,
    name: show.name,
    type: show.type,
    summary: stripHtml(show.summary),
    genres: show.genres ?? [],
    status: show.status,
    country: show.network?.country ?? show.webChannel?.country ?? null,
    language: show.language,
    runtime: show.runtime,
    averageRuntime: show.averageRuntime,
    network: show.network ?? null,
    webChannel: show.webChannel ?? null,
    premiered: show.premiered,
    image: show.image?.original ?? show.image?.medium ?? null,
    url: show.url,
  };
}

export function normalizeEpisode(episode: TVMazeEpisode, allEpisodes: TVMazeEpisode[], showId = 0): Episode {
  const classification = classifyEpisode(episode, allEpisodes);
  return {
    episodeId: episode.id,
    showId: episode._embedded?.show?.id ?? showId,
    season: episode.season,
    number: episode.number,
    episodeCode: episodeCode(episode.season, episode.number),
    episodeTitle: episode.name || "Sem título",
    summary: stripHtml(episode.summary),
    airdate: episode.airdate,
    airtime: episode.airtime,
    airstamp: episode.airstamp,
    runtime: episode.runtime,
    image: episode.image?.original ?? episode.image?.medium ?? null,
    ...classification,
  };
}

export function normalizeCalendarEpisode(
  episode: TVMazeEpisodeWithShow,
  allShowEpisodes: TVMazeEpisode[],
  sourceHint?: "tv" | "web",
): CalendarEpisode | null {
  const show = episode.show ?? episode._embedded?.show;
  if (!show) return null;

  const classification = classifyScheduleEpisode(episode);
  const sourceType = sourceHint ?? (show.webChannel && !show.network ? "web" : "tv");

  return {
    episodeId: episode.id,
    showId: show.id,
    showName: show.name,
    showType: show.type,
    showSummary: stripHtml(show.summary),
    season: episode.season,
    number: episode.number,
    episodeCode: episodeCode(episode.season, episode.number),
    episodeTitle: episode.name || "Sem título",
    summary: stripHtml(episode.summary),
    airdate: episode.airdate,
    airtime: episode.airtime,
    airstamp: episode.airstamp,
    brazilianDateKey: episodeDateKey(episode.airdate, episode.airstamp),
    brazilianDateLabel: formatDateInBrazil(episode.airdate, episode.airstamp),
    brazilianTimeLabel: formatTimeInBrazil(episode.airstamp),
    runtime: episode.runtime,
    averageRuntime: show.averageRuntime,
    image: episode.image?.original ?? episode.image?.medium ?? null,
    showImage: show.image?.medium ?? show.image?.original ?? null,
    networkName: show.network?.name,
    webChannelName: show.webChannel?.name,
    sourceType,
    country: show.network?.country ?? show.webChannel?.country ?? null,
    language: show.language,
    genres: show.genres ?? [],
    ...classification,
  };
}

export function groupEpisodesBySeason(episodes: Episode[]) {
  const groups = new Map<number, Episode[]>();
  episodes.forEach((episode) => {
    if (!episode.season) return;
    const current = groups.get(episode.season) ?? [];
    current.push(episode);
    groups.set(episode.season, current);
  });

  return Array.from(groups.entries())
    .sort(([a], [b]) => a - b)
    .map(([season, seasonEpisodes]) => ({
      season,
      episodes: seasonEpisodes.sort((a, b) => Number(a.number ?? 0) - Number(b.number ?? 0)),
    }));
}

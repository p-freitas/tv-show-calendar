import type { CalendarEpisode, Filters, RuntimeBucket } from "../types/domain";

function normalize(value?: string | null): string {
  return (value ?? "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

function runtimeMatches(runtime: number | null | undefined, bucket: RuntimeBucket): boolean {
  if (bucket === "all") return true;
  if (!runtime) return false;

  if (bucket === "under_20") return runtime <= 20;
  if (bucket === "21_30") return runtime >= 21 && runtime <= 30;
  if (bucket === "31_45") return runtime >= 31 && runtime <= 45;
  if (bucket === "46_60") return runtime >= 46 && runtime <= 60;
  return runtime > 60;
}

export function episodeMatchesFilters(episode: CalendarEpisode, filters: Filters): boolean {
  const query = normalize(filters.query.trim());
  const runtime = episode.runtime ?? episode.averageRuntime;

  if (query && !normalize(episode.showName).includes(query)) return false;
  if (filters.genres.length > 0 && !filters.genres.some((genre) => episode.genres.includes(genre))) return false;

  const platform = episode.webChannelName ?? episode.networkName;
  if (filters.platforms.length > 0 && (!platform || !filters.platforms.includes(platform))) return false;

  const country = episode.country?.name ?? episode.country?.code;
  if (filters.countries.length > 0 && (!country || !filters.countries.includes(country))) return false;

  if (filters.languages.length > 0 && (!episode.language || !filters.languages.includes(episode.language))) return false;
  if (!runtimeMatches(runtime, filters.runtimeBucket)) return false;
  if (filters.episodeType !== "all" && episode.episodeType !== filters.episodeType) return false;
  if (filters.sourceType !== "all" && episode.sourceType !== filters.sourceType) return false;

  return true;
}

export function applyEpisodeFilters(episodes: CalendarEpisode[], filters: Filters): CalendarEpisode[] {
  return episodes.filter((episode) => episodeMatchesFilters(episode, filters));
}

export function getFilterOptions(episodes: CalendarEpisode[]) {
  const genres = new Set<string>();
  const platforms = new Set<string>();
  const countries = new Set<string>();
  const languages = new Set<string>();

  episodes.forEach((episode) => {
    episode.genres.forEach((genre) => genres.add(genre));
    if (episode.networkName) platforms.add(episode.networkName);
    if (episode.webChannelName) platforms.add(episode.webChannelName);
    const country = episode.country?.name ?? episode.country?.code;
    if (country) countries.add(country);
    if (episode.language) languages.add(episode.language);
  });

  return {
    genres: Array.from(genres).sort(),
    platforms: Array.from(platforms).sort(),
    countries: Array.from(countries).sort(),
    languages: Array.from(languages).sort(),
  };
}

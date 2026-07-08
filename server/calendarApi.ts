import type { CalendarEpisode, CalendarMonth, EpisodeType } from "../src/types/domain";
import type { TVMazeEpisode, TVMazeShow } from "../src/types/tvmaze";

const CALENDAR_DATA_VERSION = "pogdesign-v2";
const LOCAL_CACHE_TTL_MS = 1000 * 60 * 60 * 24;
const POGDESIGN_BASE_URL = "https://www.pogdesign.co.uk";
const TVMAZE_BASE_URL = "https://api.tvmaze.com";

type CacheEntry<T> = {
  expiresAt: number;
  value: T;
};

type CalendarRequest = {
  method?: string;
  url?: string;
};

type CalendarResponse = {
  statusCode: number;
  setHeader: (name: string, value: string) => void;
  end: (body?: string) => void;
};

const monthCache = new Map<string, CacheEntry<CalendarMonth>>();
const showSearchCache = new Map<string, CacheEntry<TVMazeShow | null>>();
const showEpisodesCache = new Map<number, CacheEntry<TVMazeEpisode[]>>();

function decodeHtml(value: string): string {
  const namedEntities: Record<string, string> = {
    amp: "&",
    apos: "'",
    gt: ">",
    lt: "<",
    nbsp: " ",
    quot: '"',
  };

  return value
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&#x([\da-f]+);/gi, (_, code: string) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&([a-z]+);/gi, (match, entity: string) => namedEntities[entity.toLowerCase()] ?? match);
}

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

function isoDate(year: number, month: number, day: number): string {
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

function stripTags(value: string): string {
  return decodeHtml(value.replace(/<[^>]*>/g, " ")).replace(/\s+/g, " ").trim();
}

function stripHtml(value?: string | null): string {
  if (!value) return "";
  return value.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
}

function episodeCode(season?: number | null, number?: number | null): string {
  if (!season || !number) return "Especial";
  return `S${pad2(season)}E${pad2(number)}`;
}

function knownDateValue(episode: TVMazeEpisode): number {
  if (episode.airstamp) return new Date(episode.airstamp).getTime();
  if (episode.airdate) return new Date(`${episode.airdate}T12:00:00.000Z`).getTime();
  return 0;
}

function isLastKnownEpisodeOfSeason(episode: TVMazeEpisode, allEpisodes: TVMazeEpisode[]): boolean {
  if (!episode.season || !episode.number) return false;

  const seasonEpisodes = allEpisodes
    .filter((item) => item.season === episode.season && item.number)
    .sort((a, b) => {
      const numberDelta = Number(a.number) - Number(b.number);
      if (numberDelta !== 0) return numberDelta;
      return knownDateValue(a) - knownDateValue(b);
    });

  if (seasonEpisodes.length === 0) return false;
  const last = seasonEpisodes[seasonEpisodes.length - 1];
  return last.id === episode.id || (last.number === episode.number && last.season === episode.season);
}

function classifyEpisode(episode: TVMazeEpisode, allEpisodes: TVMazeEpisode[]) {
  const isSeriesPremiere = episode.season === 1 && episode.number === 1;
  const isSeasonPremiere = Boolean(episode.season && episode.season > 1 && episode.number === 1);
  const isSeasonFinale = episode.type === "season_finale" || isLastKnownEpisodeOfSeason(episode, allEpisodes);

  let episodeType: EpisodeType = "regular";
  if (isSeriesPremiere) {
    episodeType = "series_premiere";
  } else if (isSeasonPremiere) {
    episodeType = "season_premiere";
  } else if (isSeasonFinale) {
    episodeType = "season_finale";
  }

  return {
    episodeType,
    isSeriesPremiere,
    isSeasonPremiere,
    isSeasonFinale,
  };
}

function normalizeShow(show: TVMazeShow) {
  const imdbId = show.externals?.imdb ?? null;

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
    imdbId,
    imdbUrl: imdbId ? `https://www.imdb.com/title/${imdbId}/` : null,
    ratingAverage: show.rating?.average ?? null,
  };
}

function normalizeEpisode(episode: TVMazeEpisode, allEpisodes: TVMazeEpisode[], showId = 0) {
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
    ratingAverage: episode.rating?.average ?? null,
    ...classifyEpisode(episode, allEpisodes),
  };
}

function normalizeLookupValue(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/gi, "")
    .toLowerCase();
}

function absolutePogDesignUrl(path?: string): string | undefined {
  if (!path) return undefined;
  if (/^https?:\/\//i.test(path)) return path;
  const normalized = path.startsWith("/") ? path : `/cat/${path}`;
  return `${POGDESIGN_BASE_URL}${normalized}`;
}

function getAttribute(tag: string, name: string): string | undefined {
  const pattern = new RegExp(`\\b${name}\\s*=\\s*(["'])(.*?)\\1`, "i");
  return tag.match(pattern)?.[2];
}

function parseEpisodeCode(code: string, fallbackSeason?: number, fallbackNumber?: number) {
  const match = code.match(/s(\d+)e(\d+)/i);
  return {
    season: match ? Number(match[1]) : fallbackSeason,
    number: match ? Number(match[2]) : fallbackNumber,
    episodeCode: match ? `S${match[1].padStart(2, "0")}E${match[2].padStart(2, "0")}` : code.toUpperCase(),
  };
}

function classifyPogDesignEpisode(html: string): {
  episodeType: EpisodeType;
  isSeriesPremiere: boolean;
  isSeasonPremiere: boolean;
  isSeasonFinale: boolean;
} {
  const isSeriesPremiere = /\bpep\b|\bvfirstep\b/i.test(html);
  const isSeasonPremiere = !isSeriesPremiere && /\bfep\b|\bfirstep\b|\bfirst\b/i.test(html);
  const isSeasonFinale = /\blep\b|\blastep\b|\blast\b/i.test(html);

  let episodeType: EpisodeType = "regular";
  if (isSeriesPremiere) {
    episodeType = "series_premiere";
  } else if (isSeasonPremiere) {
    episodeType = "season_premiere";
  } else if (isSeasonFinale) {
    episodeType = "season_finale";
  }

  return {
    episodeType,
    isSeriesPremiere,
    isSeasonPremiere,
    isSeasonFinale,
  };
}

function parsePogDesignEpisode(block: string, day: number, month: number, year: number): CalendarEpisode | null {
  const inputTag = block.match(/<input\b[^>]*>/i)?.[0] ?? "";
  const inputId = Number(getAttribute(inputTag, "id"));
  const inputValue = getAttribute(inputTag, "value");
  const valueMatch = inputValue?.match(/^(\d+)-(\d+)-(\d+)\//);
  const fallbackShowId = valueMatch ? Number(valueMatch[1]) : inputId;
  const fallbackSeason = valueMatch ? Number(valueMatch[2]) : undefined;
  const fallbackNumber = valueMatch ? Number(valueMatch[3]) : undefined;
  const paragraph = block.match(/<p\b[^>]*>[\s\S]*?<\/p>/i)?.[0];
  if (!paragraph || !Number.isFinite(fallbackShowId)) return null;

  const anchors = Array.from(paragraph.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi));
  const showAnchor = anchors[0];
  const episodeAnchor = anchors[1];
  if (!showAnchor || !episodeAnchor) return null;

  const showName = stripTags(showAnchor[2]);
  const rawEpisodeCode = stripTags(episodeAnchor[2]);
  if (!showName || !rawEpisodeCode) return null;

  const { episodeCode, season, number } = parseEpisodeCode(rawEpisodeCode, fallbackSeason, fallbackNumber);
  const dateKey = isoDate(year, month, day);
  const classification = classifyPogDesignEpisode(block);
  const showUrl = absolutePogDesignUrl(getAttribute(showAnchor[1], "href"));
  const episodeUrl = absolutePogDesignUrl(getAttribute(episodeAnchor[1], "href"));
  const stableId = Number.isFinite(inputId)
    ? inputId
    : Number(`${year}${String(month).padStart(2, "0")}${String(day).padStart(2, "0")}${fallbackShowId}${season ?? 0}${number ?? 0}`);

  return {
    episodeId: stableId,
    showId: fallbackShowId,
    showName,
    season,
    number,
    episodeCode,
    episodeTitle: episodeCode,
    airdate: dateKey,
    airtime: null,
    airstamp: null,
    brazilianDateKey: dateKey,
    brazilianDateLabel: dateKey,
    brazilianTimeLabel: "",
    runtime: null,
    averageRuntime: null,
    image: null,
    showImage: null,
    networkName: "PogDesign",
    webChannelName: undefined,
    sourceType: "pogdesign",
    country: null,
    language: undefined,
    genres: [],
    pogShowUrl: showUrl,
    pogEpisodeUrl: episodeUrl,
    ...classification,
  };
}

export function parsePogDesignCalendarMonth(html: string, year: number, month: number): CalendarEpisode[] {
  const dayMatches = Array.from(html.matchAll(/<div id="d_(\d{1,2})_(\d{1,2})_(\d{4})"\s+class="day">/gi));
  const episodes: CalendarEpisode[] = [];

  dayMatches.forEach((dayMatch, index) => {
    const day = Number(dayMatch[1]);
    const matchedMonth = Number(dayMatch[2]);
    const matchedYear = Number(dayMatch[3]);
    if (matchedMonth !== month || matchedYear !== year) return;

    const start = dayMatch.index ?? 0;
    const end = dayMatches[index + 1]?.index ?? html.indexOf('<div class="month_name"', start + 1);
    const block = html.slice(start, end > start ? end : undefined);
    const episodeBlocks = Array.from(block.matchAll(/<div class="ep\s+[^"]*">[\s\S]*?<\/div>/gi));

    episodeBlocks.forEach((episodeBlock) => {
      const episode = parsePogDesignEpisode(episodeBlock[0], day, month, year);
      if (episode) episodes.push(episode);
    });
  });

  return episodes;
}

async function fetchTvmazeJson<T>(path: string): Promise<T> {
  const response = await fetch(`${TVMAZE_BASE_URL}${path}`);
  if (!response.ok) throw new Error(`TVmaze respondeu ${response.status} para ${path}`);
  return response.json() as Promise<T>;
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

async function findTvmazeShow(showName: string): Promise<TVMazeShow | null> {
  const cacheKey = normalizeLookupValue(showName);
  const cached = showSearchCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  try {
    const matches = await fetchTvmazeJson<Array<{ score: number; show: TVMazeShow }>>(
      `/search/shows?q=${encodeURIComponent(showName)}`,
    );
    const normalizedName = normalizeLookupValue(showName);
    const exact = matches.find((match) => normalizeLookupValue(match.show.name) === normalizedName);
    const value = exact?.show ?? matches[0]?.show ?? null;
    showSearchCache.set(cacheKey, {
      expiresAt: Date.now() + LOCAL_CACHE_TTL_MS * 7,
      value,
    });
    return value;
  } catch {
    showSearchCache.set(cacheKey, {
      expiresAt: Date.now() + LOCAL_CACHE_TTL_MS,
      value: null,
    });
    return null;
  }
}

async function getTvmazeShowEpisodes(showId: number): Promise<TVMazeEpisode[]> {
  const cached = showEpisodesCache.get(showId);
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  const episodes = await fetchTvmazeJson<TVMazeEpisode[]>(`/shows/${showId}/episodes`);
  showEpisodesCache.set(showId, {
    expiresAt: Date.now() + LOCAL_CACHE_TTL_MS * 7,
    value: episodes,
  });
  return episodes;
}

function applyShowMetadata(episode: CalendarEpisode, show: TVMazeShow): CalendarEpisode {
  const networkName = show.network?.name;
  const webChannelName = show.webChannel?.name;

  return {
    ...episode,
    showId: show.id,
    tvmazeShowId: show.id,
    showType: show.type,
    showSummary: stripHtml(show.summary),
    runtime: episode.runtime ?? show.runtime ?? show.averageRuntime ?? null,
    averageRuntime: show.averageRuntime ?? show.runtime ?? null,
    showImage: show.image?.medium ?? show.image?.original ?? episode.showImage ?? null,
    networkName,
    webChannelName,
    sourceType: show.webChannel && !show.network ? "web" : "tv",
    country: show.network?.country ?? show.webChannel?.country ?? null,
    language: show.language,
    genres: show.genres ?? [],
  };
}

async function enrichCalendarEpisodes(episodes: CalendarEpisode[]): Promise<CalendarEpisode[]> {
  const showNames = Array.from(new Set(episodes.map((episode) => episode.showName)));
  const showMatches = await mapLimit(showNames, 4, async (showName) => [showName, await findTvmazeShow(showName)] as const);
  const showsByName = new Map(showMatches);

  return episodes.map((episode) => {
    const show = showsByName.get(episode.showName);
    return show ? applyShowMetadata(episode, show) : episode;
  });
}

export async function getServerCalendarEpisode(year: number, month: number, episodeId: number) {
  const monthData = await getServerCalendarMonth(year, month);
  const calendarEpisode = monthData.episodes.find((episode) => episode.episodeId === episodeId);
  if (!calendarEpisode) throw new Error("Episódio não encontrado neste mês do calendário.");

  const show = calendarEpisode.tvmazeShowId ? await findTvmazeShow(calendarEpisode.showName) : null;
  if (!show) {
    return {
      episode: {
        ...calendarEpisode,
        episodeTitle: calendarEpisode.episodeTitle || calendarEpisode.episodeCode,
      },
      show: {
        showId: calendarEpisode.showId,
        name: calendarEpisode.showName,
        summary: calendarEpisode.showSummary,
        genres: calendarEpisode.genres,
        image: calendarEpisode.showImage,
        network: calendarEpisode.networkName ? { name: calendarEpisode.networkName } : null,
        webChannel: calendarEpisode.webChannelName ? { name: calendarEpisode.webChannelName } : null,
        country: calendarEpisode.country,
        language: calendarEpisode.language,
        averageRuntime: calendarEpisode.averageRuntime,
        runtime: calendarEpisode.runtime,
        url: calendarEpisode.pogShowUrl,
      },
      calendarEpisode,
    };
  }

  const showEpisodes = await getTvmazeShowEpisodes(show.id);
  const matchedEpisode = showEpisodes.find(
    (episode) => episode.season === calendarEpisode.season && episode.number === calendarEpisode.number,
  );

  return {
    episode: matchedEpisode
      ? normalizeEpisode(matchedEpisode, showEpisodes, show.id)
      : {
          ...calendarEpisode,
          episodeTitle: calendarEpisode.episodeTitle || calendarEpisode.episodeCode,
        },
    show: normalizeShow(show),
    calendarEpisode,
  };
}

export async function getServerShowDetail(showId: number) {
  const show = await fetchTvmazeJson<TVMazeShow>(`/shows/${showId}`);
  const episodes = await getTvmazeShowEpisodes(show.id);

  return {
    show: normalizeShow(show),
    episodes: episodes.map((episode) => normalizeEpisode(episode, episodes, show.id)),
  };
}

export async function getServerTvmazeEpisode(episodeId: number) {
  const rawEpisode = await fetchTvmazeJson<TVMazeEpisode>(`/episodes/${episodeId}?embed=show`);
  const show = rawEpisode._embedded?.show;
  if (!show) throw new Error("TVmaze não retornou a série deste episódio.");
  const showEpisodes = await getTvmazeShowEpisodes(show.id);

  return {
    episode: normalizeEpisode(rawEpisode, showEpisodes, show.id),
    show: normalizeShow(show),
  };
}

async function fetchPogDesignMonth(year: number, month: number): Promise<string> {
  const response = await fetch(`${POGDESIGN_BASE_URL}/cat/${month}-${year}`, {
    headers: {
      accept: "text/html,application/xhtml+xml",
      "user-agent": "TV Shows Calendar/1.0 (+https://www.pogdesign.co.uk/cat/)",
    },
  });

  if (!response.ok) {
    throw new Error(`PogDesign respondeu ${response.status} para ${month}-${year}.`);
  }

  return response.text();
}

export async function getServerCalendarMonth(year: number, month: number): Promise<CalendarMonth> {
  const cacheKey = `${CALENDAR_DATA_VERSION}:pogdesign:${year}-${String(month).padStart(2, "0")}`;
  const cached = monthCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  const html = await fetchPogDesignMonth(year, month);
  const episodes = await enrichCalendarEpisodes(parsePogDesignCalendarMonth(html, year, month));

  if (episodes.length === 0) {
    throw new Error("O PogDesign não retornou episódios para este mês.");
  }

  const monthData: CalendarMonth = {
    year,
    month,
    episodes,
    loadedAt: new Date().toISOString(),
  };

  monthCache.set(cacheKey, {
    expiresAt: Date.now() + LOCAL_CACHE_TTL_MS,
    value: monthData,
  });

  return monthData;
}

export async function handleCalendarApiRequest(request: CalendarRequest, response: CalendarResponse) {
  try {
    const url = new URL(request.url ?? "", "http://localhost");
    const year = Number(url.searchParams.get("year"));
    const month = Number(url.searchParams.get("month"));

    if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
      response.statusCode = 400;
      response.setHeader("content-type", "application/json; charset=utf-8");
      response.end(JSON.stringify({ error: "Parâmetros year/month inválidos." }));
      return;
    }

    const data = await getServerCalendarMonth(year, month);
    response.statusCode = 200;
    response.setHeader("content-type", "application/json; charset=utf-8");
    response.setHeader("cache-control", "s-maxage=21600, stale-while-revalidate=86400");
    response.end(JSON.stringify(data));
  } catch (error) {
    response.statusCode = 502;
    response.setHeader("content-type", "application/json; charset=utf-8");
    response.end(JSON.stringify({ error: error instanceof Error ? error.message : "Falha ao carregar calendário." }));
  }
}

export async function handleEpisodeApiRequest(request: CalendarRequest, response: CalendarResponse) {
  try {
    const url = new URL(request.url ?? "", "http://localhost");
    const year = Number(url.searchParams.get("year"));
    const month = Number(url.searchParams.get("month"));
    const episodeId = Number(url.searchParams.get("episodeId"));

    if (Number.isInteger(episodeId) && !url.searchParams.has("year") && !url.searchParams.has("month")) {
      const data = await getServerTvmazeEpisode(episodeId);
      response.statusCode = 200;
      response.setHeader("content-type", "application/json; charset=utf-8");
      response.setHeader("cache-control", "s-maxage=21600, stale-while-revalidate=86400");
      response.end(JSON.stringify(data));
      return;
    }

    if (
      !Number.isInteger(year) ||
      !Number.isInteger(month) ||
      !Number.isInteger(episodeId) ||
      month < 1 ||
      month > 12
    ) {
      response.statusCode = 400;
      response.setHeader("content-type", "application/json; charset=utf-8");
      response.end(JSON.stringify({ error: "Parâmetros year/month/episodeId inválidos." }));
      return;
    }

    const data = await getServerCalendarEpisode(year, month, episodeId);
    response.statusCode = 200;
    response.setHeader("content-type", "application/json; charset=utf-8");
    response.setHeader("cache-control", "s-maxage=21600, stale-while-revalidate=86400");
    response.end(JSON.stringify(data));
  } catch (error) {
    response.statusCode = 502;
    response.setHeader("content-type", "application/json; charset=utf-8");
    response.end(JSON.stringify({ error: error instanceof Error ? error.message : "Falha ao carregar episódio." }));
  }
}

export async function handleShowApiRequest(request: CalendarRequest, response: CalendarResponse) {
  try {
    const url = new URL(request.url ?? "", "http://localhost");
    const showId = Number(url.searchParams.get("showId"));

    if (!Number.isInteger(showId)) {
      response.statusCode = 400;
      response.setHeader("content-type", "application/json; charset=utf-8");
      response.end(JSON.stringify({ error: "Parâmetro showId inválido." }));
      return;
    }

    const data = await getServerShowDetail(showId);
    response.statusCode = 200;
    response.setHeader("content-type", "application/json; charset=utf-8");
    response.setHeader("cache-control", "s-maxage=21600, stale-while-revalidate=86400");
    response.end(JSON.stringify(data));
  } catch (error) {
    response.statusCode = 502;
    response.setHeader("content-type", "application/json; charset=utf-8");
    response.end(JSON.stringify({ error: error instanceof Error ? error.message : "Falha ao carregar série." }));
  }
}

export function createCalendarApiMiddleware() {
  return async (request: CalendarRequest, response: CalendarResponse, next: () => void) => {
    if (request.method !== "GET") {
      next();
      return;
    }

    if (request.url?.startsWith("/api/calendar")) {
      await handleCalendarApiRequest(request, response);
      return;
    }

    if (request.url?.startsWith("/api/episode")) {
      await handleEpisodeApiRequest(request, response);
      return;
    }

    if (request.url?.startsWith("/api/show")) {
      await handleShowApiRequest(request, response);
      return;
    }

    next();
  };
}

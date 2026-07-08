import {
  EXCLUDED_CHANNELS,
  EXCLUDED_SHOW_GENRES,
  EXCLUDED_SHOW_TYPES,
  MAINSTREAM_CHANNELS,
  TV_SCHEDULE_COUNTRIES,
  TVMAZE_BASE_URL,
} from "../src/config/app";
import type { TVMazeEpisodeWithShow } from "../src/types/tvmaze";

type ChannelCount = {
  channel: string;
  count: number;
};

async function fetchJson<T>(path: string): Promise<T> {
  const response = await fetch(`${TVMAZE_BASE_URL}${path}`);
  if (!response.ok) throw new Error(`${response.status} ${path}`);
  return response.json() as Promise<T>;
}

function channelFor(episode: TVMazeEpisodeWithShow): string {
  const show = episode.show ?? episode._embedded?.show;
  return show?.webChannel?.name ?? show?.network?.name ?? "Sem canal";
}

function passesBaseCuration(episode: TVMazeEpisodeWithShow): boolean {
  const show = episode.show ?? episode._embedded?.show;
  if (!show) return false;
  const channels = [show.network?.name, show.webChannel?.name].filter(Boolean).map(String);
  if (channels.some((channel) => EXCLUDED_CHANNELS.has(channel))) return false;
  if (show.type && EXCLUDED_SHOW_TYPES.has(show.type)) return false;
  if ((show.genres ?? []).some((genre) => EXCLUDED_SHOW_GENRES.has(genre))) return false;
  return true;
}

async function getDay(date: string): Promise<TVMazeEpisodeWithShow[]> {
  const paths = [
    ...TV_SCHEDULE_COUNTRIES.map((country) => `/schedule?country=${country}&date=${date}`),
    `/schedule/web?date=${date}`,
  ];

  const results = await Promise.allSettled(paths.map((path) => fetchJson<TVMazeEpisodeWithShow[]>(path)));
  return results.flatMap((result) => (result.status === "fulfilled" ? result.value : []));
}

function summarize(episodes: TVMazeEpisodeWithShow[]): ChannelCount[] {
  const counts = new Map<string, number>();
  episodes.forEach((episode) => {
    const channel = channelFor(episode);
    counts.set(channel, (counts.get(channel) ?? 0) + 1);
  });
  return Array.from(counts, ([channel, count]) => ({ channel, count })).sort((a, b) => b.count - a.count || a.channel.localeCompare(b.channel));
}

async function main() {
  const year = Number(process.argv[2] ?? 2026);
  const month = Number(process.argv[3] ?? 7);
  const days = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const byId = new Map<number, TVMazeEpisodeWithShow>();

  for (let day = 1; day <= days; day += 1) {
    const date = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const episodes = await getDay(date);
    episodes.forEach((episode) => {
      if (passesBaseCuration(episode)) byId.set(episode.id, episode);
    });
  }

  const broadEpisodes = Array.from(byId.values());
  const keptEpisodes = broadEpisodes.filter((episode) => {
    const show = episode.show ?? episode._embedded?.show;
    const channels = [show?.network?.name, show?.webChannel?.name].filter(Boolean).map(String);
    return channels.some((channel) => MAINSTREAM_CHANNELS.has(channel));
  });

  const broadChannels = summarize(broadEpisodes);
  const keptChannels = summarize(keptEpisodes);
  const keptDisplayNames = new Set(keptChannels.map((item) => item.channel));
  const removedChannels = broadChannels.filter((item) => !keptDisplayNames.has(item.channel));

  console.log(JSON.stringify({ broadEpisodes: broadEpisodes.length, keptEpisodes: keptEpisodes.length, keptChannels, removedChannels }, null, 2));
}

void main();

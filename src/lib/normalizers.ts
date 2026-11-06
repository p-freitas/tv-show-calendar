import type { Episode } from "../types/domain";

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

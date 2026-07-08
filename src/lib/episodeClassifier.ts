import type { EpisodeType } from "../types/domain";

export type ClassifiableEpisode = {
  id?: number;
  season?: number | null;
  number?: number | null;
  airdate?: string | null;
  airstamp?: string | null;
};

export type EpisodeClassification = {
  episodeType: EpisodeType;
  isSeriesPremiere: boolean;
  isSeasonPremiere: boolean;
  isSeasonFinale: boolean;
};

function knownDateValue(episode: ClassifiableEpisode): number {
  if (episode.airstamp) return new Date(episode.airstamp).getTime();
  if (episode.airdate) return new Date(`${episode.airdate}T12:00:00.000Z`).getTime();
  return 0;
}

export function isLastKnownEpisodeOfSeason(
  episode: ClassifiableEpisode,
  allEpisodes: ClassifiableEpisode[],
): boolean {
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

export function classifyEpisode(
  episode: ClassifiableEpisode,
  allEpisodes: ClassifiableEpisode[],
): EpisodeClassification {
  const isSeriesPremiere = episode.season === 1 && episode.number === 1;
  const isSeasonPremiere = Boolean(episode.season && episode.season > 1 && episode.number === 1);
  const isSeasonFinale = isLastKnownEpisodeOfSeason(episode, allEpisodes);

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

export function classifyScheduleEpisode(episode: ClassifiableEpisode & { type?: string | null }): EpisodeClassification {
  const isSeriesPremiere = episode.type === "series_premiere" || (episode.season === 1 && episode.number === 1);
  const isSeasonPremiere =
    episode.type === "season_premiere" || Boolean(episode.season && episode.season > 1 && episode.number === 1);
  const isSeasonFinale = episode.type === "season_finale";

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

export function episodeCode(season?: number | null, number?: number | null): string {
  if (!season || !number) return "Especial";
  return `S${String(season).padStart(2, "0")}E${String(number).padStart(2, "0")}`;
}

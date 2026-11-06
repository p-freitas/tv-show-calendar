export type EpisodeType =
  | "series_premiere"
  | "season_premiere"
  | "season_finale"
  | "regular";

export type SourceType = "all" | "tv" | "web" | "pogdesign";

export type RuntimeBucket = "under_20" | "21_30" | "31_45" | "46_60" | "over_60";

export type Country = {
  name?: string;
  code?: string;
  timezone?: string;
};

export type Network = {
  id?: number;
  name?: string;
  country?: Country | null;
};

export type Genre = string;

export type Show = {
  showId: number;
  name: string;
  type?: string;
  summary?: string;
  genres: Genre[];
  status?: string;
  country?: Country | null;
  language?: string;
  runtime?: number | null;
  averageRuntime?: number | null;
  network?: Network | null;
  webChannel?: Network | null;
  premiered?: string | null;
  image?: string | null;
  url?: string | null;
  imdbId?: string | null;
  imdbUrl?: string | null;
  ratingAverage?: number | null;
};

export type Episode = {
  episodeId: number;
  showId: number;
  season?: number | null;
  number?: number | null;
  episodeCode: string;
  episodeTitle: string;
  summary?: string;
  airdate?: string | null;
  airtime?: string | null;
  airstamp?: string | null;
  runtime?: number | null;
  image?: string | null;
  ratingAverage?: number | null;
  episodeType: EpisodeType;
  isSeriesPremiere: boolean;
  isSeasonPremiere: boolean;
  isSeasonFinale: boolean;
};

export type CalendarEpisode = Episode & {
  showName: string;
  showType?: string;
  showSummary?: string;
  brazilianDateKey: string;
  brazilianDateLabel: string;
  brazilianTimeLabel: string;
  networkName?: string;
  webChannelName?: string;
  sourceType: Exclude<SourceType, "all">;
  country?: Country | null;
  language?: string;
  genres: Genre[];
  averageRuntime?: number | null;
  showImage?: string | null;
  pogShowUrl?: string;
  pogEpisodeUrl?: string;
  tvmazeShowId?: number;
  tvmazeEpisodeId?: number;
};

export type Filters = {
  query: string;
  genres: string[];
  platforms: string[];
  countries: string[];
  languages: string[];
  runtimeBuckets: RuntimeBucket[];
  episodeTypes: EpisodeType[];
  sourceType: SourceType;
};

export type CalendarMonth = {
  year: number;
  month: number;
  episodes: CalendarEpisode[];
  loadedAt: string;
};

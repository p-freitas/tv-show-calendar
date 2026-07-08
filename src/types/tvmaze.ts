export type TVMazeCountry = {
  name?: string;
  code?: string;
  timezone?: string;
};

export type TVMazeNetwork = {
  id?: number;
  name?: string;
  country?: TVMazeCountry | null;
};

export type TVMazeImage = {
  medium?: string;
  original?: string;
};

export type TVMazeShow = {
  id: number;
  url?: string;
  name: string;
  type?: string;
  language?: string;
  genres?: string[];
  status?: string;
  runtime?: number | null;
  averageRuntime?: number | null;
  premiered?: string | null;
  officialSite?: string | null;
  schedule?: {
    time?: string;
    days?: string[];
  };
  network?: TVMazeNetwork | null;
  webChannel?: TVMazeNetwork | null;
  image?: TVMazeImage | null;
  summary?: string | null;
  externals?: {
    imdb?: string | null;
  };
  rating?: {
    average?: number | null;
  };
};

export type TVMazeEpisode = {
  id: number;
  url?: string;
  name: string;
  season?: number | null;
  number?: number | null;
  type?: string;
  airdate?: string | null;
  airtime?: string | null;
  airstamp?: string | null;
  runtime?: number | null;
  image?: TVMazeImage | null;
  summary?: string | null;
  rating?: {
    average?: number | null;
  };
  _embedded?: {
    show?: TVMazeShow;
  };
};

export type TVMazeEpisodeWithShow = TVMazeEpisode & {
  show?: TVMazeShow;
};

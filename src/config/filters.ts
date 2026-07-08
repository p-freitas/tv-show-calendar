import type { EpisodeType, Filters, RuntimeBucket, SourceType } from "../types/domain";

export const DEFAULT_FILTERS: Filters = {
  query: "",
  genres: [],
  platforms: [],
  countries: [],
  languages: [],
  runtimeBucket: "all",
  episodeType: "all",
  sourceType: "all",
};

export const runtimeBucketLabels: Record<RuntimeBucket, string> = {
  all: "Todas",
  under_20: "Até 20 min",
  "21_30": "21-30 min",
  "31_45": "31-45 min",
  "46_60": "46-60 min",
  over_60: "Acima de 60 min",
};

export const episodeTypeLabels: Record<EpisodeType | "all", string> = {
  all: "Todos",
  series_premiere: "Estreia da série",
  season_premiere: "Estreia de temporada",
  season_finale: "Final de temporada",
  regular: "Comuns",
};

export const sourceTypeLabels: Record<SourceType, string> = {
  all: "Todas",
  tv: "TV tradicional",
  web: "Streaming/web",
  pogdesign: "PogDesign",
};

export const filterGroups = [
  "Nome da série",
  "Categoria/gênero",
  "Network/plataforma",
  "País",
  "Língua original",
  "Duração",
  "Tipo de episódio",
  "Fonte de exibição",
] as const;

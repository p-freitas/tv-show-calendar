import type { EpisodeType, Filters, RuntimeBucket, SourceType } from "../types/domain";

export const DEFAULT_FILTERS: Filters = {
  query: "",
  genres: [],
  platforms: [],
  countries: [],
  languages: [],
  runtimeBuckets: [],
  episodeTypes: [],
  sourceType: "all",
};

export const runtimeBucketLabels: Record<RuntimeBucket, string> = {
  under_20: "Até 20 min",
  "21_30": "21-30 min",
  "31_45": "31-45 min",
  "46_60": "46-60 min",
  over_60: "Acima de 60 min",
};

export const episodeTypeLabels: Record<EpisodeType, string> = {
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

export function migratePersistedFilters(state: unknown): { filters: Filters } {
  const saved = (state as { filters?: Partial<Filters> & {
    runtimeBucket?: RuntimeBucket | "all";
    episodeType?: EpisodeType | "all";
  } } | null)?.filters ?? {};
  const { runtimeBucket, episodeType, ...filters } = saved;

  return {
    filters: {
      ...DEFAULT_FILTERS,
      ...filters,
      runtimeBuckets: filters.runtimeBuckets ?? (runtimeBucket && runtimeBucket !== "all" ? [runtimeBucket] : []),
      episodeTypes: filters.episodeTypes ?? (episodeType && episodeType !== "all" ? [episodeType] : []),
    },
  };
}

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

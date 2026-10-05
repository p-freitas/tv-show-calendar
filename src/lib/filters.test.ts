import { describe, expect, it } from "vitest";
import { DEFAULT_FILTERS, migratePersistedFilters } from "../config/filters";
import type { CalendarEpisode, EpisodeType } from "../types/domain";
import { applyEpisodeFilters } from "./filters";

function episode(episodeId: number, episodeType: EpisodeType, runtime: number | null): CalendarEpisode {
  return {
    episodeId, showId: 1, showName: "Example", episodeCode: "S01E02", episodeTitle: "Example",
    episodeType, runtime, genres: ["Drama"], sourceType: "tv",
    isSeriesPremiere: false, isSeasonPremiere: false, isSeasonFinale: false,
    brazilianDateKey: "2026-10-05", brazilianDateLabel: "05/10/2026", brazilianTimeLabel: "",
  };
}

const episodes = [
  episode(1, "series_premiere", 20),
  episode(2, "season_premiere", 30),
  episode(3, "season_finale", 45),
  episode(4, "regular", 60),
  episode(5, "regular", 61),
  episode(6, "regular", null),
];

describe("multiple calendar filters", () => {
  it("includes all episodes when no options are selected", () => {
    expect(applyEpisodeFilters(episodes, DEFAULT_FILTERS)).toEqual(episodes);
  });

  it("accepts either selected episode type", () => {
    expect(applyEpisodeFilters(episodes, { ...DEFAULT_FILTERS, episodeTypes: ["series_premiere", "season_finale"] })
      .map((item) => item.episodeId)).toEqual([1, 3]);
  });

  it("accepts either runtime range while also requiring a selected episode type", () => {
    expect(applyEpisodeFilters(episodes, {
      ...DEFAULT_FILTERS, runtimeBuckets: ["under_20", "46_60"], episodeTypes: ["series_premiere", "regular"],
    }).map((item) => item.episodeId)).toEqual([1, 4]);
  });

  it("uses average runtime when episode runtime is unknown", () => {
    expect(applyEpisodeFilters([{ ...episodes[5], averageRuntime: 25 }], {
      ...DEFAULT_FILTERS, runtimeBuckets: ["21_30", "over_60"],
    })).toHaveLength(1);
  });

  it("still requires other filter groups to match", () => {
    expect(applyEpisodeFilters(episodes, {
      ...DEFAULT_FILTERS, episodeTypes: ["regular", "season_finale"], genres: ["Comedy"],
    })).toEqual([]);
  });
});

describe("saved filter migration", () => {
  it("preserves existing single selections and other filters", () => {
    expect(migratePersistedFilters({ filters: {
      query: "Example", genres: ["Drama"], runtimeBucket: "31_45", episodeType: "season_finale",
    } }).filters).toEqual({
      ...DEFAULT_FILTERS, query: "Example", genres: ["Drama"], runtimeBuckets: ["31_45"], episodeTypes: ["season_finale"],
    });
  });

  it("converts all into unrestricted selections", () => {
    expect(migratePersistedFilters({ filters: { runtimeBucket: "all", episodeType: "all" } }).filters).toEqual(DEFAULT_FILTERS);
  });
});

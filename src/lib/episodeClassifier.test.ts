import { describe, expect, it } from "vitest";
import { classifyEpisode, classifyScheduleEpisode } from "./episodeClassifier";

const seasonOne = [
  { id: 1, season: 1, number: 1 },
  { id: 2, season: 1, number: 2 },
  { id: 3, season: 1, number: 3 },
];

describe("classifyEpisode", () => {
  it("classifica S01E01 como estreia da série", () => {
    expect(classifyEpisode(seasonOne[0], seasonOne)).toMatchObject({
      episodeType: "series_premiere",
      isSeriesPremiere: true,
    });
  });

  it("classifica S02E01 como estreia de temporada", () => {
    const episodes = [{ id: 4, season: 2, number: 1 }, { id: 5, season: 2, number: 2 }];
    expect(classifyEpisode(episodes[0], episodes)).toMatchObject({
      episodeType: "season_premiere",
      isSeasonPremiere: true,
    });
  });

  it("classifica episódio comum", () => {
    expect(classifyEpisode(seasonOne[1], seasonOne)).toMatchObject({
      episodeType: "regular",
    });
  });

  it("classifica último episódio conhecido da temporada como finale", () => {
    expect(classifyEpisode(seasonOne[2], seasonOne)).toMatchObject({
      episodeType: "season_finale",
      isSeasonFinale: true,
    });
  });

  it("não marca finale quando o episódio não tem número", () => {
    const episode = { id: 10, season: 1, number: null };
    expect(classifyEpisode(episode, [episode])).toMatchObject({
      episodeType: "regular",
      isSeasonFinale: false,
    });
  });

  it("trata episódio especial sem temporada como comum", () => {
    const episode = { id: 11, season: null, number: null };
    expect(classifyEpisode(episode, [episode])).toMatchObject({
      episodeType: "regular",
    });
  });

  it("temporada de um episódio preserva prioridade de estreia da série", () => {
    const episode = { id: 12, season: 1, number: 1 };
    expect(classifyEpisode(episode, [episode])).toMatchObject({
      episodeType: "series_premiere",
      isSeriesPremiere: true,
      isSeasonFinale: true,
    });
  });

  it("dados incompletos não quebram a classificação", () => {
    expect(classifyEpisode({ id: 13 }, [{ id: 13 }])).toMatchObject({
      episodeType: "regular",
      isSeriesPremiere: false,
      isSeasonPremiere: false,
      isSeasonFinale: false,
    });
  });

  it("classificação do calendário não marca S01E01 como finale sem contexto de temporada", () => {
    expect(classifyScheduleEpisode({ id: 14, season: 1, number: 1 })).toMatchObject({
      episodeType: "series_premiere",
      isSeriesPremiere: true,
      isSeasonFinale: false,
    });
  });

  it("classificação do calendário respeita finale informado pela API", () => {
    expect(classifyScheduleEpisode({ id: 15, season: 2, number: 10, type: "season_finale" })).toMatchObject({
      episodeType: "season_finale",
      isSeasonFinale: true,
    });
  });
});

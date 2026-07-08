import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "../App";
import { EpisodeBadge, FinaleBadge } from "../components/Badge";
import { episodeDateKey, formatDateInBrazil, formatTimeInBrazil, relativeReleaseLabel, toMonthPath } from "../lib/dates";
import { tvmaze } from "../services/tvmaze";
import type { CalendarEpisode } from "../types/domain";

export function EpisodePage({ episodeId, year, month }: { episodeId: number; year?: number; month?: number }) {
  const [, forceTick] = useState(0);
  const query = useQuery({
    queryKey: year && month ? ["calendar-episode", year, month, episodeId] : ["episode", episodeId],
    queryFn: () => (year && month ? tvmaze.getCalendarEpisode(year, month, episodeId) : tvmaze.getEpisode(episodeId)),
    staleTime: 1000 * 60 * 60,
  });

  useEffect(() => {
    const id = window.setInterval(() => forceTick((value) => value + 1), 60_000);
    return () => window.clearInterval(id);
  }, []);

  const calendarHref = useMemo(() => {
    if (year && month) return toMonthPath(year, month);
    const episode = query.data?.episode;
    if (!episode) return "/";
    const key = episodeDateKey(episode.airdate, episode.airstamp);
    const [episodeYear, episodeMonth] = key.split("-").map(Number);
    return episodeYear && episodeMonth ? toMonthPath(episodeYear, episodeMonth) : "/";
  }, [month, query.data?.episode, year]);

  const episode = query.data?.episode;
  const show = query.data?.show;
  const calendarEpisode = (query.data as { calendarEpisode?: CalendarEpisode } | undefined)?.calendarEpisode;
  const displayEpisode = calendarEpisode ?? episode;
  const enrichedAirstamp = episode?.airstamp ?? displayEpisode?.airstamp;

  return (
    <main className="page-shell detail-page">
      {query.isLoading ? <div className="hero-skeleton" /> : null}
      {query.isError ? <p className="empty-state">Não foi possível carregar o episódio.</p> : null}

      {episode && show && displayEpisode ? (
        <>
          <nav className="breadcrumb">
            <Link href={`/series/${show.showId}`}>Voltar para {show.name}</Link>
            <Link href={calendarHref}>Calendário do mês</Link>
          </nav>

          <section className="episode-detail">
            {episode.image ? (
              <img src={episode.image} alt={`Imagem do episódio ${episode.episodeTitle}`} loading="lazy" />
            ) : show.image ? (
              <img src={show.image} alt={`Poster de ${show.name}`} loading="lazy" />
            ) : (
              <div className="poster-fallback" />
            )}
            <div>
              <p className="eyebrow">{show.name || calendarEpisode?.showName}</p>
              <h1>
                {displayEpisode.episodeCode} · {episode.episodeTitle || displayEpisode.episodeTitle}
              </h1>
              <div className="badge-line">
                <EpisodeBadge type={displayEpisode.episodeType} />
                {displayEpisode.isSeasonFinale && displayEpisode.episodeType !== "season_finale" ? <FinaleBadge /> : null}
              </div>
              <p className="summary">{episode.summary || "Sinopse não informada."}</p>
              <dl className="metadata-grid compact">
                <div>
                  <dt>Data no Brasil</dt>
                  <dd>{formatDateInBrazil(displayEpisode.airdate, displayEpisode.airstamp)}</dd>
                </div>
                <div>
                  <dt>Horário no Brasil</dt>
                  <dd>{formatTimeInBrazil(enrichedAirstamp)}</dd>
                </div>
                <div>
                  <dt>Contagem</dt>
                  <dd>{relativeReleaseLabel(enrichedAirstamp)}</dd>
                </div>
                <div>
                  <dt>Duração</dt>
                  <dd>{episode.runtime ?? displayEpisode.runtime ? `${episode.runtime ?? displayEpisode.runtime} min` : "não informado"}</dd>
                </div>
                <div>
                  <dt>Nota IMDb</dt>
                  <dd>{episode.ratingAverage ? `${episode.ratingAverage.toFixed(1)} / 10` : "não informado"}</dd>
                </div>
                <div>
                  <dt>Network/plataforma</dt>
                  <dd>{show.webChannel?.name ?? show.network?.name ?? calendarEpisode?.webChannelName ?? calendarEpisode?.networkName ?? "não informado"}</dd>
                </div>
                <div>
                  <dt>Idioma original</dt>
                  <dd>{show.language ?? calendarEpisode?.language ?? "não informado"}</dd>
                </div>
              </dl>
            </div>
          </section>
        </>
      ) : null}
    </main>
  );
}

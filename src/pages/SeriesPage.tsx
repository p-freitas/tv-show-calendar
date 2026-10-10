import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useRouter } from "../App";
import { EpisodeBadge, FinaleBadge } from "../components/Badge";
import { formatDateInBrazil, formatTimeInBrazil, getCurrentBrazilMonth, hasReleased, toMonthPath } from "../lib/dates";
import { groupEpisodesBySeason } from "../lib/normalizers";
import { tvmaze } from "../services/tvmaze";
import { FollowButton } from "../components/FollowButton";
import { NotificationStatus } from "../components/NotificationStatus";

export function SeriesPage({ showId }: { showId: number }) {
  const { search } = useRouter();
  const detailQuery = useQuery({
    queryKey: ["show-detail", showId],
    queryFn: () => tvmaze.getShowDetail(showId),
    staleTime: 1000 * 60 * 60 * 24,
  });

  const show = detailQuery.data?.show;
  const episodes = detailQuery.data?.episodes ?? [];
  const seasons = episodes.length > 0 ? groupEpisodesBySeason(episodes) : [];
  const galleryImages = useMemo(() => {
    const seen = new Set<string>();
    return episodes
      .map((episode) => episode.image)
      .filter((image): image is string => Boolean(image))
      .filter((image) => {
        if (seen.has(image)) return false;
        seen.add(image);
        return true;
      })
      .slice(0, 12);
  }, [episodes]);
  const current = getCurrentBrazilMonth();
  const returnTo = new URLSearchParams(search).get("returnTo");
  const calendarReturn = returnTo?.match(/^\/calendar\/(\d{4})\/(\d{1,2})\/?$/);
  const returnMonth = calendarReturn ? Number(calendarReturn[2]) : 0;
  const calendarHref = calendarReturn && returnMonth >= 1 && returnMonth <= 12
    ? toMonthPath(Number(calendarReturn[1]), returnMonth)
    : toMonthPath(current.year, current.month);
  const trailerUrl = show
    ? `https://www.youtube.com/results?search_query=${encodeURIComponent(`${show.name} official trailer`)}`
    : undefined;

  return (
    <main className="page-shell detail-page">
      <nav className="breadcrumb">
        <Link href={calendarHref}>Calendário</Link>
      </nav>

      {detailQuery.isLoading ? <div className="hero-skeleton" /> : null}
      {detailQuery.isError ? <p className="empty-state">Não foi possível carregar a série.</p> : null}

      {show ? (
        <>
          <section className="series-hero">
            {show.image ? <img src={show.image} alt={`Poster de ${show.name}`} loading="lazy" /> : <div className="poster-fallback" />}
            <div>
              <p className="eyebrow">Série</p>
              <h1>{show.name}</h1>
              <div className="series-follow-actions"><FollowButton showId={show.showId} /><Link href="/notifications?tab=following" className="text-link">Ver séries que acompanho</Link></div>
              <NotificationStatus />
              <p className="summary">{show.summary || "Sinopse não informada."}</p>
              <dl className="metadata-grid">
                <div>
                  <dt>Gêneros</dt>
                  <dd>{show.genres.length > 0 ? show.genres.join(", ") : "não informado"}</dd>
                </div>
                <div>
                  <dt>Status</dt>
                  <dd>{show.status || "não informado"}</dd>
                </div>
                <div>
                  <dt>País</dt>
                  <dd>{show.country?.name ?? show.country?.code ?? "não informado"}</dd>
                </div>
                <div>
                  <dt>Idioma</dt>
                  <dd>{show.language || "não informado"}</dd>
                </div>
                <div>
                  <dt>Duração média</dt>
                  <dd>{show.averageRuntime ?? show.runtime ? `${show.averageRuntime ?? show.runtime} min` : "não informado"}</dd>
                </div>
                <div>
                  <dt>Network/plataforma</dt>
                  <dd>{show.webChannel?.name ?? show.network?.name ?? "não informado"}</dd>
                </div>
                <div>
                  <dt>Estreia</dt>
                  <dd>{show.premiered || "não informado"}</dd>
                </div>
                <div>
                  <dt>Origem</dt>
                  <dd>{show.url ? <a href={show.url} target="_blank" rel="noreferrer">TVmaze</a> : "não informado"}</dd>
                </div>
                <div>
                  <dt>Nota IMDb</dt>
                  <dd>{show.ratingAverage ? `${show.ratingAverage.toFixed(1)} / 10` : "não informado"}</dd>
                </div>
                <div>
                  <dt>IMDb</dt>
                  <dd>{show.imdbUrl ? <a href={show.imdbUrl} target="_blank" rel="noreferrer">Abrir no IMDb</a> : "não informado"}</dd>
                </div>
                <div>
                  <dt>Trailer</dt>
                  <dd>{trailerUrl ? <a href={trailerUrl} target="_blank" rel="noreferrer">Buscar no YouTube</a> : "não informado"}</dd>
                </div>
              </dl>
            </div>
          </section>

          {galleryImages.length > 0 ? (
            <section className="series-gallery" aria-label={`Imagens de ${show.name}`}>
              <h2>Imagens</h2>
              <div className="gallery-track">
                {galleryImages.map((image, index) => (
                  <img src={image} alt={`Imagem ${index + 1} de ${show.name}`} loading="lazy" key={image} />
                ))}
              </div>
            </section>
          ) : null}

          <section className="season-list">
            <h2>Temporadas</h2>
            {seasons.map((season) => (
              <details className="season-block season-accordion" key={season.season} open>
                <summary>
                  <h3>Temporada {season.season}</h3>
                  <span>{season.episodes.length} episódios</span>
                </summary>
                <div className="episode-table">
                  {season.episodes.map((episode) => (
                    <Link
                      href={`/episode/${episode.episodeId}`}
                      className={`episode-row ${hasReleased(episode.airdate, episode.airstamp) ? "episode-row-released" : ""}`}
                      key={episode.episodeId}
                    >
                      <span>{episode.episodeCode}</span>
                      <strong>{episode.episodeTitle}</strong>
                      <span>{formatDateInBrazil(episode.airdate, episode.airstamp)}</span>
                      <span>{formatTimeInBrazil(episode.airstamp)}</span>
                      <span className="row-badges">
                        <EpisodeBadge type={episode.episodeType} />
                        {episode.isSeasonFinale && episode.episodeType !== "season_finale" ? <FinaleBadge /> : null}
                      </span>
                    </Link>
                  ))}
                </div>
              </details>
            ))}
          </section>
        </>
      ) : null}
    </main>
  );
}

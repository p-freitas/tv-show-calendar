import { Link } from "../App";
import { FinaleBadge } from "./Badge";
import type { CalendarEpisode } from "../types/domain";

export function EpisodeCard({ episode }: { episode: CalendarEpisode }) {
  const href = `/series/${episode.tvmazeShowId ?? episode.showId}`;
  const meta = episode.isSeriesPremiere
    ? "estreia da série"
    : episode.isSeasonPremiere
      ? "estreia de temporada"
      : episode.isSeasonFinale
        ? "final de temporada"
        : "";
  const content = (
    <>
      <div className="episode-card-top" title={`${episode.showName} — ${episode.episodeCode}`}>
        <strong>{episode.showName}</strong>
        <span className="episode-code">{episode.episodeCode}</span>
      </div>
      {meta ? <div className="episode-title">{meta}</div> : null}
      {episode.isSeasonFinale && episode.episodeType !== "season_finale" ? <FinaleBadge /> : null}
    </>
  );

  if (!href) {
    return <div className={`episode-card episode-${episode.episodeType}`}>{content}</div>;
  }

  return (
    <Link className={`episode-card episode-${episode.episodeType}`} href={href}>
      {content}
    </Link>
  );
}

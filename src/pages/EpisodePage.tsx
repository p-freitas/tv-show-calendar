import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useRouter } from "../App";
import { EpisodeBadge, FinaleBadge } from "../components/Badge";
import { episodeDateKey, formatDateInBrazil, formatTimeInBrazil, relativeReleaseLabel, toMonthPath } from "../lib/dates";
import { tvmaze } from "../services/tvmaze";
import type { CalendarEpisode } from "../types/domain";
import { ReleaseCountdown } from "../components/ReleaseCountdown";
import { FollowButton } from "../components/FollowButton";
import { NotificationStatus } from "../components/NotificationStatus";
import { CheckIcon } from "../components/Icons";
import { useNotifications } from "../state/NotificationsProvider";

export function EpisodePage({ episodeId, year, month }: { episodeId: number; year?: number; month?: number }) {
  const [, forceTick] = useState(0);
  const { search } = useRouter();
  const notificationId = new URLSearchParams(search).get("notification");
  const notificationLink = Boolean(notificationId && /^\d+:\d+$/.test(notificationId) && notificationId.split(":")[1] === String(episodeId));
  const { isFollowing, feed, markRead } = useNotifications();
  const acknowledged = useRef<string | null>(null);
  const query = useQuery({
    queryKey: year && month ? ["calendar-episode", year, month, episodeId] : ["episode", episodeId, notificationLink ? "notification" : "detail"],
    queryFn: () => (year && month ? tvmaze.getCalendarEpisode(year, month, episodeId) : tvmaze.getEpisode(episodeId, notificationLink)),
    staleTime: notificationLink ? 60_000 : 1000 * 60 * 60,
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
  const fromNotification = Boolean(show && notificationId === `${show.showId}:${episodeId}` && !year && !month);
  const following = show ? isFollowing(show.showId) : false;

  useEffect(() => {
    if (!fromNotification || !notificationId || acknowledged.current === notificationId) return;
    if (!feed?.notifications.some((item) => item.id === notificationId && !item.read)) return;
    acknowledged.current = notificationId;
    markRead(notificationId);
  }, [feed, fromNotification, notificationId, markRead]);

  return (
    <main className="page-shell detail-page">
      {query.isLoading ? <div className="hero-skeleton" /> : null}
      {query.isError ? <section className="empty-state"><p>Não foi possível carregar o episódio.</p>
        <button type="button" className="secondary-button" onClick={() => void query.refetch()}>Tentar novamente</button>
        {notificationLink ? <Link href="/notifications" className="text-link"> Voltar para as notificações</Link> : null}</section> : null}

      {episode && show && displayEpisode ? (
        <>
          <nav className="breadcrumb">
            <Link href={`/series/${show.showId}`}>Voltar para {show.name}</Link>
            <Link href={calendarHref}>Calendário do mês</Link>
          </nav>

          {fromNotification ? <section className="notification-episode-context">
            <div className="notification-context-top"><span className="following-status"><CheckIcon />{following ? "Você está acompanhando esta série" : "Notificação de lançamento"}</span>
              <div className="notification-context-links"><Link href="/notifications">Todas as notificações →</Link><Link href="/notifications?tab=following">Séries que acompanho →</Link></div></div>
            <div className="notification-series-info">{show.image ? <img src={show.image} alt="" /> : null}<div><p className="eyebrow">Sobre a série</p><Link href={`/series/${show.showId}`}><h2>{show.name}</h2></Link>
              <p>{[show.webChannel?.name ?? show.network?.name, show.genres.join(" · "), show.language].filter(Boolean).join(" / ")}</p>
              <p className="notification-series-summary">{show.summary || "Sinopse da série não informada."}</p></div><FollowButton showId={show.showId} /></div>
            <NotificationStatus />
            <ReleaseCountdown airstamp={enrichedAirstamp} airdate={displayEpisode.airdate} />
          </section> : null}

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
                {!fromNotification ? <div>
                  <dt>Contagem</dt>
                  <dd>{relativeReleaseLabel(enrichedAirstamp)}</dd>
                </div> : null}
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

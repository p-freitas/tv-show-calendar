import { useEffect, useState } from "react";
import { Link, useRouter } from "../App";
import { FollowButton } from "../components/FollowButton";
import { BellIcon } from "../components/Icons";
import { NotificationItem } from "../components/NotificationItem";
import { NotificationStatus } from "../components/NotificationStatus";
import { formatDateInBrazil, formatTimeInBrazil } from "../lib/dates";
import { useNotifications } from "../state/NotificationsProvider";

export function NotificationsPage() {
  const { search, navigate } = useRouter();
  const following = new URLSearchParams(search).get("tab") === "following";
  const [filter, setFilter] = useState("");
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [visible, setVisible] = useState(20);
  const { feed, loading, acting, refreshing, markAllRead, refresh } = useNotifications();
  const query = filter.toLocaleLowerCase("pt-BR").trim();
  const notifications = (feed?.notifications ?? []).filter((item) => (!unreadOnly || !item.read) && `${item.showName} ${item.episodeTitle} ${item.episodeCode}`.toLocaleLowerCase("pt-BR").includes(query));
  const shows = (feed?.followedShows ?? []).filter((show) => show.name.toLocaleLowerCase("pt-BR").includes(query));
  useEffect(() => { setVisible(20); }, [filter, unreadOnly, following]);

  return <main className="page-shell detail-page notification-center">
    <nav className="breadcrumb"><Link href="/">Voltar ao calendário</Link></nav>
    <header className="center-heading"><div><p className="eyebrow">Seus lançamentos, em um só lugar</p><h1>Central de notificações</h1>
      <p>Acompanhe suas séries e saiba quando os novos episódios chegam.</p></div>
      <button type="button" className="secondary-button" disabled={refreshing} onClick={refresh}>{refreshing ? "Atualizando…" : "Atualizar"}</button></header>
    <div className="center-stats"><div><strong>{feed?.unreadCount ?? 0}</strong><span>{feed?.unreadCount === 1 ? "não lida" : "não lidas"}</span></div><div><strong>{feed?.followedShows.length ?? 0}</strong><span>{feed?.followedShows.length === 1 ? "série acompanhada" : "séries acompanhadas"}</span></div><div><strong>{feed?.notifications.length ?? 0}</strong><span>{feed?.notifications.length === 1 ? "notificação" : "notificações"}</span></div></div>
    <NotificationStatus />
    <div className="center-tabs" role="tablist" aria-label="Conteúdo da central">
      <button type="button" role="tab" aria-selected={!following} aria-controls="notifications-tabpanel" id="notifications-tab" onClick={() => navigate("/notifications")}>Notificações <span>{feed?.notifications.length ?? 0}</span></button>
      <button type="button" role="tab" aria-selected={following} aria-controls="following-tabpanel" id="following-tab" onClick={() => navigate("/notifications?tab=following")}>Acompanhando <span>{feed?.followedShows.length ?? 0}</span></button>
    </div>
    <div className="center-toolbar"><label className="center-search"><span className="sr-only">Buscar {following ? "séries" : "notificações"}</span><input type="search" placeholder={following ? "Buscar uma série…" : "Buscar série ou episódio…"} value={filter} onChange={(event) => setFilter(event.target.value)} /></label>
      {!following ? <><label className="unread-filter"><input type="checkbox" checked={unreadOnly} onChange={(event) => setUnreadOnly(event.target.checked)} />Só não lidas</label>
        <button type="button" className="text-button" disabled={acting || !feed?.unreadCount} onClick={markAllRead}>Marcar todas como lidas</button></> : null}</div>
    {loading ? <div className="hero-skeleton" aria-label="Carregando central" role="status" /> : null}
    {following ? <section role="tabpanel" id="following-tabpanel" aria-labelledby="following-tab" className="following-grid">
      {shows.map((show) => <article className="following-card" key={show.showId}>
        <Link href={`/series/${show.showId}`} className="following-poster">{show.image ? <img src={show.image} alt={`Pôster de ${show.name}`} loading="lazy" /> : <span aria-hidden="true">TV</span>}</Link>
        <div className="following-card-copy"><Link href={`/series/${show.showId}`}><h2>{show.name}</h2></Link>
          <p className="following-platform">{show.platform ?? "Plataforma não informada"}{show.status ? ` · ${show.status}` : ""}</p>
          <p className="following-genres">{show.genres.join(" · ")}</p>
          <p className="following-next">{show.unavailable ? "Não foi possível atualizar esta série agora." : show.nextEpisode ? <><span>Próximo episódio</span><Link href={`/episode/${show.nextEpisode.episodeId}`}>{show.nextEpisode.episodeCode} · {show.nextEpisode.episodeTitle}</Link><time dateTime={show.nextEpisode.airstamp ?? undefined}>{formatDateInBrazil(show.nextEpisode.airdate, show.nextEpisode.airstamp)} às {formatTimeInBrazil(show.nextEpisode.airstamp)} · Brasília</time></> : "Nenhum próximo lançamento confirmado."}</p>
          <FollowButton showId={show.showId} /><span className="following-since">Acompanhando desde {formatDateInBrazil(null, show.followedAt)}</span></div>
      </article>)}
      {!loading && feed && !shows.length ? <div className="center-empty"><BellIcon size={36} /><h2>{query ? "Nenhuma série encontrada" : "Sua lista começa com uma série"}</h2><p>{query ? "Tente buscar por outro nome." : "Abra os detalhes de uma série e clique em Acompanhar série. Os próximos lançamentos aparecerão aqui."}</p><Link href="/" className="primary-button">Explorar o calendário</Link></div> : null}
    </section> : <section role="tabpanel" id="notifications-tabpanel" aria-labelledby="notifications-tab" className="center-notification-list">
      {notifications.slice(0, visible).map((notification) => <NotificationItem notification={notification} key={notification.id} />)}
      {!loading && feed && !notifications.length ? <div className="center-empty"><BellIcon size={36} /><h2>{query ? "Nenhuma notificação encontrada" : unreadOnly ? "Você está em dia" : "Aguardando os próximos lançamentos"}</h2><p>{query ? "Tente buscar por outra série ou episódio." : "As notificações aparecem para episódios lançados depois que você começa a acompanhar uma série."}</p><Link href="/notifications?tab=following" className="primary-button">Ver séries que acompanho</Link></div> : null}
      {notifications.length > visible ? <button type="button" className="secondary-button load-more" onClick={() => setVisible((value) => value + 20)}>Mostrar mais ({notifications.length - visible})</button> : null}
    </section>}
    <p className="following-note">Seu acompanhamento fica salvo neste navegador. Os lançamentos são consultados automaticamente a cada minuto enquanto o site está aberto, inclusive quando você volta a acessá-lo.</p>
    <footer className="footer-note">Lançamentos e informações das séries: <a href="https://www.tvmaze.com" target="_blank" rel="noreferrer">TVmaze</a>. Horários convertidos para Brasília.</footer>
  </main>;
}

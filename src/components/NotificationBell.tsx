import { useEffect, useRef, useState } from "react";
import { Link, useRouter } from "../App";
import { useNotifications } from "../state/NotificationsProvider";
import { BellIcon } from "./Icons";
import { NotificationItem } from "./NotificationItem";
import { NotificationStatus } from "./NotificationStatus";

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const { path, search } = useRouter();
  const { feed, loading, acting, markAllRead } = useNotifications();
  const unread = feed?.unreadCount ?? 0;

  useEffect(() => { setOpen(false); }, [path, search]);
  useEffect(() => {
    if (!open) return;
    panel.current?.focus();
    const onPointer = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false); };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") { setOpen(false); button.current?.focus(); }
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("pointerdown", onPointer); document.removeEventListener("keydown", onKey); };
  }, [open]);

  return <div className="notification-bell-wrap" ref={root}>
    <button type="button" className="notification-bell" ref={button} aria-label={`Notificações${unread ? `: ${unread} não ${unread === 1 ? "lida" : "lidas"}` : ""}`}
      aria-expanded={open} aria-haspopup="dialog" aria-controls="notification-panel" onClick={() => setOpen((value) => !value)}>
      <BellIcon />{unread > 0 ? <span className="notification-count" aria-hidden="true">{unread}</span> : null}
    </button>
    <span className="sr-only" role="status" aria-live="polite">{unread > 0 ? `${unread} ${unread === 1 ? "notificação não lida" : "notificações não lidas"}` : "Nenhuma notificação não lida"}</span>
    {open ? <div className="notification-panel" id="notification-panel" role="dialog" aria-label="Suas notificações" tabIndex={-1} ref={panel}>
      <div className="notification-panel-heading"><div><h2>Notificações</h2><p>{unread ? `${unread} não ${unread === 1 ? "lida" : "lidas"}` : "Você está em dia"}</p></div>
        <button type="button" className="icon-button" aria-label="Fechar notificações" onClick={() => { setOpen(false); button.current?.focus(); }}>×</button></div>
      <div className="notification-panel-body">
        <NotificationStatus />
        {loading ? <p className="notification-empty" role="status">Carregando notificações…</p> : null}
        {feed?.notifications.slice(0, 5).map((notification) => <NotificationItem notification={notification} key={notification.id} onNavigate={() => setOpen(false)} />)}
        {!loading && feed && !feed.notifications.length ? <div className="notification-empty"><BellIcon size={30} />
          <strong>Nenhum lançamento novo por aqui</strong><p>{feed.followedShows.length ? "Os próximos episódios das séries que você acompanha aparecerão aqui quando lançarem." : "Abra uma série e clique em Acompanhar série para receber novidades."}</p></div> : null}
      </div>
      <div className="notification-panel-footer">
        {unread > 0 ? <button type="button" className="text-button" disabled={acting} onClick={markAllRead}>Marcar todas como lidas</button> : null}
        <Link href="/notifications" className="central-link" onNavigate={() => setOpen(false)}>Ver todas as notificações <span aria-hidden="true">→</span></Link>
        <Link href="/notifications?tab=following" className="central-link secondary" onNavigate={() => setOpen(false)}>Séries que acompanho <span>{feed?.followedShows.length ?? 0}</span></Link>
      </div>
    </div> : null}
  </div>;
}

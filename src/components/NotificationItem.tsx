import { Link } from "../App";
import { formatDateInBrazil, formatTimeInBrazil } from "../lib/dates";
import type { EpisodeNotification } from "../types/notifications";

export function NotificationItem({ notification, onNavigate }: { notification: EpisodeNotification; onNavigate?: () => void }) {
  return <Link href={`/episode/${notification.episodeId}?notification=${encodeURIComponent(notification.id)}`}
    className={`notification-item${notification.read ? " is-read" : " is-unread"}`} onNavigate={onNavigate}>
    {notification.showImage ? <img src={notification.showImage} alt="" loading="lazy" /> : <span className="notification-image-fallback" aria-hidden="true">TV</span>}
    <div className="notification-copy">
      <span className="notification-show">{notification.showName}<span className="notification-unread-dot" title={notification.read ? "Lida" : "Não lida"} /></span>
      <strong>{notification.episodeCode} · {notification.episodeTitle}</strong>
      <span className="notification-caption">Novo episódio lançado{notification.platform ? ` · ${notification.platform}` : ""}</span>
      <time dateTime={notification.releasedAt}>{formatDateInBrazil(null, notification.releasedAt)} às {formatTimeInBrazil(notification.releasedAt)} · Brasília</time>
    </div>
    <span className="notification-arrow" aria-hidden="true">›</span>
    <span className="sr-only">{notification.read ? "Notificação lida" : "Notificação não lida"}. Ver detalhes do episódio.</span>
  </Link>;
}

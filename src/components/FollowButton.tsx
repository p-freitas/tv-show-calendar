import { useNotifications } from "../state/NotificationsProvider";
import { MAX_FOLLOWED_SHOWS } from "../config/notifications";
import { BellIcon, CheckIcon } from "./Icons";

export function FollowButton({ showId }: { showId: number }) {
  const { isFollowing, follow, unfollow, loading, error, acting, pendingShowId, feed } = useNotifications();
  const following = isFollowing(showId);
  const full = !following && (feed?.followedShows.length ?? 0) >= MAX_FOLLOWED_SHOWS;
  return <button type="button" className={`follow-button${following ? " is-following" : ""}`}
    aria-pressed={following} disabled={loading || Boolean(error && !feed) || acting || full}
    title={full ? `Limite de ${MAX_FOLLOWED_SHOWS} séries. Gerencie o acompanhamento na central.` : following ? "Clique para deixar de acompanhar esta série" : "Receba uma notificação quando um novo episódio lançar"}
    onClick={() => following ? unfollow(showId) : follow(showId)}>
    {following ? <CheckIcon /> : <BellIcon size={18} />}
    {pendingShowId === showId ? "Salvando…" : loading ? "Carregando…" : following ? "Acompanhando" : "Acompanhar série"}
  </button>;
}

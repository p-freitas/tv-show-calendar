import { createContext, useContext, useEffect, useRef } from "react";
import type { ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { NOTIFICATIONS_POLL_INTERVAL_MS } from "../config/notifications";
import { getNotificationFeed, updateNotifications } from "../services/notifications";
import type { FollowedShow, NotificationAction, NotificationFeed } from "../types/notifications";

const QUERY_KEY = ["notification-feed"];

function useNotificationState() {
  const queryClient = useQueryClient();
  const channel = useRef<BroadcastChannel | null>(null);
  const query = useQuery({
    queryKey: QUERY_KEY,
    queryFn: async ({ signal }) => {
      const feed = await getNotificationFeed(signal);
      // Keep the last summaries if only some upstream show lookups fail.
      const previous = queryClient.getQueryData<NotificationFeed>(QUERY_KEY);
      if (previous && feed.failedShowIds.length > 0) {
        const failed = new Set(feed.failedShowIds);
        feed.notifications.push(...previous.notifications.filter((item) => failed.has(item.showId)));
        feed.notifications.sort((a, b) => b.releasedAt.localeCompare(a.releasedAt) || b.episodeId - a.episodeId);
        feed.followedShows = feed.followedShows.map((show) => show.unavailable
          ? { ...(previous.followedShows.find((item) => item.showId === show.showId) ?? show), unavailable: true } : show);
        feed.unreadCount = feed.notifications.filter((item) => !item.read).length;
      }
      return feed;
    },
    staleTime: 30_000,
    refetchInterval: NOTIFICATIONS_POLL_INTERVAL_MS,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
    retry: 1,
  });

  const mutation = useMutation({
    mutationFn: updateNotifications,
    onMutate: async () => { await queryClient.cancelQueries({ queryKey: QUERY_KEY }); },
    onSuccess: (result, action) => {
      queryClient.setQueryData<NotificationFeed>(QUERY_KEY, (previous) => {
        if (!previous) return previous;
        const followedIds = new Set(result.subscriptions.map((item) => item.showId));
        const notifications = previous.notifications.filter((item) => followedIds.has(item.showId)).map((item) => ({
          ...item, read: item.read || (action.action === "read" && action.notificationId === item.id) ||
            (action.action === "readAll" && Date.parse(item.releasedAt) <= Date.parse(action.through)),
        }));
        const followedShows: FollowedShow[] = result.subscriptions.map((subscription) => ({
          genres: [], ...previous.followedShows.find((item) => item.showId === subscription.showId), ...subscription,
        }));
        return { ...previous, notifications, followedShows, unreadCount: notifications.filter((item) => !item.read).length };
      });
      channel.current?.postMessage("changed");
      void queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    },
  });

  useEffect(() => {
    if (!("BroadcastChannel" in window)) return;
    const broadcast = new BroadcastChannel("tv-calendar-notifications");
    channel.current = broadcast;
    broadcast.onmessage = () => { void queryClient.invalidateQueries({ queryKey: QUERY_KEY }); };
    return () => { broadcast.close(); channel.current = null; };
  }, [queryClient]);

  const act = (action: NotificationAction) => { mutation.mutate(action); };
  return {
    feed: query.data,
    loading: query.isPending,
    refreshing: query.isFetching,
    error: query.error,
    actionError: mutation.error,
    acting: mutation.isPending,
    pendingShowId: mutation.isPending && "showId" in mutation.variables ? mutation.variables.showId : undefined,
    isFollowing: (showId: number) => query.data?.followedShows.some((show) => show.showId === showId) ?? false,
    follow: (showId: number) => act({ action: "follow", showId }),
    unfollow: (showId: number) => act({ action: "unfollow", showId }),
    markRead: (notificationId: string) => act({ action: "read", notificationId }),
    markAllRead: () => { if (query.data) act({ action: "readAll", through: query.data.generatedAt }); },
    refresh: () => { void query.refetch(); },
    dismissActionError: mutation.reset,
  };
}

const NotificationsContext = createContext<ReturnType<typeof useNotificationState> | null>(null);

export function NotificationsProvider({ children }: { children: ReactNode }) {
  return <NotificationsContext.Provider value={useNotificationState()}>{children}</NotificationsContext.Provider>;
}

export function useNotifications() {
  const context = useContext(NotificationsContext);
  if (!context) throw new Error("useNotifications precisa estar dentro de NotificationsProvider.");
  return context;
}

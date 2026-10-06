import type { Episode, Show } from "./domain";

export type Subscription = {
  showId: number;
  name: string;
  followedAt: string;
};

export type FollowedShow = Subscription & {
  image?: string | null;
  platform?: string;
  status?: string;
  genres: string[];
  nextEpisode?: Episode;
  unavailable?: boolean;
};

export type EpisodeNotification = {
  id: string;
  showId: number;
  showName: string;
  showImage?: string | null;
  platform?: string;
  episodeId: number;
  episodeCode: string;
  episodeTitle: string;
  releasedAt: string;
  read: boolean;
};

export type NotificationFeed = {
  notifications: EpisodeNotification[];
  followedShows: FollowedShow[];
  unreadCount: number;
  generatedAt: string;
  failedShowIds: number[];
  stateReset: boolean;
};

export type NotificationAction =
  | { action: "follow"; showId: number }
  | { action: "unfollow"; showId: number }
  | { action: "read"; notificationId: string }
  | { action: "readAll"; through: string };

export type NotificationMutationResult = {
  subscriptions: Subscription[];
};

export type ShowCatalog = { show: Show; episodes: Episode[] };

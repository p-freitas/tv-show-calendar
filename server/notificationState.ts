import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { deflateRawSync, inflateRawSync } from "node:zlib";
import { MAX_FOLLOWED_SHOWS } from "../src/config/notifications.js";

export const NOTIFICATIONS_COOKIE = "tv-calendar-following";
export const COOKIE_MAX_AGE = 60 * 60 * 24 * 365;
const MAX_COOKIE_VALUE_BYTES = 3_800;

export type FollowRecord = {
  showId: number;
  name: string;
  followedAt: number;
  readThrough: number;
  readEpisodeIds: number[];
};

export type NotificationState = { follows: FollowRecord[] };

export class NotificationError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

function encryptionKey(secret: string): Buffer {
  if (secret.length < 32) {
    throw new NotificationError(503, "O acompanhamento ainda não foi configurado no servidor (NOTIFICATIONS_SECRET).");
  }
  return createHash("sha256").update(secret).digest();
}

export function sealNotificationState(state: NotificationState, secret: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(secret), iv);
  cipher.setAAD(Buffer.from(NOTIFICATIONS_COOKIE));
  // Compact tuples keep the persistent cookie comfortably below browser limits.
  const compact = state.follows.map((follow) => [
    follow.showId, follow.name, follow.followedAt, follow.readThrough, follow.readEpisodeIds,
  ]);
  const compressed = deflateRawSync(Buffer.from(JSON.stringify([1, compact])));
  const encrypted = Buffer.concat([cipher.update(compressed), cipher.final()]);
  const token = Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString("base64url");
  if (token.length > MAX_COOKIE_VALUE_BYTES) {
    throw new NotificationError(409, "O histórico de leitura está cheio. Marque todas as notificações como lidas para continuar.");
  }
  return token;
}

export function openNotificationState(token: string, secret: string): NotificationState {
  const key = encryptionKey(secret);
  if (token.length > MAX_COOKIE_VALUE_BYTES || !/^[\w-]+$/.test(token)) throw new Error("Cookie inválido.");
  const bytes = Buffer.from(token, "base64url");
  if (bytes.length < 29) throw new Error("Cookie incompleto.");
  const decipher = createDecipheriv("aes-256-gcm", key, bytes.subarray(0, 12));
  decipher.setAAD(Buffer.from(NOTIFICATIONS_COOKIE));
  decipher.setAuthTag(bytes.subarray(12, 28));
  const compressed = Buffer.concat([decipher.update(bytes.subarray(28)), decipher.final()]);
  const value: unknown = JSON.parse(inflateRawSync(compressed, { maxOutputLength: 65_536 }).toString());
  if (!Array.isArray(value) || value.length !== 2 || value[0] !== 1 || !Array.isArray(value[1])) throw new Error("Estado inválido.");
  if (value[1].length > MAX_FOLLOWED_SHOWS) throw new Error("Limite de séries excedido.");
  const ids = new Set<number>();
  const follows: FollowRecord[] = value[1].map((item: unknown) => {
    if (!Array.isArray(item) || item.length !== 5) throw new Error("Série inválida.");
    const [showId, name, followedAt, readThrough, readEpisodeIds] = item;
    if (!Number.isSafeInteger(showId) || showId <= 0 || ids.has(showId) || typeof name !== "string" || name.length > 120 ||
      !Number.isSafeInteger(followedAt) || followedAt <= 0 || !Number.isSafeInteger(readThrough) || readThrough < followedAt ||
      !Array.isArray(readEpisodeIds) || readEpisodeIds.some((id: unknown) => !Number.isSafeInteger(id) || Number(id) <= 0)) {
      throw new Error("Série inválida.");
    }
    ids.add(showId);
    return { showId, name, followedAt, readThrough, readEpisodeIds };
  });
  return { follows };
}

export function notificationCookie(value: string, secure: boolean, clear = false): string {
  return `${NOTIFICATIONS_COOKIE}=${value}; Path=/api; Max-Age=${clear ? 0 : COOKIE_MAX_AGE}; HttpOnly; SameSite=Strict${secure ? "; Secure" : ""}`;
}

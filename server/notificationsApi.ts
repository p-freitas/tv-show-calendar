import type { IncomingMessage, ServerResponse } from "node:http";
import { MAX_FOLLOWED_SHOWS } from "../src/config/notifications.js";
import type { Episode } from "../src/types/domain.js";
import type { EpisodeNotification, FollowedShow, NotificationAction, NotificationFeed, ShowCatalog, Subscription } from "../src/types/notifications.js";
import { getNotificationCatalog } from "./notificationCatalog.js";
import { NOTIFICATIONS_COOKIE, NotificationError, notificationCookie, openNotificationState, sealNotificationState } from "./notificationState.js";
import type { NotificationState } from "./notificationState.js";

type NotificationRequest = IncomingMessage & { body?: unknown };
type CatalogLoader = (showId: number) => Promise<ShowCatalog>;
type ApiOptions = { secret?: string; loadCatalog?: CatalogLoader; now?: () => number };

function withCatalogBudget(loadCatalog: CatalogLoader): CatalogLoader {
  const deadline = Date.now() + 45_000;
  return async (showId) => {
    const remaining = deadline - Date.now();
    if (remaining <= 0) throw new Error("Tempo de consulta excedido.");
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([loadCatalog(showId), new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error("Tempo de consulta excedido.")), remaining);
      })]);
    } finally { clearTimeout(timer); }
  };
}

function releaseTime(episode: Episode): number | null {
  if (!episode.airstamp) return null;
  const time = Date.parse(episode.airstamp);
  return Number.isFinite(time) ? time : null;
}

export async function buildNotificationFeed(state: NotificationState, loadCatalog: CatalogLoader, now: number): Promise<NotificationFeed> {
  const loadWithinBudget = withCatalogBudget(loadCatalog);
  const notifications = new Map<string, EpisodeNotification>();
  const followedShows: FollowedShow[] = [];
  const failedShowIds: number[] = [];
  // Limit upstream concurrency rather than issuing a request for every series at once.
  let index = 0;
  await Promise.all(Array.from({ length: Math.min(2, state.follows.length) }, async () => {
    while (index < state.follows.length) {
      const follow = state.follows[index++];
      try {
        const { show, episodes } = await loadWithinBudget(follow.showId);
        const platform = show.webChannel?.name ?? show.network?.name;
        const nextEpisode = episodes.filter((episode) => (releaseTime(episode) ?? 0) > now)
          .sort((a, b) => releaseTime(a)! - releaseTime(b)!)[0];
        followedShows.push({ showId: follow.showId, name: show.name, followedAt: new Date(follow.followedAt).toISOString(),
          image: show.image, platform, status: show.status, genres: show.genres, nextEpisode });
        for (const episode of episodes) {
          const releasedAt = releaseTime(episode);
          // A date without an exact broadcast time must not create a premature notification.
          if (releasedAt === null || releasedAt <= follow.followedAt || releasedAt > now) continue;
          const id = `${follow.showId}:${episode.episodeId}`;
          notifications.set(id, { id, showId: follow.showId, showName: show.name, showImage: show.image, platform,
            episodeId: episode.episodeId, episodeCode: episode.episodeCode, episodeTitle: episode.episodeTitle,
            releasedAt: new Date(releasedAt).toISOString(), read: releasedAt <= follow.readThrough || follow.readEpisodeIds.includes(episode.episodeId) });
        }
      } catch {
        failedShowIds.push(follow.showId);
        followedShows.push({ showId: follow.showId, name: follow.name, followedAt: new Date(follow.followedAt).toISOString(),
          genres: [], unavailable: true });
      }
    }
  }));
  const items = [...notifications.values()].sort((a, b) => b.releasedAt.localeCompare(a.releasedAt) || b.episodeId - a.episodeId);
  return { notifications: items, followedShows: followedShows.sort((a, b) => a.name.localeCompare(b.name, "pt-BR")),
    unreadCount: items.filter((item) => !item.read).length, generatedAt: new Date(now).toISOString(), failedShowIds, stateReset: false };
}

export function subscriptionsFromState(state: NotificationState): Subscription[] {
  return state.follows.map(({ showId, name, followedAt }) => ({ showId, name, followedAt: new Date(followedAt).toISOString() }));
}

export async function applyNotificationAction(state: NotificationState, action: NotificationAction, loadCatalog: CatalogLoader, now: number): Promise<NotificationState> {
  const next = structuredClone(state);
  if (action.action === "follow") {
    if (next.follows.some((follow) => follow.showId === action.showId)) return next;
    if (next.follows.length >= MAX_FOLLOWED_SHOWS) throw new NotificationError(409, `Você pode acompanhar até ${MAX_FOLLOWED_SHOWS} séries neste navegador.`);
    let catalog: ShowCatalog;
    try { catalog = await loadCatalog(action.showId); }
    catch { throw new NotificationError(502, "Não foi possível consultar a série. Tente novamente."); }
    next.follows.push({ showId: action.showId, name: catalog.show.name.slice(0, 120), followedAt: now, readThrough: now, readEpisodeIds: [] });
  } else if (action.action === "unfollow") {
    next.follows = next.follows.filter((follow) => follow.showId !== action.showId);
  } else if (action.action === "readAll") {
    const through = Date.parse(action.through);
    if (!Number.isFinite(through) || through > now) throw new NotificationError(400, "Data de leitura inválida.");
    for (const follow of next.follows) {
      follow.readThrough = Math.max(follow.readThrough, through);
      if (follow.readEpisodeIds.length > 0) {
        // Preserve individually read episodes newer than the feed that was displayed.
        try {
          const { episodes } = await loadCatalog(follow.showId);
          follow.readEpisodeIds = follow.readEpisodeIds.filter((id) => {
            const episode = episodes.find((item) => item.episodeId === id);
            return !episode || (releaseTime(episode) ?? Infinity) > follow.readThrough;
          });
        } catch { /* Keep acknowledgements if this series cannot be refreshed. */ }
      }
    }
  } else {
    const [showId, episodeId] = action.notificationId.split(":").map(Number);
    const follow = next.follows.find((item) => item.showId === showId);
    if (!follow) throw new NotificationError(404, "Você não está acompanhando esta série.");
    let episodes: Episode[];
    try { ({ episodes } = await loadCatalog(showId)); }
    catch { throw new NotificationError(502, "Não foi possível marcar a notificação como lida. Tente novamente."); }
    const episode = episodes.find((item) => item.episodeId === episodeId);
    const releasedAt = episode ? releaseTime(episode) : null;
    if (releasedAt === null || releasedAt <= follow.followedAt || releasedAt > now) throw new NotificationError(404, "Notificação não encontrada.");
    if (!follow.readEpisodeIds.includes(episodeId) && releasedAt > follow.readThrough) follow.readEpisodeIds.push(episodeId);
    // Fold consecutive read releases into a watermark without losing unread episodes
    // that share the same release time (for example, a complete streaming season).
    const byTime = new Map<number, number[]>();
    for (const item of episodes) {
      const time = releaseTime(item);
      if (time === null || time <= follow.readThrough || time > now) continue;
      byTime.set(time, [...(byTime.get(time) ?? []), item.episodeId]);
    }
    for (const [time, ids] of [...byTime].sort(([a], [b]) => a - b)) {
      if (!ids.every((id) => follow.readEpisodeIds.includes(id))) break;
      follow.readThrough = time;
    }
    follow.readEpisodeIds = follow.readEpisodeIds.filter((id) => {
      const item = episodes.find((entry) => entry.episodeId === id);
      return !item || (releaseTime(item) ?? Infinity) > follow.readThrough;
    });
  }
  return next;
}

function parseAction(value: unknown, method: string): NotificationAction {
  if (!value || typeof value !== "object") throw new NotificationError(400, "Ação inválida.");
  const body = value as Record<string, unknown>;
  if ((body.action === "follow" && method === "POST") || (body.action === "unfollow" && method === "DELETE")) {
    if (!Number.isSafeInteger(body.showId) || Number(body.showId) <= 0) throw new NotificationError(400, "Série inválida.");
    return { action: body.action, showId: Number(body.showId) };
  }
  if (body.action === "read" && method === "PATCH" && typeof body.notificationId === "string" && /^\d{1,10}:\d{1,10}$/.test(body.notificationId)) {
    return { action: "read", notificationId: body.notificationId };
  }
  if (body.action === "readAll" && method === "PATCH" && typeof body.through === "string" && body.through.length < 40) {
    return { action: "readAll", through: body.through };
  }
  throw new NotificationError(400, "Ação inválida para este método.");
}

async function readBody(request: NotificationRequest): Promise<unknown> {
  if (request.body !== undefined) {
    const serialized = typeof request.body === "string" ? request.body : JSON.stringify(request.body);
    if (Buffer.byteLength(serialized) > 4_096) throw new NotificationError(413, "Pedido muito grande.");
    try { return typeof request.body === "string" ? JSON.parse(request.body) : request.body; }
    catch { throw new NotificationError(400, "JSON inválido."); }
  }
  let size = 0;
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    const buffer = Buffer.from(chunk);
    size += buffer.length;
    if (size > 4_096) throw new NotificationError(413, "Pedido muito grande.");
    chunks.push(buffer);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString()); }
  catch { throw new NotificationError(400, "JSON inválido."); }
}

export async function handleNotificationsApiRequest(request: NotificationRequest, response: ServerResponse, options: ApiOptions = {}): Promise<void> {
  response.setHeader("content-type", "application/json; charset=utf-8");
  response.setHeader("cache-control", "private, no-store, max-age=0");
  response.setHeader("vercel-cdn-cache-control", "no-store");
  response.setHeader("vary", "Cookie");
  try {
    const method = request.method ?? "GET";
    if (!["GET", "POST", "DELETE", "PATCH"].includes(method)) {
      response.setHeader("allow", "GET, POST, DELETE, PATCH");
      throw new NotificationError(405, "Método não permitido.");
    }
    const secret = options.secret ?? process.env.NOTIFICATIONS_SECRET ?? "";
    if (secret.length < 32) throw new NotificationError(503, "O acompanhamento ainda não foi configurado no servidor (NOTIFICATIONS_SECRET).");
    if (method !== "GET") {
      const origin = request.headers.origin;
      const host = request.headers.host;
      if (request.headers["sec-fetch-site"] === "cross-site" || (origin && new URL(String(origin)).host !== host)) {
        throw new NotificationError(403, "Origem não permitida.");
      }
      if (!String(request.headers["content-type"] ?? "").toLowerCase().startsWith("application/json")) throw new NotificationError(415, "Envie application/json.");
    }
    const secure = process.env.VERCEL === "1" || request.headers["x-forwarded-proto"] === "https";
    const cookie = (request.headers.cookie ?? "").split(";").map((part) => part.trim()).find((part) => part.startsWith(`${NOTIFICATIONS_COOKIE}=`));
    let state: NotificationState = { follows: [] };
    let stateReset = false;
    if (cookie) {
      try { state = openNotificationState(cookie.slice(NOTIFICATIONS_COOKIE.length + 1), secret); }
      catch { stateReset = true; response.setHeader("set-cookie", notificationCookie("", secure, true)); }
    }
    const loadCatalog = withCatalogBudget(options.loadCatalog ?? getNotificationCatalog);
    const now = (options.now ?? Date.now)();
    if (method === "GET") {
      const feed = await buildNotificationFeed(state, loadCatalog, now);
      response.statusCode = 200;
      response.end(JSON.stringify({ ...feed, stateReset }));
      return;
    }
    if (stateReset) throw new NotificationError(409, "O acompanhamento salvo não pôde ser recuperado. Atualize a página e acompanhe suas séries novamente.");
    const action = parseAction(await readBody(request), method);
    const next = await applyNotificationAction(state, action, loadCatalog, now);
    response.setHeader("set-cookie", notificationCookie(sealNotificationState(next, secret), secure));
    response.statusCode = 200;
    response.end(JSON.stringify({ subscriptions: subscriptionsFromState(next) }));
  } catch (error) {
    response.statusCode = error instanceof NotificationError ? error.status : 500;
    response.end(JSON.stringify({ error: error instanceof NotificationError ? error.message : "Não foi possível atualizar suas notificações. Tente novamente." }));
  }
}

export function createNotificationsApiMiddleware(options: ApiOptions = {}) {
  return (request: IncomingMessage, response: ServerResponse, next: () => void) => {
    if (new URL(request.url ?? "/", "http://localhost").pathname !== "/api/notifications") { next(); return; }
    void handleNotificationsApiRequest(request, response, options);
  };
}

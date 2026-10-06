import { createServer } from "node:http";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { Episode } from "../src/types/domain";
import type { NotificationFeed, ShowCatalog } from "../src/types/notifications";
import { MAX_FOLLOWED_SHOWS } from "../src/config/notifications";
import { applyNotificationAction, buildNotificationFeed, handleNotificationsApiRequest } from "./notificationsApi";
import { notificationCookie, openNotificationState, sealNotificationState } from "./notificationState";
import type { NotificationState } from "./notificationState";

const SECRET = "test-only-notifications-secret-at-least-32-characters";
const START = Date.parse("2026-10-05T20:00:00Z");
const RELEASE = START + 60_000;
const NOW = RELEASE + 60_000;

function episode(id: number, time: number | null, showId = 1): Episode {
  return { episodeId: id, showId, episodeCode: `S01E${String(id).padStart(2, "0")}`, episodeTitle: `Episódio ${id}`,
    airstamp: time === null ? null : new Date(time).toISOString(), airdate: "2026-10-05", episodeType: "regular",
    isSeriesPremiere: false, isSeasonPremiere: false, isSeasonFinale: false };
}

const catalog: ShowCatalog = { show: { showId: 1, name: "Série de teste", genres: ["Drama"], webChannel: { name: "Netflix" } },
  episodes: [episode(1, START - 1), episode(2, START), episode(3, RELEASE), episode(4, RELEASE), episode(5, NOW + 60_000), episode(6, null)] };
const loadCatalog = async (showId: number) => ({ ...catalog, show: { ...catalog.show, showId } });
const state: NotificationState = { follows: [{ showId: 1, name: "Série de teste", followedAt: START, readThrough: START, readEpisodeIds: [] }] };

describe("persistent encrypted notification state", () => {
  it("round-trips follow dates and acknowledgements without an in-memory session", () => {
    const input = { follows: [{ ...state.follows[0], readEpisodeIds: [4] }] };
    const token = sealNotificationState(input, SECRET);
    expect(openNotificationState(token, SECRET)).toEqual(input);
    expect(sealNotificationState(input, SECRET)).not.toBe(token);
    expect(token).not.toContain("Série");
  });
  it("rejects tampering, key changes, oversized cookies and missing secrets", () => {
    const token = sealNotificationState(state, SECRET);
    expect(() => openNotificationState(`A${token.slice(1, 20)}B${token.slice(21)}`, SECRET)).toThrow();
    expect(() => openNotificationState(token, `${SECRET}-different`)).toThrow();
    expect(() => openNotificationState("a".repeat(4_000), SECRET)).toThrow();
    expect(() => sealNotificationState(state, "short")).toThrow(/NOTIFICATIONS_SECRET/);
    const huge = { follows: [{ ...state.follows[0], readEpisodeIds: Array.from({ length: 10_000 }, (_, i) => i * 7919 + 1) }] };
    expect(() => sealNotificationState(huge, SECRET)).toThrow(/histórico de leitura/);
  });
  it("sets private, persistent cookies with the secure flag only over HTTPS", () => {
    expect(notificationCookie("token", true)).toContain("HttpOnly; SameSite=Strict; Secure");
    expect(notificationCookie("token", false)).not.toContain("Secure");
    expect(notificationCookie("token", true)).toContain("Path=/api; Max-Age=31536000");
    expect(notificationCookie("", true, true)).toContain("Max-Age=0");
  });
});

describe("notification generation and read state", () => {
  it("notifies only exact releases strictly after following, including simultaneous episodes", async () => {
    const feed = await buildNotificationFeed(state, loadCatalog, NOW);
    expect(feed.notifications.map((item) => item.id)).toEqual(["1:4", "1:3"]);
    expect(feed.unreadCount).toBe(2);
    expect(feed.followedShows[0].nextEpisode?.episodeId).toBe(5);
    expect(feed.notifications[0].platform).toBe("Netflix");
    expect((await buildNotificationFeed(state, loadCatalog, RELEASE - 1)).notifications).toEqual([]);
    expect((await buildNotificationFeed(state, loadCatalog, RELEASE)).notifications).toHaveLength(2);
  });
  it("deduplicates IDs and never guesses a release time from a date", async () => {
    const feed = await buildNotificationFeed(state, async () => ({ ...catalog, episodes: [...catalog.episodes, catalog.episodes[2], { ...episode(8, null), airstamp: "invalid" }] }), NOW);
    expect(feed.notifications).toHaveLength(2);
  });
  it("keeps subscriptions when upstream calls fail and limits concurrent lookups", async () => {
    let active = 0;
    let peak = 0;
    const follows = [1, 2, 3, 4].map((showId) => ({ ...state.follows[0], showId }));
    const feed = await buildNotificationFeed({ follows }, async (showId) => {
      active++; peak = Math.max(peak, active);
      await Promise.resolve(); active--;
      if (showId === 2) throw new Error("upstream unavailable");
      return loadCatalog(showId);
    }, NOW);
    expect(peak).toBeLessThanOrEqual(2);
    expect(feed.followedShows).toHaveLength(4);
    expect(feed.failedShowIds).toEqual([2]);
    expect(feed.followedShows.find((show) => show.showId === 2)?.unavailable).toBe(true);
  });
  it("follows idempotently and does not reset the original follow time", async () => {
    const followed = await applyNotificationAction({ follows: [] }, { action: "follow", showId: 1 }, loadCatalog, START);
    expect(followed).toEqual(state);
    expect(await applyNotificationAction(followed, { action: "follow", showId: 1 }, loadCatalog, NOW)).toEqual(state);
    expect((await buildNotificationFeed(followed, loadCatalog, NOW)).unreadCount).toBe(2);
  });
  it("returns a partial feed within the function deadline even if an upstream request hangs", async () => {
    vi.useFakeTimers();
    try {
      const input = { follows: [1, 2, 3].map((showId) => ({ ...state.follows[0], showId })) };
      const task = buildNotificationFeed(input, () => new Promise<ShowCatalog>(() => {}), NOW);
      await vi.advanceTimersByTimeAsync(45_000);
      const feed = await task;
      expect(feed.failedShowIds.sort()).toEqual([1, 2, 3]);
      expect(feed.followedShows).toHaveLength(3);
    } finally { vi.useRealTimers(); }
  });
  it("marks one streaming episode as read without acknowledging another at the same time", async () => {
    const read = await applyNotificationAction(state, { action: "read", notificationId: "1:4" }, loadCatalog, NOW);
    const feed = await buildNotificationFeed(read, loadCatalog, NOW);
    expect(feed.unreadCount).toBe(1);
    expect(feed.notifications.find((item) => item.id === "1:3")?.read).toBe(false);
    expect(read.follows[0].readThrough).toBe(START);
    const readBoth = await applyNotificationAction(read, { action: "read", notificationId: "1:3" }, loadCatalog, NOW);
    expect(readBoth.follows[0].readThrough).toBe(RELEASE);
    expect(readBoth.follows[0].readEpisodeIds).toEqual([]);
    expect((await buildNotificationFeed(readBoth, loadCatalog, NOW)).unreadCount).toBe(0);
    expect(state.follows[0].readEpisodeIds).toEqual([]);
  });
  it("marks the displayed feed as read without swallowing a release arriving later", async () => {
    const nextNow = NOW + 120_000;
    const readNew = await applyNotificationAction(state, { action: "read", notificationId: "1:5" }, loadCatalog, nextNow);
    const all = await applyNotificationAction(readNew, { action: "readAll", through: new Date(NOW).toISOString() }, loadCatalog, nextNow);
    expect(all.follows[0].readEpisodeIds).toEqual([5]);
    expect((await buildNotificationFeed(all, loadCatalog, nextNow)).unreadCount).toBe(0);
    const onlyAll = await applyNotificationAction(state, { action: "readAll", through: new Date(NOW).toISOString() }, loadCatalog, nextNow);
    expect((await buildNotificationFeed(onlyAll, loadCatalog, nextNow)).notifications.find((item) => item.episodeId === 5)?.read).toBe(false);
    const clean = await applyNotificationAction(readNew, { action: "readAll", through: new Date(nextNow).toISOString() }, loadCatalog, nextNow);
    expect(clean.follows[0].readEpisodeIds).toEqual([]);
  });
  it("rejects reading a future, old or unrelated episode", async () => {
    for (const notificationId of ["1:1", "1:2", "1:5", "2:3", "1:99"]) {
      await expect(applyNotificationAction(state, { action: "read", notificationId }, loadCatalog, NOW)).rejects.toMatchObject({ status: 404 });
    }
  });
  it("removes notifications when unfollowing and starts fresh on a later follow", async () => {
    const removed = await applyNotificationAction(state, { action: "unfollow", showId: 1 }, loadCatalog, NOW);
    expect((await buildNotificationFeed(removed, loadCatalog, NOW)).notifications).toEqual([]);
    const followed = await applyNotificationAction(removed, { action: "follow", showId: 1 }, loadCatalog, NOW);
    expect((await buildNotificationFeed(followed, loadCatalog, NOW)).notifications).toEqual([]);
    expect((await buildNotificationFeed(followed, loadCatalog, NOW + 60_000)).unreadCount).toBe(1);
  });
  it("enforces the storage limit without losing existing follows", async () => {
    const full = { follows: Array.from({ length: MAX_FOLLOWED_SHOWS }, (_, index) => ({ ...state.follows[0], showId: index + 1 })) };
    await expect(applyNotificationAction(full, { action: "follow", showId: MAX_FOLLOWED_SHOWS + 1 }, loadCatalog, NOW)).rejects.toMatchObject({ status: 409 });
    expect(full.follows).toHaveLength(MAX_FOLLOWED_SHOWS);
  });
});

describe("Vercel-compatible HTTP API", () => {
  let base: string;
  let now = START;
  const server = createServer((request, response) => {
    const parsedRequest = request as typeof request & { body?: unknown };
    if (request.url === "/parsed") parsedRequest.body = { action: "follow", showId: 1 };
    void handleNotificationsApiRequest(parsedRequest, response, { secret: request.url === "/unconfigured" ? "" : SECRET, loadCatalog, now: () => now });
  });
  beforeAll(async () => {
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Missing server address");
    base = `http://127.0.0.1:${address.port}`;
  });
  afterAll(async () => { await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve())); });

  it("persists the full follow, poll, read, refresh and unfollow lifecycle in cookies", async () => {
    now = START;
    const followed = await fetch(base, { method: "POST", headers: { "content-type": "application/json", origin: base }, body: JSON.stringify({ action: "follow", showId: 1 }) });
    expect(followed.status).toBe(200);
    let cookie = followed.headers.get("set-cookie")!.split(";")[0];
    now = NOW;
    const response = await fetch(base, { headers: { cookie } });
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(response.headers.get("vercel-cdn-cache-control")).toBe("no-store");
    expect(response.headers.get("vary")).toBe("Cookie");
    const feed = await response.json() as NotificationFeed;
    expect(feed.unreadCount).toBe(2);
    expect((await (await fetch(base)).json() as NotificationFeed).notifications).toEqual([]);
    const read = await fetch(base, { method: "PATCH", headers: { cookie, "content-type": "application/json" }, body: JSON.stringify({ action: "read", notificationId: "1:4" }) });
    expect(read.status).toBe(200);
    cookie = read.headers.get("set-cookie")!.split(";")[0];
    expect((await (await fetch(base, { headers: { cookie } })).json() as NotificationFeed).unreadCount).toBe(1);
    const removed = await fetch(base, { method: "DELETE", headers: { cookie, "content-type": "application/json" }, body: JSON.stringify({ action: "unfollow", showId: 1 }) });
    cookie = removed.headers.get("set-cookie")!.split(";")[0];
    expect((await (await fetch(base, { headers: { cookie } })).json() as NotificationFeed).followedShows).toEqual([]);
  });
  it("validates method, JSON, ID, content type and cross-site requests", async () => {
    expect((await fetch(base, { method: "PUT" })).status).toBe(405);
    expect((await fetch(base, { method: "POST", body: "{}" })).status).toBe(415);
    expect((await fetch(base, { method: "POST", headers: { "content-type": "application/json", origin: "https://other.example" }, body: "{}" })).status).toBe(403);
    expect((await fetch(base, { method: "POST", headers: { "content-type": "application/json", "sec-fetch-site": "cross-site" }, body: "{}" })).status).toBe(403);
    expect((await fetch(base, { method: "POST", headers: { "content-type": "application/json" }, body: "{" })).status).toBe(400);
    expect((await fetch(base, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "follow", showId: -1 }) })).status).toBe(400);
    expect((await fetch(base, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "readAll", through: "not-a-date" }) })).status).toBe(400);
    expect((await fetch(base, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ padding: "x".repeat(5_000) }) })).status).toBe(413);
  });
  it("recovers transparently from corrupted cookies and reports the reset", async () => {
    const response = await fetch(base, { headers: { cookie: "tv-calendar-following=corrupted" } });
    const feed = await response.json() as NotificationFeed;
    expect(response.status).toBe(200);
    expect(feed.stateReset).toBe(true);
    expect(feed.followedShows).toEqual([]);
    expect(response.headers.get("set-cookie")).toContain("Max-Age=0");
  });
  it("supports the JSON body already parsed by Vercel and sets secure HTTPS cookies", async () => {
    const response = await fetch(`${base}/parsed`, { method: "POST", headers: { "content-type": "application/json", "x-forwarded-proto": "https" } });
    expect(response.status).toBe(200);
    expect(response.headers.get("set-cookie")).toContain("; Secure");
    expect((await response.json()).subscriptions).toHaveLength(1);
  });
  it("fails clearly when the production encryption secret is missing", async () => {
    const response = await fetch(`${base}/unconfigured`);
    expect(response.status).toBe(503);
    expect((await response.json()).error).toContain("NOTIFICATIONS_SECRET");
  });
});

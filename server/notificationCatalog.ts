import { getServerShowDetail } from "./calendarApi.js";
import type { ShowCatalog } from "../src/types/notifications.js";

const CACHE_TTL = 5 * 60_000;
const MAX_CACHE_ENTRIES = 200;
const cache = new Map<number, { value: ShowCatalog; expiresAt: number }>();
const pending = new Map<number, Promise<ShowCatalog>>();
let nextLookupAt = 0;

export async function getNotificationCatalog(showId: number): Promise<ShowCatalog> {
  const entry = cache.get(showId);
  if (entry && entry.expiresAt > Date.now()) return entry.value;
  const existing = pending.get(showId);
  if (existing) return existing;
  const startAt = Math.max(Date.now(), nextLookupAt);
  nextLookupAt = startAt + 1_100;
  const task = (async () => {
    const delay = startAt - Date.now();
    if (delay > 0) await new Promise((resolve) => setTimeout(resolve, delay));
    return getServerShowDetail(showId);
  })().then((value) => {
    if (cache.size >= MAX_CACHE_ENTRIES) cache.delete(cache.keys().next().value!);
    cache.set(showId, { value, expiresAt: Date.now() + CACHE_TTL });
    return value;
  }).finally(() => pending.delete(showId));
  pending.set(showId, task);
  return task;
}

type CacheEntry<T> = {
  expiresAt: number;
  value: T;
};

import { CALENDAR_DATA_VERSION } from "../config/app";

const PREFIX = `tv-calendar:${CALENDAR_DATA_VERSION}:`;

export function readCache<T>(key: string): T | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(`${PREFIX}${key}`);
    if (!raw) return null;
    const entry = JSON.parse(raw) as CacheEntry<T>;
    if (entry.expiresAt < Date.now()) {
      window.localStorage.removeItem(`${PREFIX}${key}`);
      return null;
    }
    return entry.value;
  } catch {
    return null;
  }
}

export function writeCache<T>(key: string, value: T, ttlMs: number): void {
  if (typeof window === "undefined") return;

  try {
    const entry: CacheEntry<T> = {
      expiresAt: Date.now() + ttlMs,
      value,
    };
    window.localStorage.setItem(`${PREFIX}${key}`, JSON.stringify(entry));
  } catch {
    // Storage can be full or disabled; the network cache still works.
  }
}

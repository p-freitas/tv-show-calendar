export function releaseClock(airstamp: string | null | undefined, now = Date.now()) {
  const timestamp = airstamp ? Date.parse(airstamp) : NaN;
  if (!Number.isFinite(timestamp)) return null;
  const remaining = timestamp - now;
  const seconds = Math.floor(Math.abs(remaining) / 1_000);
  return { future: remaining > 0, days: Math.floor(seconds / 86_400), hours: Math.floor(seconds / 3_600) % 24,
    minutes: Math.floor(seconds / 60) % 60, seconds: seconds % 60 };
}

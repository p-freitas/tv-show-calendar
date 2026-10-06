import { describe, expect, it } from "vitest";
import { releaseClock } from "./releaseClock";
import { formatDateInBrazil, formatTimeInBrazil } from "./dates";

describe("release clock and Brazilian release time", () => {
  const release = "2026-10-06T01:00:00Z";
  const target = Date.parse(release);
  it("counts days, hours, minutes and seconds in both directions", () => {
    const delta = (86_400 + 2 * 3_600 + 3 * 60 + 4) * 1_000;
    expect(releaseClock(release, target - delta)).toEqual({ future: true, days: 1, hours: 2, minutes: 3, seconds: 4 });
    expect(releaseClock(release, target + delta)).toEqual({ future: false, days: 1, hours: 2, minutes: 3, seconds: 4 });
  });
  it("switches to released at zero without rounding up to an hour", () => {
    expect(releaseClock(release, target)).toEqual({ future: false, days: 0, hours: 0, minutes: 0, seconds: 0 });
    expect(releaseClock(release, target - 1_000)?.seconds).toBe(1);
  });
  it("handles unknown or invalid times honestly", () => {
    expect(releaseClock(null)).toBeNull();
    expect(releaseClock("invalid")).toBeNull();
  });
  it("converts UTC across midnight to the previous Brazilian date", () => {
    expect(formatDateInBrazil(null, release)).toContain("05/10/2026");
    expect(formatTimeInBrazil(release)).toBe("22:00");
  });
});

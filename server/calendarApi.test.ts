import { describe, expect, it } from "vitest";
import { parsePogDesignCalendarMonth } from "./calendarApi";

function episode(id: number, name: string) {
  return `<div class="ep info"><span>
    <input id="${id}" value="${id}-1-2/10-2026" />
    <p><a href="${name}-summary">${name}</a><a href="${name}/Season-1/Episode-2">s01e02</a></p>
  </span></div>`;
}

describe("parsePogDesignCalendarMonth", () => {
  it("keeps today's episodes separate from yesterday and tomorrow", () => {
    const html = `
      <div id="d_4_10_2026" class="day">${episode(1, "Yesterday")}</div>
      <div id="d_5_10_2026" class="today">${episode(2, "Today")}</div>
      <div id="d_6_10_2026" class="day">${episode(3, "Tomorrow")}</div>
      <div class="month_name">October</div>`;

    expect(parsePogDesignCalendarMonth(html, 2026, 10).map((item) => [item.showName, item.airdate, item.brazilianDateKey]))
      .toEqual([
        ["Yesterday", "2026-10-04", "2026-10-04"],
        ["Today", "2026-10-05", "2026-10-05"],
        ["Tomorrow", "2026-10-06", "2026-10-06"],
      ]);
  });

  it.each([1, 31])("recognizes today at the month boundary on day %i", (day) => {
    const html = `<div class='today highlighted' id='d_${day}_10_2026'>${episode(4, "Boundary")}</div>`;
    expect(parsePogDesignCalendarMonth(html, 2026, 10)).toMatchObject([
      { showName: "Boundary", brazilianDateKey: `2026-10-${String(day).padStart(2, "0")}` },
    ]);
  });

  it("uses neighboring months as boundaries without including their episodes", () => {
    const html = `
      <div id="d_30_9_2026" class="day">${episode(5, "September")}</div>
      <div id="d_31_10_2026" class="day">${episode(6, "October")}</div>
      <div id="d_1_11_2026" class="today">${episode(7, "November")}</div>`;
    expect(parsePogDesignCalendarMonth(html, 2026, 10)).toMatchObject([
      { showName: "October", brazilianDateKey: "2026-10-31" },
    ]);
    expect(parsePogDesignCalendarMonth(html, 2026, 10)).toHaveLength(1);
  });
});

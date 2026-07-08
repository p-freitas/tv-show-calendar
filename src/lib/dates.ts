import { APP_TIMEZONE } from "../config/app";

export function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

export function toMonthPath(year: number, month: number): string {
  return `/calendar/${year}/${pad2(month)}`;
}

export function getCurrentBrazilMonth(): { year: number; month: number } {
  const parts = datePartsInTimeZone(new Date());
  return { year: Number(parts.year), month: Number(parts.month) };
}

export function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

export function addMonths(year: number, month: number, amount: number): { year: number; month: number } {
  const date = new Date(Date.UTC(year, month - 1 + amount, 1));
  return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1 };
}

export function isoDate(year: number, month: number, day: number): string {
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

export function monthTitle(year: number, month: number): string {
  const date = new Date(Date.UTC(year, month - 1, 1, 12));
  return new Intl.DateTimeFormat("pt-BR", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

export function datePartsInTimeZone(date: Date, timeZone = APP_TIMEZONE): Record<string, string> {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  return Object.fromEntries(formatter.formatToParts(date).map((part) => [part.type, part.value]));
}

export function dateKeyInTimeZone(date: Date, timeZone = APP_TIMEZONE): string {
  const parts = datePartsInTimeZone(date, timeZone);
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function formatDateInBrazil(airdate?: string | null, airstamp?: string | null): string {
  if (airstamp) {
    return new Intl.DateTimeFormat("pt-BR", {
      weekday: "short",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      timeZone: APP_TIMEZONE,
    }).format(new Date(airstamp));
  }

  if (!airdate) return "data não informada";
  const [year, month, day] = airdate.split("-").map(Number);
  return new Intl.DateTimeFormat("pt-BR", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, day, 12)));
}

export function formatTimeInBrazil(airstamp?: string | null): string {
  if (!airstamp) return "horário não informado";
  return new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: APP_TIMEZONE,
  }).format(new Date(airstamp));
}

export function episodeDateKey(airdate?: string | null, airstamp?: string | null): string {
  if (airstamp) return dateKeyInTimeZone(new Date(airstamp));
  return airdate || "sem-data";
}

export function relativeReleaseLabel(airstamp?: string | null): string {
  if (!airstamp) return "horário não informado";

  const target = new Date(airstamp).getTime();
  const diffMs = target - Date.now();
  const future = diffMs > 0;
  const absMs = Math.abs(diffMs);
  const totalHours = Math.max(1, Math.floor(absMs / (1000 * 60 * 60)));
  const years = Math.floor(totalHours / (24 * 365));
  let remainingHours = totalHours - years * 24 * 365;
  const months = Math.floor(remainingHours / (24 * 30));
  remainingHours -= months * 24 * 30;
  const days = Math.floor(remainingHours / 24);
  const hours = remainingHours % 24;

  const parts: string[] = [];
  if (years > 0) parts.push(years === 1 ? "1 ano" : `${years} anos`);
  if (years > 0 || months > 0) parts.push(months === 1 ? "1 mês" : `${months} meses`);
  if (years > 0 || months > 0 || days > 0) parts.push(days === 1 ? "1 dia" : `${days} dias`);
  parts.push(hours === 1 ? "1 hora" : `${hours} horas`);

  return future ? `lança em ${parts.join(", ")}` : `lançou há ${parts.join(", ")}`;
}

export function hasReleased(airdate?: string | null, airstamp?: string | null): boolean {
  if (airstamp) return new Date(airstamp).getTime() <= Date.now();
  if (!airdate) return false;

  const [year, month, day] = airdate.split("-").map(Number);
  if (!year || !month || !day) return false;
  return new Date(Date.UTC(year, month - 1, day, 12)).getTime() <= Date.now();
}

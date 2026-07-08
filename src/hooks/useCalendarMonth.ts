import { useQuery } from "@tanstack/react-query";
import { DEFAULT_COUNTRY, QUERY_STALE_TIME_MS } from "../config/app";
import { tvmaze } from "../services/tvmaze";

export function calendarMonthQueryKey(year: number, month: number, country = DEFAULT_COUNTRY) {
  return ["calendar-month", country, year, month] as const;
}

export function useCalendarMonth(year: number, month: number, country = DEFAULT_COUNTRY) {
  return useQuery({
    queryKey: calendarMonthQueryKey(year, month, country),
    queryFn: () => tvmaze.getCalendarMonth(year, month, country),
    staleTime: QUERY_STALE_TIME_MS,
    gcTime: QUERY_STALE_TIME_MS * 4,
  });
}

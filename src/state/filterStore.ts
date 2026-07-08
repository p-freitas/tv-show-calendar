import { create } from "zustand";
import { persist } from "zustand/middleware";
import { DEFAULT_FILTERS } from "../config/filters";
import type { Filters } from "../types/domain";

type FilterStore = {
  filters: Filters;
  setFilter: <K extends keyof Filters>(key: K, value: Filters[K]) => void;
  toggleArrayFilter: (key: "genres" | "platforms" | "countries" | "languages", value: string) => void;
  resetFilters: () => void;
};

export const useFilterStore = create<FilterStore>()(
  persist(
    (set) => ({
      filters: DEFAULT_FILTERS,
      setFilter: (key, value) =>
        set((state) => ({
          filters: { ...state.filters, [key]: value },
        })),
      toggleArrayFilter: (key, value) =>
        set((state) => {
          const current = state.filters[key];
          const next = current.includes(value) ? current.filter((item) => item !== value) : [...current, value];
          return { filters: { ...state.filters, [key]: next } };
        }),
      resetFilters: () => set({ filters: DEFAULT_FILTERS }),
    }),
    {
      name: "tv-calendar-filters",
    },
  ),
);

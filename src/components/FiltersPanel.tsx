import { DEFAULT_FILTERS, episodeTypeLabels, runtimeBucketLabels } from "../config/filters";
import { useFilterStore } from "../state/filterStore";
import type { EpisodeType, RuntimeBucket } from "../types/domain";

type FilterOptions = {
  genres: string[];
  platforms: string[];
  countries: string[];
  languages: string[];
};

function CheckboxGroup({
  title,
  values,
  selected,
  onToggle,
}: {
  title: string;
  values: string[];
  selected: string[];
  onToggle: (value: string) => void;
}) {
  if (values.length === 0) return null;

  return (
    <fieldset className="filter-group">
      <legend>{title}</legend>
      <div className="check-list">
        {values.slice(0, 80).map((value) => (
          <label key={value} className="check-pill">
            <input type="checkbox" checked={selected.includes(value)} onChange={() => onToggle(value)} />
            {value}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function hasActiveFilters(filters: ReturnType<typeof useFilterStore.getState>["filters"]) {
  return (
    filters.query.trim() !== DEFAULT_FILTERS.query ||
    filters.episodeType !== DEFAULT_FILTERS.episodeType ||
    filters.runtimeBucket !== DEFAULT_FILTERS.runtimeBucket ||
    filters.sourceType !== DEFAULT_FILTERS.sourceType ||
    filters.genres.length > 0 ||
    filters.platforms.length > 0 ||
    filters.countries.length > 0 ||
    filters.languages.length > 0
  );
}

export function FiltersPanel({
  options,
  visibleCount,
  totalCount,
}: {
  options: FilterOptions;
  visibleCount: number;
  totalCount: number;
}) {
  const { filters, setFilter, toggleArrayFilter, resetFilters } = useFilterStore();
  const activeFilters = hasActiveFilters(filters);

  return (
    <section className="filters-panel" aria-labelledby="filters-title">
      <header className="filters-header">
        <h2 id="filters-title">Filtros</h2>
        <span>
          {visibleCount} de {totalCount} episódios
        </span>
      </header>

      <div className="filters-grid">
        <label className="filter-group">
          <span>Nome da série</span>
          <input
            type="search"
            value={filters.query}
            placeholder="Buscar série..."
            onChange={(event) => setFilter("query", event.target.value)}
          />
        </label>

        <label className="filter-group">
          <span>Tipo de episódio</span>
          <select
            value={filters.episodeType}
            onChange={(event) => setFilter("episodeType", event.target.value as EpisodeType | "all")}
          >
            {Object.entries(episodeTypeLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>

        <label className="filter-group">
          <span>Duração</span>
          <select
            value={filters.runtimeBucket}
            onChange={(event) => setFilter("runtimeBucket", event.target.value as RuntimeBucket)}
          >
            {Object.entries(runtimeBucketLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>

        <CheckboxGroup
          title="Categoria/gênero"
          values={options.genres}
          selected={filters.genres}
          onToggle={(value) => toggleArrayFilter("genres", value)}
        />
        <CheckboxGroup
          title="Network/plataforma"
          values={options.platforms}
          selected={filters.platforms}
          onToggle={(value) => toggleArrayFilter("platforms", value)}
        />
        <CheckboxGroup
          title="País"
          values={options.countries}
          selected={filters.countries}
          onToggle={(value) => toggleArrayFilter("countries", value)}
        />
        <CheckboxGroup
          title="Língua original"
          values={options.languages}
          selected={filters.languages}
          onToggle={(value) => toggleArrayFilter("languages", value)}
        />
      </div>

      <button className="secondary-button" type="button" onClick={resetFilters} disabled={!activeFilters}>
        Limpar filtros
      </button>
    </section>
  );
}

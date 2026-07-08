export function Legend() {
  return (
    <div className="legend" aria-label="Legenda de cores">
      <span>
        <i className="legend-dot episode-series_premiere" /> estreia da série
      </span>
      <span>
        <i className="legend-dot episode-season_premiere" /> estreia de temporada
      </span>
      <span>
        <i className="legend-dot episode-season_finale" /> final de temporada
      </span>
      <span>
        <i className="legend-dot episode-regular" /> episódio comum
      </span>
    </div>
  );
}

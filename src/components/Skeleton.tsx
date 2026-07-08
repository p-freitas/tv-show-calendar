export function CalendarSkeleton() {
  return (
    <div className="calendar-grid" aria-label="Carregando calendário">
      {Array.from({ length: 12 }, (_, index) => (
        <div className="day-block skeleton-block" key={index}>
          <span />
          <p />
          <p />
        </div>
      ))}
    </div>
  );
}

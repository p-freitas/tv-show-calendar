import { useEffect, useState } from "react";
import { formatDateInBrazil, formatTimeInBrazil } from "../lib/dates";
import { releaseClock } from "../lib/releaseClock";

export function ReleaseCountdown({ airstamp, airdate }: { airstamp?: string | null; airdate?: string | null }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1_000);
    const onVisible = () => setNow(Date.now());
    document.addEventListener("visibilitychange", onVisible);
    return () => { window.clearInterval(timer); document.removeEventListener("visibilitychange", onVisible); };
  }, []);
  const clock = releaseClock(airstamp, now);
  return <section className={`release-countdown${clock && !clock.future ? " is-released" : ""}`} aria-label="Tempo desde o lançamento ou até o lançamento">
    <div className="release-countdown-heading"><span className="release-indicator" aria-hidden="true" /><span>{clock ? clock.future ? "Falta para o lançamento" : "Lançado há" : "Horário de lançamento a confirmar"}</span></div>
    {clock ? <div className="release-clock" role="timer" aria-live="off">
      {([[clock.days, "dias"], [clock.hours, "horas"], [clock.minutes, "minutos"], [clock.seconds, "segundos"]] as const).map(([value, label]) =>
        <div key={label}><strong>{String(value).padStart(2, "0")}</strong><span>{label}</span></div>)}
    </div> : <p className="release-unknown">O contador estará disponível quando a fonte informar o horário exato.</p>}
    <p className="release-date">{formatDateInBrazil(airdate, airstamp)}{airstamp ? ` às ${formatTimeInBrazil(airstamp)} · Horário de Brasília` : " · Horário não informado"}</p>
  </section>;
}

import { Link } from "../App";
import { NotificationBell } from "./NotificationBell";

export function SiteHeader() {
  return <header className="site-header"><div className="site-header-inner">
    <Link href="/" className="site-brand"><img src="/calendar-icon.svg" width="25" height="25" alt="" /><span>Calendário de séries</span></Link>
    <div className="site-header-actions"><Link href="/notifications?tab=following" className="header-following-link">Minhas séries</Link><NotificationBell /></div>
  </div></header>;
}

import { useNotifications } from "../state/NotificationsProvider";

export function NotificationStatus() {
  const { feed, error, actionError, refresh, dismissActionError, refreshing } = useNotifications();
  return <>
    {actionError ? <div className="notification-status is-error" role="alert"><span>{actionError.message}</span>
      <button type="button" className="text-button" onClick={dismissActionError}>Fechar</button></div> : null}
    {error ? <div className="notification-status is-error" role="status"><span>{feed ? "Não foi possível atualizar suas notificações. Seus dados salvos continuam disponíveis." : error.message}</span>
      <button type="button" className="text-button" disabled={refreshing} onClick={refresh}>Tentar novamente</button></div> : null}
    {feed?.failedShowIds.length ? <div className="notification-status" role="status"><span>Algumas séries não puderam ser atualizadas. Vamos tentar novamente automaticamente.</span>
      <button type="button" className="text-button" disabled={refreshing} onClick={refresh}>Atualizar</button></div> : null}
    {feed?.stateReset ? <p className="notification-status" role="status">O acompanhamento salvo não pôde ser recuperado. Acompanhe suas séries novamente neste navegador.</p> : null}
  </>;
}

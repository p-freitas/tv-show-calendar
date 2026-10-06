import type { NotificationAction, NotificationFeed, NotificationMutationResult } from "../types/notifications";

async function request<T>(init: RequestInit = {}): Promise<T> {
  const response = await fetch("/api/notifications", { ...init, credentials: "same-origin", cache: "no-store" });
  if (!response.headers.get("content-type")?.includes("application/json")) {
    throw new Error("O serviço de notificações está indisponível. Tente novamente.");
  }
  const data = await response.json();
  if (!response.ok) throw new Error(data.error ?? "Não foi possível atualizar suas notificações.");
  return data as T;
}

// Serialize cookie requests across tabs to prevent one action overwriting another.
async function withCookieLock<T>(action: () => Promise<T>): Promise<T> {
  if (navigator.locks) return await navigator.locks.request("tv-calendar-notifications", action);
  return action();
}

export function getNotificationFeed(signal?: AbortSignal): Promise<NotificationFeed> {
  return withCookieLock(() => request<NotificationFeed>({ signal }));
}

export function updateNotifications(action: NotificationAction): Promise<NotificationMutationResult> {
  const method = action.action === "follow" ? "POST" : action.action === "unfollow" ? "DELETE" : "PATCH";
  return withCookieLock(() => request<NotificationMutationResult>({ method, headers: { "content-type": "application/json" }, body: JSON.stringify(action) }));
}

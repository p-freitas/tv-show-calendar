import type { IncomingMessage, ServerResponse } from "node:http";
import { handleNotificationsApiRequest } from "../server/notificationsApi.js";

export default async function handler(request: IncomingMessage & { body?: unknown }, response: ServerResponse) {
  await handleNotificationsApiRequest(request, response);
}

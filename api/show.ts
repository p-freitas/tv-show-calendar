import { handleShowApiRequest } from "../server/calendarApi.js";

type VercelRequest = {
  method?: string;
  url?: string;
};

type VercelResponse = {
  statusCode: number;
  setHeader: (name: string, value: string) => void;
  end: (body?: string) => void;
};

export default function handler(request: VercelRequest, response: VercelResponse) {
  if (request.method !== "GET") {
    response.statusCode = 405;
    response.setHeader("content-type", "application/json; charset=utf-8");
    response.end(JSON.stringify({ error: "Método não permitido." }));
    return;
  }

  void handleShowApiRequest(request, response);
}

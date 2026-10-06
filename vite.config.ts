import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { createCalendarApiMiddleware } from "./server/calendarApi";
import { createNotificationsApiMiddleware } from "./server/notificationsApi";

export default defineConfig(({ mode }) => ({
  plugins: [
    react(),
    {
      name: "tv-calendar-api",
      configureServer(server) {
        const env = loadEnv(mode, process.cwd(), "NOTIFICATIONS_");
        server.middlewares.use(createNotificationsApiMiddleware({
          secret: process.env.NOTIFICATIONS_SECRET ?? env.NOTIFICATIONS_SECRET ?? "local-development-notifications-key-only",
        }));
        server.middlewares.use(createCalendarApiMiddleware() as unknown as Parameters<typeof server.middlewares.use>[1]);
      },
    },
  ],
}));

import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { createCalendarApiMiddleware } from "./server/calendarApi";

export default defineConfig({
  plugins: [
    react(),
    {
      name: "tv-calendar-api",
      configureServer(server) {
        server.middlewares.use(createCalendarApiMiddleware() as unknown as Parameters<typeof server.middlewares.use>[1]);
      },
    },
  ],
});

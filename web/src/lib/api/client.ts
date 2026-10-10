import createClient from "openapi-fetch";
import type { paths } from "./schema.d.ts";

export const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

export const apiClient = createClient<paths>({
  baseUrl: API_URL,
  fetch: (input: RequestInfo | URL, init?: RequestInit) => 
    fetch(input, { ...init, credentials: "include" }),
});

apiClient.use({
  onRequest({ request }) {
    request.headers.set("X-Requested-With", "XMLHttpRequest");
    return request;
  },
  onResponse({ response }) {
    if (response.status === 401) {
      // You can add global 401 handling here if needed,
      // e.g. dispatching an event to force logout on the UI
      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event("auth:unauthorized"));
      }
    }
    return response;
  },
});

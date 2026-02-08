import { httpLink } from "@trpc/client";
import { createTRPCReact } from "@trpc/react-query";
import superjson from "superjson";

import type { AppRouter } from "@/backend/trpc/app-router";

export const trpc = createTRPCReact<AppRouter>();

const getBaseUrl = () => {
  const url = process.env.EXPO_PUBLIC_RORK_API_BASE_URL;

  if (!url) {
    console.warn("EXPO_PUBLIC_RORK_API_BASE_URL not set, backend features disabled");
    return null;
  }

  return url;
};

const baseUrl = getBaseUrl();

export const trpcClient = baseUrl 
  ? trpc.createClient({
      links: [
        httpLink({
          url: `${baseUrl}/api/trpc`,
          transformer: superjson,
        }),
      ],
    })
  : null;

export const isBackendEnabled = (): boolean => {
  return !!baseUrl && !!trpcClient;
};

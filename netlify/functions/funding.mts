import { getStore } from "@netlify/blobs";
import type { Config } from "@netlify/functions";

/**
 * Serves the total cached by sync-funding. Never calls Stripe directly, so
 * page-load cost is constant and the secret key stays server-side.
 */
export default async () => {
  const totals = await getStore("funding").get("totals", { type: "json" });

  if (!totals) {
    return Response.json({ error: "not_ready" }, { status: 503 });
  }

  return Response.json(totals, {
    headers: { "cache-control": "public, max-age=60, s-maxage=300" },
  });
};

export const config: Config = {
  path: "/api/funding",
};

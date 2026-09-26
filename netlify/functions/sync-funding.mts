import Stripe from "stripe";
import { getStore } from "@netlify/blobs";
import type { Config } from "@netlify/functions";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

/** Unix seconds — ignore Stripe activity before the campaign opened. */
const CAMPAIGN_START = Math.floor(Date.parse("2026-09-01T00:00:00Z") / 1000);

/**
 * Payment Link IDs for the capped tiers. After creating the Payment Links in
 * the Stripe Dashboard, paste the IDs here (Dashboard → Payment Links → the
 * link's detail page — the ID starts with "plink_").
 *
 * Stripe deactivates the link itself when the purchase limit is reached;
 * these IDs let the site reflect the sold-out state without a round-trip.
 */
const CAPPED_TIERS: Record<string, { label: string; total: number }> = {
  plink_1UJxDLPehNhmKEQDe3KBrXb6: { label: "collector", total: 12 },
  plink_1UJxDqPehNhmKEQDJTKIcUsy: { label: "private-performance", total: 3 },
};

const linkId = (link: Stripe.Checkout.Session["payment_link"]) =>
  typeof link === "string" ? link : (link?.id ?? null);

/**
 * Sums every paid Checkout Session since campaign open, then subtracts
 * refunds. Recomputing from scratch each run means a missed run, duplicate
 * webhook, or refund all self-correct on the next pass.
 */
async function computeTotals() {
  let grossCents = 0;
  let supporters = 0;
  const soldByLink: Record<string, number> = {};

  for await (const session of stripe.checkout.sessions.list({
    created: { gte: CAMPAIGN_START },
    limit: 100,
  })) {
    if (session.payment_status !== "paid") continue;

    grossCents += session.amount_total ?? 0;
    supporters += 1;

    const id = linkId(session.payment_link);
    if (id) soldByLink[id] = (soldByLink[id] ?? 0) + 1;
  }

  for await (const refund of stripe.refunds.list({
    created: { gte: CAMPAIGN_START },
    limit: 100,
  })) {
    if (refund.status === "succeeded") grossCents -= refund.amount;
  }

  const remaining = Object.fromEntries(
    Object.entries(CAPPED_TIERS).map(([id, tier]) => [
      tier.label,
      Math.max(tier.total - (soldByLink[id] ?? 0), 0),
    ]),
  );

  return {
    raised: Math.max(grossCents, 0) / 100,
    supporters,
    remaining,
    updatedAt: new Date().toISOString(),
  };
}

export default async () => {
  const totals = await computeTotals();
  await getStore("funding").setJSON("totals", totals);
  return new Response(JSON.stringify(totals), {
    headers: { "content-type": "application/json" },
  });
};

export const config: Config = {
  schedule: "*/15 * * * *",
};

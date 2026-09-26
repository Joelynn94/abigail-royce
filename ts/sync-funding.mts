import Stripe from "stripe";
import { getStore } from "@netlify/blobs";
import type { Config } from "@netlify/functions";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

/** Unix seconds. Anything before this is unrelated Stripe activity. */
const CAMPAIGN_START = Math.floor(Date.parse("2026-09-01T00:00:00Z") / 1000);

/**
 * Payment Link IDs for the two capped tiers, so the site can show remaining
 * counts and flip a row to sold out. Stripe deactivates the link itself; this
 * is only so the page reflects it.
 */
const CAPPED_TIERS: Record<string, { label: string; total: number }> = {
  "plink_REPLACE_ME_500": { label: "collector", total: 12 },
  "plink_REPLACE_ME_1000": { label: "private-performance", total: 3 },
};

const linkId = (link: Stripe.Checkout.Session["payment_link"]) =>
  typeof link === "string" ? link : (link?.id ?? null);

/**
 * Sums every paid Checkout Session since the campaign opened, then subtracts
 * refunds. Recomputing from scratch each run means a missed run, a duplicate
 * webhook, or a refund all self-correct on the next pass.
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

  // TODO: a refunded capped tier still counts against soldByLink, so a refund
  // on the $500 tier will under-report remaining stock until the link is
  // manually re-opened in Stripe. Rare enough to handle by hand for now.
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

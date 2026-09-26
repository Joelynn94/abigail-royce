# Setup runbook

Three moving parts, each with a different owner:

| Concern                           | Where it lives | Who writes it          |
| --------------------------------- | -------------- | ---------------------- |
| Shows, bio, featured release      | Sanity         | Abigail, in the Studio |
| Payments and supporter tiers      | Stripe         | You, once, at setup    |
| Funding total and remaining stock | Netlify Blobs  | The scheduled job      |

The site reads all three at runtime. **No content change ever triggers a
deploy**, which is the whole point of this shape.

---

## 0. Start Stripe activation first

It is the only step with an external dependency and it gates launch. Abigail
needs to complete account activation in Stripe: business details, tax info,
and a bank account. Nothing goes live until this clears, so begin it now and
build everything else in the meantime using test mode.

---

## 1. Sanity

### Create the project

    npm create sanity@latest -- --dataset production --output-path studio

Choose "Clean project with no predefined schemas" — the schema files in
`studio/schemaTypes/` are already written.

Then replace `REPLACE_WITH_PROJECT_ID` in three places:

- `studio/sanity.config.ts`
- `studio/sanity.cli.ts`
- `js/content.js`

These are public identifiers, not secrets. Safe to commit.

### Deploy the Studio

    cd studio && npx sanity deploy

Gives you `abigail-royce.sanity.studio`. Free, hosted by Sanity, and it
consumes zero Netlify credits. Redeploy only when the schema changes.

### Invite Abigail

Project settings -> Members -> Invite. The free plan allows 2 non-admin users
with Admin and Editor roles only, which is exactly what you need.

### Seed the content

Create the **Site content** document and add the current shows. Until you do,
the site keeps showing the hardcoded fallback in `index.html`.

---

## 2. Stripe

Build every link in **test mode** first. Test card: `4242 4242 4242 4242`,
any future expiry, any CVC.

Create one Payment Link per tier:

| Tier              | Pricing                | Also configure                                              |
| ----------------- | ---------------------- | ----------------------------------------------------------- |
| Any amount        | Customer chooses price | $10k ceiling, single line item                              |
| $25               | Fixed                  | Email only                                                  |
| $50 / $100 / $250 | Fixed                  | Collect billing + shipping                                  |
| $500              | Fixed                  | Shipping, limit **12**, custom fields, deactivation message |
| $1,000            | Fixed                  | Shipping, limit **3**, deactivation message                 |

For the $500 acknowledgment credit, add two custom fields: a yes/no dropdown
and a text field for the name to print. Both appear in the Dashboard and in
the `checkout.session.completed` payload.

Set every link's confirmation redirect to:

    https://abigailroyce.com/thank-you.html

Then paste the live URLs into `support.html`, replacing each `href="#"`, and
put the two capped links' IDs into `CAPPED_TIERS` in `sync-funding.mts`.

> Fulfillment must not depend on the thank-you page. Customers close tabs
> before redirecting. The Dashboard is the record of who bought what.

---

## 3. Netlify functions

    npm init -y
    npm install stripe @netlify/blobs
    npm install -D @netlify/functions

Set the environment variable under Project configuration -> Environment
variables:

    STRIPE_SECRET_KEY = sk_test_...   (swap to sk_live_... at launch)

Never commit it. Never expose it to the browser.

Set `CAMPAIGN_START` in `sync-funding.mts` to the real open date so unrelated
Stripe activity is excluded from the total.

Test locally:

    npx netlify dev
    curl localhost:8888/.netlify/functions/sync-funding
    curl localhost:8888/api/funding

---

## 4. Before launch

- [ ] Stripe account fully activated
- [ ] Live keys swapped in, test links replaced with live links
- [ ] One real end-to-end purchase, refunded afterward
- [ ] `data-meter` on `support.html` set to the last known total, so a failed
      endpoint shows a stale number rather than `$0`
- [ ] Move to the **Personal plan ($9)**. The free plan pauses the project
      when credits run out, with no auto-recharge. Nine dollars buys 4x the
      headroom and removes the chance of the donation page going dark
      mid-campaign.
- [ ] Compress `hero.jpg`, `bio2.jpg`, `bio3.jpg` - they are the largest
      credit line on the account by a wide margin
- [ ] Seed a few contributions before publicising, so the bar is not at $0

---

## What is deliberately not editable

Layout, navigation, section headings, and the supporter tiers stay in code.

The tiers matter most: each maps one-to-one onto a Stripe Payment Link, and
the sold-out states are driven by counts from `sync-funding`. Making tier copy
editable would let the page promise something checkout does not deliver.

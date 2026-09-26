const NAV_SCROLL_THRESHOLD = 60;
const FUNDING_GOAL = 7500;

/**
 * Sets the current year in any element marked with [data-current-year].
 */
function renderCurrentYear() {
  const targets = document.querySelectorAll("[data-current-year]");
  targets.forEach((el) => {
    el.textContent = new Date().getFullYear();
  });
}

/**
 * Adds a solid background to the nav once the page is scrolled.
 * No-ops on pages where the nav is always solid.
 */
function watchNavScroll() {
  const nav = document.querySelector(".main-nav");
  if (!nav || nav.classList.contains("main-nav--solid")) return;

  const handleScroll = () => {
    nav.classList.toggle("is-scrolled", window.scrollY > NAV_SCROLL_THRESHOLD);
  };

  handleScroll();
  window.addEventListener("scroll", handleScroll, { passive: true });
}

/**
 * @param {number} amount
 * @returns {string} Whole-dollar currency string, e.g. "$1,240".
 */
function formatDollars(amount) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Paints the funding meter from a raised total.
 * @param {number} raised
 */
function renderFundingMeter(raised) {
  const meter = document.querySelector("[data-meter]");
  if (!meter) return;

  const percent = Math.min(Math.round((raised / FUNDING_GOAL) * 100), 100);

  meter.querySelector("[data-meter-amount]").textContent = formatDollars(raised);
  meter.querySelector("[data-meter-fill]").style.width = `${percent}%`;

  const track = meter.querySelector("[data-meter-track]");
  track.setAttribute("aria-valuenow", String(raised));
  track.setAttribute(
    "aria-valuetext",
    `${formatDollars(raised)} of ${formatDollars(FUNDING_GOAL)} raised`,
  );
}

/**
 * Marks capped tiers as sold out or updates their remaining count.
 * Expects remaining keys "collector" and "private-performance" from
 * the /api/funding response.
 * @param {Record<string, number>} remaining
 */
function renderSoldOutStates(remaining) {
  document.querySelectorAll("[data-tier-id]").forEach((row) => {
    const id = row.dataset.tierId;
    const count = remaining[id];
    if (count === undefined) return;

    const limitEl = row.querySelector(".tier-limit");
    if (count === 0) {
      row.classList.add("row--sold-out");
      const btn = row.querySelector(".btn");
      if (btn) {
        btn.textContent = "Sold Out";
        btn.setAttribute("aria-disabled", "true");
        btn.removeAttribute("href");
      }
      if (limitEl) limitEl.textContent = "Sold out";
    } else {
      if (limitEl) limitEl.textContent = `${count} remaining`;
    }
  });
}

/**
 * Fetches the cached funding total from /api/funding (written every 15 min
 * by the sync-funding Netlify function) and paints the meter. Falls back
 * silently to the data-meter placeholder if the endpoint is unavailable.
 */
async function loadFundingTotal() {
  const meter = document.querySelector("[data-meter]");
  if (!meter) return;

  const placeholder = Number(meter.dataset.meter);
  renderFundingMeter(placeholder);

  try {
    const res = await fetch("/api/funding");
    if (!res.ok) return;
    const data = await res.json();
    if (typeof data.raised === "number") {
      renderFundingMeter(data.raised);
    }
    if (data.remaining) {
      renderSoldOutStates(data.remaining);
    }
  } catch {
    // Keep placeholder on network error
  }
}

renderCurrentYear();
watchNavScroll();
loadFundingTotal();

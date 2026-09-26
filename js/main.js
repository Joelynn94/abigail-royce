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
 * TODO: Replace with a real fetch once the Stripe totals endpoint exists.
 * Planned shape: GET /api/funding -> { raised: number }. The endpoint should
 * read a cached total rather than querying Stripe on every page load, and the
 * Stripe secret key must never reach the client.
 */
async function loadFundingTotal() {
  const meter = document.querySelector("[data-meter]");
  if (!meter) return;

  const placeholder = Number(meter.dataset.meter);
  renderFundingMeter(placeholder);
}

renderCurrentYear();
watchNavScroll();
loadFundingTotal();

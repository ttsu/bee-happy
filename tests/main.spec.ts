import { test, expect } from "@playwright/test";
import { CURRENT_RELEASE_ID } from "../src/changelog/player-changelog";

const LAST_SEEN_RELEASE_KEY = "bee-happy-last-seen-release";
const TUTORIAL_STORAGE_KEY = "bee-happy-tutorial-v1";

test("HUD loads with Bee Happy title", async ({ page }) => {
  await page.addInitScript(
    (opts: { lastKey: string; tutKey: string; lastVal: string }) => {
      localStorage.setItem(opts.lastKey, opts.lastVal);
      localStorage.setItem(opts.tutKey, "done");
      localStorage.setItem("bee-happy-hud-minimized", "0");
    },
    {
      lastKey: LAST_SEEN_RELEASE_KEY,
      tutKey: TUTORIAL_STORAGE_KEY,
      lastVal: CURRENT_RELEASE_ID,
    },
  );
  await page.goto("http://localhost:4173/");
  await expect(page.getByRole("heading", { name: "Bee Happy" })).toBeVisible();
  await page.getByRole("button", { name: /Casual Mode/i }).click();
  await expect(
    page.getByRole("button", { name: "Collapse colony stats" }),
  ).toBeVisible();
  await expect(
    page.locator(".hud-stats .hud-stat-label", { hasText: "Workers" }),
  ).toBeVisible();
  const hud = page.locator(".hud");
  await expect(hud.getByRole("meter", { name: "Pollen", exact: true })).toBeVisible();
  await expect(hud.getByRole("meter", { name: "Honey", exact: true })).toBeVisible();
  await expect(hud.getByRole("meter", { name: "Nectar", exact: true })).toBeVisible();
  await expect(hud.getByRole("meter", { name: /Brood:/ })).toBeVisible();
  await expect(hud.getByRole("meter", { name: "Beeswax", exact: true })).toBeVisible();
  await expect(
    hud.getByRole("meter", { name: "Happiness", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".season-day-banner .season-day-season-full")).toHaveText(
    "🌸 Spring",
  );
  await expect(page.locator(".season-day-banner .season-day-year")).toBeVisible();
  const speedToggle = page.getByRole("button", {
    name: /Normal speed, switch to fast forward/i,
  });
  await expect(speedToggle).toBeVisible();
  await speedToggle.click();
  await expect(
    page.getByRole("button", {
      name: /Fast forward on, switch to normal speed/i,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("radiogroup", { name: "Cell type to place" }),
  ).toBeVisible();
  await expect(page.getByRole("radio", { name: "Brood" })).toBeVisible();
  await page.getByRole("button", { name: "Collapse colony stats" }).click();
  await expect(page.getByRole("button", { name: "Expand colony stats" })).toBeVisible();
  await expect(page.locator(".hud-strip")).toBeVisible();
  await expect(
    hud.getByRole("meter", { name: "Beeswax", exact: true }),
  ).not.toBeVisible();

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator(".season-day-season-full")).toBeHidden();
  await expect(page.locator(".season-day-year")).toBeHidden();
  await expect(page.locator(".season-day-season-compact")).toBeVisible();
  await expect(page.locator(".season-day-banner")).toContainText("Day");
  const bannerBox = await page.locator(".season-day-banner").boundingBox();
  const hudBox = await page.locator(".hud").boundingBox();
  expect(bannerBox).toBeTruthy();
  expect(hudBox).toBeTruthy();
  expect(hudBox!.y).toBeGreaterThan(bannerBox!.y + bannerBox!.height - 1);
});

test("What's new appears when last seen release is older than current", async ({
  page,
}) => {
  await page.addInitScript(
    (opts: { lastKey: string; tutKey: string; lastVal: string }) => {
      localStorage.setItem(opts.lastKey, opts.lastVal);
      localStorage.setItem(opts.tutKey, "done");
    },
    {
      lastKey: LAST_SEEN_RELEASE_KEY,
      tutKey: TUTORIAL_STORAGE_KEY,
      lastVal: "0.0.9",
    },
  );
  await page.goto("http://localhost:4173/");
  await expect(page.getByRole("heading", { name: "What's new" })).toBeVisible();
  await page.getByRole("button", { name: "Got it" }).click();
  await expect(page.getByRole("heading", { name: "What's new" })).not.toBeVisible();
  await expect(page.getByRole("heading", { name: "Bee Happy" })).toBeVisible();
});

test("Tutorial appears on first new game", async ({ page }) => {
  await page.addInitScript(
    (opts: { lastKey: string; tutKey: string; lastVal: string }) => {
      localStorage.setItem(opts.lastKey, opts.lastVal);
      localStorage.removeItem(opts.tutKey);
    },
    {
      lastKey: LAST_SEEN_RELEASE_KEY,
      tutKey: TUTORIAL_STORAGE_KEY,
      lastVal: CURRENT_RELEASE_ID,
    },
  );
  await page.goto("http://localhost:4173/");
  await page.getByRole("button", { name: /Casual Mode/i }).click();
  await expect(page.getByRole("heading", { name: "Tutorial" })).toBeVisible();
  await expect(page.getByText(/Welcome to Bee Happy/i)).toBeVisible();
});

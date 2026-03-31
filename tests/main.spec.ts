import { test, expect } from "@playwright/test";
import { CURRENT_RELEASE_ID } from "../src/changelog/player-changelog";

const LAST_SEEN_RELEASE_KEY = "bee-happy-last-seen-release";
const TUTORIAL_STORAGE_KEY = "bee-happy-tutorial-v1";

test("HUD loads with Bee Happy title", async ({ page }) => {
  await page.addInitScript(
    (opts: { lastKey: string; tutKey: string; lastVal: string }) => {
      localStorage.setItem(opts.lastKey, opts.lastVal);
      localStorage.setItem(opts.tutKey, "done");
    },
    {
      lastKey: LAST_SEEN_RELEASE_KEY,
      tutKey: TUTORIAL_STORAGE_KEY,
      lastVal: CURRENT_RELEASE_ID,
    },
  );
  await page.goto("http://localhost:4173/");
  await expect(page.getByRole("heading", { name: "Bee Happy" })).toBeVisible();
  await page.getByRole("button", { name: /New game/i }).click();
  await expect(page.getByText(/Bees:/)).toBeVisible();
  await expect(page.locator(".season-day-banner").getByText("🌸 Spring")).toBeVisible();
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
  await page.getByRole("button", { name: /New game/i }).click();
  await expect(page.getByRole("heading", { name: "Tutorial" })).toBeVisible();
  await expect(page.getByText(/Welcome to Bee Happy/i)).toBeVisible();
});

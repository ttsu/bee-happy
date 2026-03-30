import { test, expect } from "@playwright/test";

const LAST_SEEN_RELEASE_KEY = "bee-happy-last-seen-release";

test("HUD loads with Bee Happy title", async ({ page }) => {
  await page.addInitScript((key: string) => {
    localStorage.setItem(key, "0.1.0");
  }, LAST_SEEN_RELEASE_KEY);
  await page.goto("http://localhost:4173/");
  await expect(page.getByRole("heading", { name: "Bee Happy" })).toBeVisible();
  await page.getByRole("button", { name: /New game/i }).click();
  await expect(page.getByText(/Bees:/)).toBeVisible();
  await expect(page.locator(".season-day-banner").getByText("🌸 Spring")).toBeVisible();
});

test("What's new appears when last seen release is older than current", async ({
  page,
}) => {
  await page.addInitScript((key: string) => {
    localStorage.setItem(key, "0.0.9");
  }, LAST_SEEN_RELEASE_KEY);
  await page.goto("http://localhost:4173/");
  await expect(page.getByRole("heading", { name: "What's new" })).toBeVisible();
  await page.getByRole("button", { name: "Got it" }).click();
  await expect(page.getByRole("heading", { name: "What's new" })).not.toBeVisible();
  await expect(page.getByRole("heading", { name: "Bee Happy" })).toBeVisible();
});

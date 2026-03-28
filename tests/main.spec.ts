import { test, expect } from "@playwright/test";

test("HUD loads with Bee Happy title", async ({ page }) => {
  await page.goto("http://localhost:4173/");
  await expect(page.getByText("Bee Happy")).toBeVisible();
  await expect(page.getByText(/Bees:/)).toBeVisible();
  await expect(page.locator(".season-day-banner").getByText("Spring")).toBeVisible();
});

import { test, expect } from "@playwright/test";

test("HUD loads with Bee Happy title", async ({ page }) => {
  await page.goto("http://localhost:4173/");
  await expect(page.getByRole("heading", { name: "Bee Happy" })).toBeVisible();
  await page.getByRole("button", { name: /New game/i }).click();
  await expect(page.getByText(/Bees:/)).toBeVisible();
  await expect(page.locator(".season-day-banner").getByText("🌸 Spring")).toBeVisible();
});

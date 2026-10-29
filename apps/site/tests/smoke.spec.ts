import { test, expect } from "@playwright/test";

test.describe("Kalidash Site Smoke Tests", () => {
  test("Home page loads with header and navigation", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/Kalidash/i);

    const logo = page.locator('header a[href="/"]');
    await expect(logo.first()).toBeVisible();
  });

  test("Institucional /sobre-nos loads correctly", async ({ page }) => {
    await page.goto("/sobre-nos");
    const h1 = page.locator("h1");
    await expect(h1).toBeVisible();
    await expect(h1).toContainText(/Já estivemos do seu lado da mesa/i);
  });

  test("Institucional routes (/advisory, /execucao, /solucoes, /kognis, /spectra) load", async ({ page }) => {
    for (const route of ["/advisory", "/execucao", "/solucoes", "/kognis", "/spectra"]) {
      const response = await page.goto(route);
      expect(response?.status()).toBe(200);
      const h1 = page.locator("h1");
      await expect(h1).toBeVisible();
    }
  });

  test("Blog gallery index loads and displays articles", async ({ page }) => {
    const response = await page.goto("/blog");
    expect(response?.status()).toBe(200);

    const articleCards = page.locator('a[href^="/blog/"]');
    await expect(articleCards.first()).toBeVisible();
  });

  test("Blog article page renders sanitized content", async ({ page }) => {
    const response = await page.goto("/blog/operacao-na-era-dos-agentes");
    expect(response?.status()).toBe(200);

    const h1 = page.locator("h1");
    await expect(h1).toBeVisible();

    const articleBody = page.locator("article, [data-article-body], main");
    await expect(articleBody.first()).toBeVisible();
  });

  test("Diagnóstico route renders interactive questionnaire", async ({ page }) => {
    const response = await page.goto("/diagnostico");
    expect(response?.status()).toBe(200);

    const h1 = page.locator("h1");
    await expect(h1).toBeVisible();
  });
});

/* Grava o texto visível (textContent normalizado) do <main> de /advisory em um arquivo. Uso: node text.cjs URL ARQUIVO */
const path = require("path");
const fs = require("fs");
const { createRequire } = require("module");
const req = createRequire(path.resolve(__dirname, "../../../../apps/site/package.json"));
const { chromium } = req("@playwright/test");
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ reducedMotion: "reduce", viewport: { width: 1440, height: 900 } });
  const p = await ctx.newPage();
  await p.goto(process.argv[2] + "/advisory", { waitUntil: "networkidle" });
  await p.waitForTimeout(1500);
  const t = await p.evaluate(() => document.querySelector("main").textContent.replace(/\s+/g, " ").trim());
  fs.writeFileSync(process.argv[3], t);
  console.log(t.length);
  await b.close();
})();

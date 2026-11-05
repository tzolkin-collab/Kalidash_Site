/* Quadros, checagens e vídeo da rolagem da /advisory. Uso (a partir de apps/site, com o servidor em BASE):
 *   node ../../docs/po/relatorios/motion-advisory/capture.cjs [BASE] */
const path = require("path");
const fs = require("fs");
const { createRequire } = require("module");
const req = createRequire(path.resolve(__dirname, "../../../../apps/site/package.json"));
const { chromium } = req("@playwright/test");

const BASE = process.argv[2] || "http://localhost:3301";
const OUT = __dirname;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function goStage(page, sel, p) {
  await page.evaluate(({ sel, p }) => {
    const st = document.querySelector(sel);
    const top = st.getBoundingClientRect().top + scrollY;
    const run = st.offsetHeight - innerHeight;
    document.documentElement.style.scrollBehavior = "auto";
    scrollTo({ top: top + run * p, behavior: "instant" });
  }, { sel, p });
  await sleep(1100);
}
async function goEl(page, sel, off = 120) {
  await page.evaluate(({ sel, off }) => {
    const el = document.querySelector(sel);
    document.documentElement.style.scrollBehavior = "auto";
    scrollTo({ top: el.getBoundingClientRect().top + scrollY - off, behavior: "instant" });
  }, { sel, off });
  await sleep(1800);
}

async function frames(browser, tag, vp, mobile) {
  const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: 1, hasTouch: mobile, isMobile: mobile });
  const page = await ctx.newPage();
  const errors = [];
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto(BASE + "/advisory", { waitUntil: "networkidle" });
  await sleep(6500); // abertura (--enter-delay) e fontes
  const shot = (n) => page.screenshot({ path: path.join(OUT, `${tag}-${n}.png`) });
  await shot("01-hero");
  if (!mobile) {
    for (const p of [0.2, 0.4, 0.62, 0.8, 0.97]) { await goStage(page, '[data-stage="problem"]', p); await shot(`02-problema-${Math.round(p * 100)}`); }
    for (const p of [0.05, 0.3, 0.6, 0.95]) { await goStage(page, '[data-stage="lead"]', p); await shot(`03-lideranca-${Math.round(p * 100)}`); }
  } else {
    await goEl(page, '[data-stage="problem"]', 60); await shot("02-problema-a");
    await goEl(page, '[data-part="marks"]', 300); await shot("02-problema-b");
    await goEl(page, '[data-stage="lead"]', 40); await shot("03-lideranca-a");
    await goEl(page, '[data-stage="lead"] ol', 80); await shot("03-lideranca-b");
  }
  await goEl(page, 'ul[class*="cards"]', mobile ? 80 : 200); await shot("04-rituais-a");
  await page.evaluate(() => scrollBy(0, innerHeight * 0.6)); await sleep(2200); await shot("04-rituais-b");
  await goEl(page, '[data-page="advisory"] section[class*="steps"]', 60); await shot("05-passos");
  await goEl(page, 'ul[class*="crit"]', 160); await shot("06-criterios");
  await goEl(page, 'details[class*="faqItem"]', 160);
  await page.click('details[class*="faqItem"] summary'); await sleep(900); await shot("07-faq-aberta");
  await page.evaluate(() => scrollTo({ top: document.documentElement.scrollHeight, behavior: "instant" })); await sleep(2500); await shot("08-fecho");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  console.log(tag, "overflow-x:", overflow, "erros de console:", errors.length, errors.slice(0, 3));
  await ctx.close();
}

async function overflowAt(browser) {
  for (const w of [1440, 1024, 768, 390]) {
    const ctx = await browser.newContext({ viewport: { width: w, height: w > 800 ? 900 : 844 } });
    const page = await ctx.newPage();
    await page.goto(BASE + "/advisory", { waitUntil: "networkidle" });
    await sleep(1500);
    console.log("largura", w, "scrollWidth-innerWidth =", await page.evaluate(() => document.documentElement.scrollWidth - innerWidth));
    await ctx.close();
  }
}

async function video(browser, tag, vp, mobile) {
  const ctx = await browser.newContext({ viewport: vp, hasTouch: mobile, isMobile: mobile, recordVideo: { dir: path.join(OUT, "_v"), size: vp } });
  const page = await ctx.newPage();
  await page.goto(BASE + "/advisory", { waitUntil: "networkidle" });
  await sleep(6000);
  const total = await page.evaluate(() => document.documentElement.scrollHeight - innerHeight);
  for (let y = 0; y < total; y += 40) { await page.evaluate((yy) => { document.documentElement.style.scrollBehavior = "auto"; scrollTo(0, yy); }, y); await sleep(16); }
  await sleep(1500);
  const v = page.video();
  await ctx.close();
  fs.renameSync(await v.path(), path.join(OUT, `rolagem-${tag}.webm`));
}

(async () => {
  const browser = await chromium.launch();
  if (!process.env.VIDEOONLY) {
  await overflowAt(browser);
  await frames(browser, "desktop", { width: 1440, height: 900 }, false);
  await frames(browser, "mobile", { width: 390, height: 844 }, true);
  }
  if (!process.env.NOVIDEO) {
    await video(browser, "desktop", { width: 1440, height: 900 }, false);
    await video(browser, "mobile", { width: 390, height: 844 }, true);
  }
  fs.rmSync(path.join(OUT, "_v"), { recursive: true, force: true });
  await browser.close();
})();

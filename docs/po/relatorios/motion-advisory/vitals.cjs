/* LCP/CLS (mediana de 3) de duas URLs, e checagens de movimento reduzido e de CPU 4x. Uso, a partir de apps/site:
 *   node ../../docs/po/relatorios/motion-advisory/vitals.cjs http://localhost:3300 http://localhost:3301 */
const path = require("path");
const { createRequire } = require("module");
const req = createRequire(path.resolve(__dirname, "../../../../apps/site/package.json"));
const { chromium } = req("@playwright/test");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const med = (a) => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)];

async function measure(browser, url, vp) {
  const ctx = await browser.newContext({ viewport: vp });
  const page = await ctx.newPage();
  await page.addInitScript(() => {
    window.__lcp = 0; window.__cls = 0;
    new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__lcp = e.startTime; }).observe({ type: "largest-contentful-paint", buffered: true });
    new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__cls += e.value; }).observe({ type: "layout-shift", buffered: true });
  });
  await page.goto(url + "/advisory", { waitUntil: "load" });
  await sleep(6000);
  const r = await page.evaluate(() => ({ lcp: window.__lcp, cls: window.__cls }));
  await ctx.close();
  return r;
}

(async () => {
  const browser = await chromium.launch();
  for (const url of process.argv.slice(2)) {
    for (const [tag, vp] of [["1440", { width: 1440, height: 900 }], ["390", { width: 390, height: 844 }]]) {
      const runs = [];
      for (let i = 0; i < 3; i++) runs.push(await measure(browser, url, vp));
      console.log(url, tag, "LCP(ms)", runs.map((r) => Math.round(r.lcp)).join("/"), "mediana", Math.round(med(runs.map((r) => r.lcp))), "CLS", med(runs.map((r) => r.cls)).toFixed(4));
    }
  }
  /* Movimento reduzido: nada escondido, nada preso, sem atributos de palco. */
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: "reduce" });
  const page = await ctx.newPage();
  await page.goto(process.argv[3] + "/advisory", { waitUntil: "networkidle" });
  await sleep(1500);
  console.log("reduzido:", await page.evaluate(() => ({
    live: document.querySelectorAll("[data-live]").length,
    arm: document.querySelectorAll("[data-arm]").length,
    ocultos: [...document.querySelectorAll("main h2, main li, main details")].filter((e) => getComputedStyle(e).opacity === "0").length,
    alturaPalco: document.querySelector('[data-stage="problem"]').offsetHeight,
    overflow: document.documentElement.scrollWidth - innerWidth,
  })));
  await ctx.close();
  /* CPU 4x mais lenta: quadros durante a rolagem do palco da seção 2. */
  const c2 = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const p2 = await c2.newPage();
  const cdp = await c2.newCDPSession(p2);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  await p2.goto(process.argv[3] + "/advisory", { waitUntil: "networkidle" });
  await sleep(6000);
  const fps = await p2.evaluate(async () => {
    const st = document.querySelector('[data-stage="problem"]');
    const top = st.getBoundingClientRect().top + scrollY;
    const run = st.offsetHeight - innerHeight;
    document.documentElement.style.scrollBehavior = "auto";
    let frames = 0; let t0 = performance.now(); let worst = 0; let last = t0;
    await new Promise((res) => {
      const step = () => {
        const now = performance.now(); worst = Math.max(worst, now - last); last = now; frames++;
        const k = (now - t0) / 4000;
        if (k >= 1) return res();
        scrollTo(0, top + run * k);
        requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    });
    return { fps: Math.round((frames / (performance.now() - t0)) * 1000), piorQuadroMs: Math.round(worst) };
  });
  console.log("CPU 4x, rolagem do palco da seção 2:", fps);
  await browser.close();
})();

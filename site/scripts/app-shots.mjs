// Screenshots of the mobile app for the landing page (public/images/app/*.webp; needs uv for the WebP step), taken from the running site in the
// browser-only demo so they need no server. Usage: start `npm run dev -- --port 3100`, then
//   SHELL_BIN=/path/to/chrome-headless-shell node scripts/app-shots.mjs [http://localhost:3100]
import { chromium } from "playwright-core";
import { execFileSync } from "node:child_process";
import { mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";

const BASE = process.argv[2] ?? "http://localhost:3100";
const OUT = join(import.meta.dirname, "..", "public", "images", "app");
mkdirSync(OUT, { recursive: true });

const clinician = { token: "local", user: { id: "u-clin-1", role: "clinician", name: "Dr. Demo", email: "dr.demo@membrain.ae", title: "Consultant, memory clinic" }, exp: Date.now() + 864e5, mode: "browser" };
const patient = { token: "local", user: { id: "u-MB-1041", role: "participant", pid: "MB-1041", name: "Fatima" }, exp: Date.now() + 864e5, mode: "browser" };

const browser = await chromium.launch({ executablePath: process.env.SHELL_BIN, headless: true, args: ["--hide-scrollbars", "--force-color-profile=srgb"] });

async function shot(name, session, lang, steps = async () => {}) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: lang === "ar" ? "ar-AE" : "en-GB", reducedMotion: "reduce" });
  await ctx.addInitScript(([s, l]) => {
    localStorage.setItem("membrain.auth.v1", JSON.stringify(s));
    localStorage.setItem("membrain.app.lang", l);
  }, [session, lang]);
  const page = await ctx.newPage();
  await page.goto(`${BASE}/app/?mode=browser`, { waitUntil: "networkidle" });
  await page.waitForTimeout(2200); // the splash
  await steps(page);
  await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" }); // the dev server's badge
  await page.waitForTimeout(500);
  const png = join(OUT, `${name}.png`);
  await page.screenshot({ path: png });
  // PNG to WebP with Pillow (not every ffmpeg build has a WebP encoder).
  execFileSync("uv", ["run", "--no-project", "--with", "pillow", "python", "-c",
    "import sys; from PIL import Image; Image.open(sys.argv[1]).convert('RGB').save(sys.argv[2], 'WEBP', quality=86, method=6)", png, join(OUT, `${name}.webp`)]);
  rmSync(png);
  await ctx.close();
  console.log("wrote", name);
}

await shot("clinician-home", clinician, "en");
await shot("clinician-alerts", clinician, "en", async (p) => p.getByRole("button", { name: "Alerts" }).click());
await shot("clinician-map", clinician, "en", async (p) => p.getByRole("button", { name: "Map" }).click());
await shot("intake", clinician, "en", async (p) => {
  await p.getByRole("button", { name: "New", exact: true }).click();
  await p.getByText("New concern", { exact: true }).click();
  await p.locator("textarea").fill("Our helper says Dad left the gas on twice this month and asks the same question many times a day. My son now handles his bills. It has been getting worse for about a year.");
  await p.getByRole("button", { name: "Read it" }).click();
  await p.waitForTimeout(900);
});
await shot("patient-home-ar", patient, "ar");
await browser.close();

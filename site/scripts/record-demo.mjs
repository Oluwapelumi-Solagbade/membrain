// Usage, from the repository root with the API serving a fresh build (see site/README.md):
//   (cd site && npm run build) && uvicorn api.main:app --port 8010 &
//   npm i --no-save playwright-core && BASE=http://localhost:8010 node site/scripts/record-demo.mjs /tmp/membrain-demo
// SHELL_BIN may point at a chrome-headless-shell binary (renders the exact viewport); then encode with ffmpeg
// as described in site/README.md.
// Records the MemBrain demo: one real journey through the live site and API, on a freshly reset server.
// Captions and a visible pointer are drawn into the page while recording; nothing is edited afterwards.
import { chromium } from "playwright-core";
import { writeFileSync } from "node:fs";

const BASE = process.env.BASE ?? "http://localhost:8010";
const OUT = process.argv[2];
const W = 1440, H = 900;

// Reset the server so the recording starts from the seeded cohort only.
await fetch(BASE + "/demo/reset", { method: "POST" });

const OVERLAY = `
(() => {
  const css = document.createElement('style');
  css.textContent = \`
    ::-webkit-scrollbar { display: none !important; }
    html { scrollbar-width: none !important; }
    #mb-cursor { position: fixed; z-index: 2147483647; left: 0; top: 0; width: 22px; height: 22px; pointer-events: none;
      transform: translate(-3px, -2px); transition: transform .12s ease-out; }
    #mb-cursor.down { transform: translate(-3px, -2px) scale(.86); }
    #mb-ripple { position: fixed; z-index: 2147483646; width: 44px; height: 44px; margin: -22px 0 0 -22px; border-radius: 50%;
      background: rgba(42,96,69,.28); pointer-events: none; opacity: 0; }
    #mb-ripple.go { animation: mbr .45s ease-out; }
    @keyframes mbr { from { opacity: 1; transform: scale(.3); } to { opacity: 0; transform: scale(1.3); } }
    #mb-cap { pointer-events: none; position: fixed; z-index: 2147483645; left: 50%; bottom: 34px; transform: translate(-50%, 12px); opacity: 0;
      max-width: 1000px; display: flex; align-items: center; gap: 14px; padding: 14px 24px 14px 14px; border-radius: 18px;
      background: rgba(11,51,36,.94); color: #fff; font: 500 19px/1.35 "IBM Plex Sans", system-ui, sans-serif;
      box-shadow: 0 18px 40px -16px rgba(0,0,0,.45); transition: opacity .35s ease, transform .35s ease; }
    #mb-cap.on { opacity: 1; transform: translate(-50%, 0); }
    #mb-cap.top { bottom: auto; top: 92px; transform: translate(-50%, -12px); }
    #mb-cap.top.on { transform: translate(-50%, 0); }
    #mb-veil { pointer-events: none; position: fixed; inset: 0; z-index: 2147483640; background: #fbfaf7; opacity: 0; transition: opacity .35s ease; }
    #mb-cap b { flex: none; display: flex; align-items: center; justify-content: center; min-width: 34px; height: 34px; padding: 0 8px;
      border-radius: 999px; background: #e0ad62; color: #0b3324; font: 700 15px/1 "IBM Plex Sans", system-ui, sans-serif; }
    #mb-end { pointer-events: none; position: fixed; inset: 0; z-index: 2147483647; display: flex; flex-direction: column; align-items: center; justify-content: center;
      gap: 22px; background: #fbfbfa; opacity: 0; transition: opacity .6s ease; }
    #mb-end.on { opacity: 1; }
    #mb-end img { height: 64px; }
    #mb-end h1 { margin: 0; font: 600 44px/1.15 "Source Serif 4", Georgia, serif; color: #0f1a17; text-align: center; letter-spacing: -.01em; }
    #mb-end h1 span { color: #2a6045; }
    #mb-end p { margin: 0; font: 400 17px/1.4 "IBM Plex Sans", system-ui, sans-serif; color: #6c7772; }
  \`;
  const mount = () => {
    if (document.getElementById('mb-cursor')) return;
    document.head.appendChild(css);
    const c = document.createElement('div'); c.id = 'mb-cursor';
    c.innerHTML = '<svg viewBox="0 0 24 24" width="22" height="22"><path d="M4 2.5v17.2l4.6-4.4 3 6.7 2.9-1.3-3-6.6h6.4z" fill="#0f1a17" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/></svg>';
    const r = document.createElement('div'); r.id = 'mb-ripple';
    const cap = document.createElement('div'); cap.id = 'mb-cap';
    const veil = document.createElement('div'); veil.id = 'mb-veil';
    if (sessionStorage.getItem('mb-veil') === '1') { veil.style.transition = 'none'; veil.style.opacity = '1'; }
    document.body.append(veil, c, r, cap);
    const xy = JSON.parse(sessionStorage.getItem('mb-xy') || '[720,450]');
    c.style.left = xy[0] + 'px'; c.style.top = xy[1] + 'px';
    addEventListener('mousemove', (e) => { c.style.left = e.clientX + 'px'; c.style.top = e.clientY + 'px';
      sessionStorage.setItem('mb-xy', JSON.stringify([e.clientX, e.clientY])); }, true);
    addEventListener('mousedown', (e) => { c.classList.add('down'); r.style.left = e.clientX + 'px'; r.style.top = e.clientY + 'px';
      r.classList.remove('go'); void r.offsetWidth; r.classList.add('go'); }, true);
    addEventListener('mouseup', () => c.classList.remove('down'), true);
  };
  window.__veil = (on) => { mount(); const v = document.getElementById('mb-veil'); sessionStorage.setItem('mb-veil', on ? '1' : '0');
    v.style.transition = 'opacity .35s ease'; v.style.opacity = on ? '1' : '0'; };
  window.__cap = (n, text, pos) => { mount(); const cap = document.getElementById('mb-cap');
    cap.classList.toggle('top', pos === 'top');
    if (!text) { cap.classList.remove('on'); return; }
    cap.innerHTML = (n ? '<b>' + n + '</b>' : '') + '<span></span>'; cap.querySelector('span').textContent = text;
    requestAnimationFrame(() => cap.classList.add('on')); };
  window.__end = () => { mount(); const e = document.createElement('div'); e.id = 'mb-end';
    e.innerHTML = '<img src="/brand/membrain-logo.png" alt=""><h1>From “something’s not right”<br><span>to the right clinician.</span></h1><p>Prototype · all people and records are synthetic · MemBrain never diagnoses</p>';
    document.body.appendChild(e); requestAnimationFrame(() => e.classList.add('on')); };
  if (document.readyState === 'loading') addEventListener('DOMContentLoaded', mount); else mount();
})();`;

const browser = await chromium.launch({ executablePath: process.env.SHELL_BIN, headless: true, args: ["--hide-scrollbars", "--force-color-profile=srgb"] });
const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1, recordVideo: { dir: OUT, size: { width: W, height: H } }, locale: "en-GB", reducedMotion: "no-preference" });
await ctx.addInitScript(OVERLAY);
const page = await ctx.newPage();
const t0 = Date.now();
const marks = {};
const mark = (k) => (marks[k] = (Date.now() - t0) / 1000);
const wait = (ms) => page.waitForTimeout(ms);
const cap = (n, text, pos = "bottom") => page.evaluate(([n, t, p]) => window.__cap(n, t, p), [n, text, pos]);
const veil = (on) => page.evaluate((on) => window.__veil(on), on);
/** Change page behind a short fade, so loading states never show. */
async function nav(go, ready) {
  await veil(true);
  await wait(420);
  await go();
  await page.waitForSelector(ready, { timeout: 20000 });
  await page.evaluate(() => (document.documentElement.style.scrollBehavior = "auto"));
  await wait(450);
  await veil(false);
  await wait(380);
}

async function moveTo(x, y, steps = 28) {
  await page.mouse.move(x, y, { steps });
}
async function click(locator, { pause = 250 } = {}) {
  const el = locator.first();
  await el.scrollIntoViewIfNeeded();
  const b = await el.boundingBox();
  await moveTo(b.x + b.width / 2, b.y + b.height / 2);
  await wait(pause);
  await page.mouse.down(); await wait(90); await page.mouse.up();
}
async function smoothScroll(y, ms = 1200) {
  await page.evaluate(([y, ms]) => new Promise((done) => {
    const s = scrollY, d = y - s, t = performance.now();
    const ease = (k) => (k < .5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2);
    const step = (n) => { const k = Math.min(1, (n - t) / ms); scrollTo(0, s + d * ease(k)); if (k < 1) requestAnimationFrame(step); else done(); };
    requestAnimationFrame(step);
  }), [y, ms]);
}
async function scrollInside(sel, to, ms = 1100) {
  await page.evaluate(([sel, to, ms]) => new Promise((done) => {
    const el = document.querySelector(sel); if (!el) return done();
    const s = el.scrollTop, d = (to === 'end' ? el.scrollHeight : to) - s, t = performance.now();
    const step = (n) => { const k = Math.min(1, (n - t) / ms); el.scrollTop = s + d * (k < .5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2); if (k < 1) requestAnimationFrame(step); else done(); };
    requestAnimationFrame(step);
  }), [sel, to, ms]);
}

// 1. Landing page
await page.goto(BASE + "/", { waitUntil: "networkidle" });
await page.evaluate(() => (document.documentElement.style.scrollBehavior = "auto"));
mark("landing");
await wait(700);
await cap(null, "MemBrain helps families in the UAE get from a first worry about memory to the right clinician.");
await moveTo(560, 470, 40);
await wait(3600);
await cap(null, "Families can raise it where they already talk: a voice note on WhatsApp, or Telegram.");
const chatTop = await page.evaluate(() => document.getElementById("chat").getBoundingClientRect().top + scrollY + 230);
await smoothScroll(chatTop, 1800);
mark("chat");
await wait(9500);
await cap(null, "Or start here, in the browser.");
await smoothScroll(0, 1400);
await wait(500);
await nav(() => click(page.locator('header a:has-text("Raise a concern")')), 'button:has-text("A family member")');

// 2. The concern chat
mark("concern");
await cap(1, "Anyone who notices a change can raise it: the person, family, a helper or a doctor.", "top");
await wait(2200);
await click(page.locator('button:has-text("A family member")'));
await wait(1200);
await cap(2, "They describe it in their own words, by voice or text, in Gulf Arabic or English.", "top");
await click(page.locator("textarea"));
await page.keyboard.type("For about a year Dad keeps asking the same questions. My brother drives him everywhere now since he got lost coming home from the mosque, and my brother handles his bills too.", { delay: 24 });
await wait(500);
await page.keyboard.press("Enter");
mark("facts");
await wait(1700);
await cap(3, "MemBrain picks out the facts, each with the words it came from. Anything wrong can be unticked.", "top");
await scrollInside("main .overflow-y-auto", 330, 1400);
await wait(3200);
await scrollInside("main .overflow-y-auto", "end", 1600);
await wait(1800);
await click(page.locator('button:has-text("That\'s right")'));
await wait(2000);
await cap(4, "Two everyday tasks are now done by someone else, so a clinician reviews it within 21 days, without waiting for a test.", "top");
await scrollInside("main .overflow-y-auto", "end", 900);
mark("outcome");
await wait(5200);

// 3. The clinician's queue
await cap(null, null);
await nav(() => page.goto(BASE + "/clinician/"), 'a:has-text("Confirm concern and refer")');
mark("queue");
await cap(5, "It arrives at the top of the clinician's review queue, with the reason behind its level.");
await moveTo(470, 470);
await wait(3800);

// 4. Refer, from the case
await click(page.locator('a:has-text("Confirm concern and refer")'));
await page.waitForSelector('#refer button:has-text("Record referral")');
await page.evaluate(() => (document.documentElement.style.scrollBehavior = "auto"));
await cap(6, "The clinician refers: services matched on language and funding, and a reason drafted only from confirmed facts.", "top");
mark("refer");
await wait(900);
const referTop = await page.evaluate(() => document.getElementById("refer").getBoundingClientRect().top + scrollY - 110);
await smoothScroll(referTop, 1000);
await wait(4200);
await click(page.locator('#refer button:has-text("Record referral")'));
await wait(1600);

// 5. The referral is tracked
await page.waitForSelector("#referrals");
const refTop = await page.evaluate(() => document.getElementById("referrals").getBoundingClientRect().top + scrollY - 110);
await smoothScroll(refTop, 1400);
await cap(7, "Every step of the referral is tracked. It only counts as done when follow-up is written down.", "top");
mark("loop");
await wait(2400);
await click(page.locator('#referrals button:text-is("Sent")'));
await wait(2600);

// 6. Reports and evidence
await cap(null, null);
await nav(() => page.goto(BASE + "/clinician/reports/"), "text=This cohort");
mark("reports");
await cap(8, "Programme reports show whether the loop really closes, and for whom.");
await moveTo(900, 420);
await wait(2600);
await smoothScroll(620, 1600);
await wait(1800);
await nav(() => page.goto(BASE + "/clinician/validation/"), "text=MemBrain against usual care");
mark("validation");
await cap(9, "And the evidence, stated honestly: what is measured, what is simulated, what is not proven yet.");
await wait(4400);

// 7. End card
await cap(null, null);
await page.evaluate(() => window.__end());
mark("end");
await wait(3600);
mark("stop");

await ctx.close();
const video = await page.video().path();
writeFileSync(OUT + "/marks.json", JSON.stringify({ video, marks }, null, 2));
await browser.close();
console.log(JSON.stringify({ video, marks }));

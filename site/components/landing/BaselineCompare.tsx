import { config, getEngine, type Lang, type Persona, type Session } from "@/lib/mb";
import personasJson from "@/lib/generated/personas.json";
import { SectionHeading } from "@/components/ui";

/* "One score can mislead": two synthetic people, read by a one-off test with one cut-off for everyone, and by
 * MemBrain (age- and schooling-adjusted norms, then the person's own baseline). Every number below is computed by the
 * same engine the app runs (web/engine.js, parity-tested against Python) when the page is built. Nothing is typed in. */

type Rci = { baseline: number; expected_practice: number; se_diff: number; rci: number };
type Ev = { date: string; level: string; reasons: string[]; rci?: { domains: Record<string, Rci> } };
type FullEngine = {
  evaluate: (p: Persona, s: Session[]) => { history: Ev[] };
  compositeZ: (raw: Record<string, number>, edu: string, age: number) => number;
};

const C = config as unknown as { NAIVE_NORM_EDUCATION: string; LOW_BASELINE_Z: number; RCI_DOMAIN_CHECK: number; BASELINE_SESSIONS: number };
const CASES: { id: string; oneOffAt: "first" | "latest" }[] = [
  { id: "MB-1041", oneOffAt: "first" }, // Fatima: screened once at her first visit
  { id: "MB-1187", oneOffAt: "latest" }, // Ahmed: screened once today
];
const DOMAIN = "memory_delayed";

const T = {
  en: {
    eyebrow: "Why a personal baseline",
    title: "One score can mislead. The same test, read two ways.",
    intro:
      "Two people from our synthetic demo. A one-off test compares one score with a single cut-off for everyone. MemBrain compares each person with people of the same age and schooling, then with themselves over time. Both verdicts are computed by the MemBrain engine; nothing here is typed in by hand.",
    schooling: { none: "no formal schooling", primary: "primary school", secondary: "secondary school", tertiary: "university" } as Record<string, string>,
    years: "years",
    chart: "Words remembered after a delay (out of 10), at each check-in",
    baseline: "baseline",
    band: "Normal variation around their own baseline",
    oneOff: "One-off test, one cut-off for everyone",
    ours: "MemBrain: age, schooling and their own baseline",
    refer: "Refer",
    normal: "Normal",
    falseAlarm: "False alarm",
    missed: "Decline missed",
    zLine: (z: string, cut: string, when: string) => `Overall score z ${z} at ${when} (refer at ${cut} or below)`,
    first: "the first visit",
    latest: "the latest visit",
    level: { STABLE: "Stable", CHECK_AGAIN: "Check again", CLINICIAN_REVIEW: "Clinician review", URGENT: "Urgent", BASELINE: "Building baseline" } as Record<string, string>,
    whyStable: "Every check-in is within normal variation of her own baseline. No referral, no needless worry.",
    whyReview: (r: string) => `Delayed recall fell beyond test noise (change index ${r}, threshold ${fmt(C.RCI_DOMAIN_CHECK)}) and stayed down on a repeat with a different word list. A clinician reviews it.`,
    foot:
      "Synthetic people. For illustration, the one-off test uses norms from people with secondary schooling, a common default when tests are not adapted locally. MemBrain's thresholds come from published studies and are not yet validated in the UAE; a clinician reviews every flag.",
  },
  ar: {
    eyebrow: "لماذا خط أساس شخصي",
    title: "درجة واحدة قد تضلّل. الاختبار نفسه، بقراءتين.",
    intro:
      "شخصان من بياناتنا التجريبية المصطنعة. الاختبار لمرة واحدة يقارن درجة واحدة بحدّ فاصل واحد للجميع. أما MemBrain فيقارن كل شخص بمن هم في عمره ومستوى تعليمه، ثم بنفسه عبر الوقت. محرّك MemBrain يحسب النتيجتين؛ لا شيء هنا مكتوب يدويًا.",
    schooling: { none: "دون تعليم نظامي", primary: "تعليم ابتدائي", secondary: "تعليم ثانوي", tertiary: "تعليم جامعي" } as Record<string, string>,
    years: "سنة",
    chart: "عدد الكلمات المتذكَّرة بعد فترة (من 10) في كل فحص",
    baseline: "خط الأساس",
    band: "التفاوت الطبيعي حول خط الأساس الخاص به",
    oneOff: "اختبار لمرة واحدة، بحدّ فاصل واحد للجميع",
    ours: "MemBrain: العمر والتعليم وخط الأساس الشخصي",
    refer: "إحالة",
    normal: "طبيعي",
    falseAlarm: "إنذار كاذب",
    missed: "تراجع لم يُكتشف",
    zLine: (z: string, cut: string, when: string) => `الدرجة الإجمالية z ${z} في ${when} (الإحالة عند ${cut} أو أقل)`,
    first: "الزيارة الأولى",
    latest: "آخر زيارة",
    level: { STABLE: "مستقر", CHECK_AGAIN: "يُعاد الفحص", CLINICIAN_REVIEW: "مراجعة الطبيب", URGENT: "عاجل", BASELINE: "بناء خط الأساس" } as Record<string, string>,
    whyStable: "كل فحص ضمن التفاوت الطبيعي حول خط الأساس الخاص بها. لا إحالة ولا قلق دون داعٍ.",
    whyReview: (r: string) => `انخفض التذكّر المؤجَّل أكثر من هامش خطأ الاختبار (مؤشر التغيّر ${r}، والحدّ ${fmt(C.RCI_DOMAIN_CHECK)}) وبقي منخفضًا عند الإعادة بقائمة كلمات مختلفة. يراجعه طبيب.`,
    foot:
      "أشخاص مصطنعون. للتوضيح، يستخدم الاختبار لمرة واحدة معايير أشخاص بتعليم ثانوي، وهو خيار شائع حين لا تُكيَّف الاختبارات محليًا. حدود MemBrain مأخوذة من دراسات منشورة ولم يُتحقق منها بعد في الإمارات، ويراجع طبيبٌ كل تنبيه.",
  },
};

const fmt = (x: number) => "\u2066" + (x < 0 ? "−" : "") + Math.abs(x).toFixed(2) + "\u2069";

function Sparkline({ values, lo, hi, review, k, lang }: { values: number[]; lo: number; hi: number; review: boolean[]; k: number; lang: Lang }) {
  const W = 300, H = 120, P = 16, max = 10;
  const x = (i: number) => P + (i * (W - 2 * P)) / Math.max(1, values.length - 1);
  const y = (v: number) => H - P - (Math.max(0, Math.min(max, v)) / max) * (H - 2 * P);
  const t = T[lang];
  return (
    <div dir="ltr">
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={t.chart} className="h-auto w-full">
      {values.length > k && (
        <rect x={(x(k - 1) + x(k)) / 2} y={y(hi)} width={W - P / 2 - (x(k - 1) + x(k)) / 2} height={Math.max(2, y(lo) - y(hi))} rx={4} className="fill-leaf/15" />
      )}
      <text x={(x(0) + x(k - 1)) / 2} y={H - 2} textAnchor="middle" className="fill-muted text-[9px] uppercase tracking-wider">{t.baseline}</text>
      <polyline points={values.map((v, i) => `${x(i)},${y(v)}`).join(" ")} fill="none" className="stroke-deep/40" strokeWidth={1.5} />
      {values.map((v, i) => (
        <g key={i}>
          <circle cx={x(i)} cy={y(v)} r={6} className={review[i] ? "fill-lv-review" : i < k ? "fill-lv-base" : "fill-deep"} />
          <text x={x(i)} y={y(v) - 11} textAnchor="middle" className="fill-ink text-[12px] font-semibold">{v}</text>
        </g>
      ))}
    </svg>
    </div>
  );
}

export function BaselineCompare({ lang }: { lang: Lang }) {
  const t = T[lang];
  const E = getEngine() as unknown as FullEngine;
  const personas = personasJson as unknown as Persona[];
  const cards = CASES.flatMap(({ id, oneOffAt }) => {
    const p = personas.find((x) => x.id === id);
    if (!p) return [];
    const scored = p.sessions.filter((s) => s.raw);
    const hist = E.evaluate(p, p.sessions).history;
    const evs = hist.filter((_, i) => p.sessions[i]?.raw);
    const latest = evs[evs.length - 1];
    const shown = oneOffAt === "first" ? scored[0] : scored[scored.length - 1];
    const z = E.compositeZ(shown.raw as Record<string, number>, C.NAIVE_NORM_EDUCATION, p.age);
    const oneOffRefers = z <= C.LOW_BASELINE_Z;
    const rci = latest.rci?.domains[DOMAIN];
    const centre = rci ? rci.baseline + rci.expected_practice : 0;
    const half = rci ? Math.abs(C.RCI_DOMAIN_CHECK) * rci.se_diff : 0;
    const values = scored.map((s) => (s.raw as Record<string, number>)[DOMAIN]);
    const review = evs.map((e) => !!e.rci && e.rci.domains[DOMAIN].rci <= C.RCI_DOMAIN_CHECK);
    const flagged = latest.level === "CLINICIAN_REVIEW" || latest.level === "URGENT";
    return [{ p, z, oneOffRefers, oneOffAt, latest, values, lo: centre - half, hi: centre + half, review, flagged, rciValue: rci?.rci ?? 0 }];
  });

  return (
    <section id="baseline" aria-labelledby="bl-title" className="scroll-mt-20 border-t border-line bg-white py-14 lg:py-20">
      <div className="mx-auto max-w-[1320px] px-4 sm:px-6 lg:px-8">
        <SectionHeading id="bl-title" eyebrow={t.eyebrow} title={t.title} intro={t.intro} />
        <div className="mt-10 grid gap-6 lg:grid-cols-2">
          {cards.map((c) => {
            const wrongOneOff = c.oneOffRefers !== c.flagged;
            return (
              <article key={c.p.id} className="rounded-2xl border border-line bg-white p-6 shadow-sm">
                <h3 className="text-[20px] font-semibold tracking-tight">
                  {c.p.display_name[lang]} · {c.p.age} {t.years} · {t.schooling[c.p.education]}
                </h3>
                <p className="mt-4 text-[13px] text-muted">{t.chart}</p>
                <Sparkline values={c.values} lo={c.lo} hi={c.hi} review={c.review} k={C.BASELINE_SESSIONS} lang={lang} />
                <p className="flex items-center gap-2 text-[12px] text-muted">
                  <span aria-hidden className="inline-block h-3 w-5 rounded-sm bg-leaf/15" /> {t.band}
                </p>

                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-xl border border-line bg-mist p-4">
                    <p className="text-[12.5px] font-medium text-muted">{t.oneOff}</p>
                    <p className="mt-1 text-[22px] font-semibold">{c.oneOffRefers ? t.refer : t.normal}</p>
                    <p className="mt-1 text-[12.5px] leading-snug text-body">{t.zLine(fmt(c.z), fmt(C.LOW_BASELINE_Z), c.oneOffAt === "first" ? t.first : t.latest)}</p>
                    {wrongOneOff && (
                      <p className="mt-2 inline-block rounded-md bg-lv-review-soft px-2 py-0.5 text-[12px] font-semibold text-lv-review">
                        {c.oneOffRefers ? t.falseAlarm : t.missed}
                      </p>
                    )}
                  </div>
                  <div className="rounded-xl border border-deep/30 bg-white p-4">
                    <p className="text-[12.5px] font-medium text-muted">{t.ours}</p>
                    <p className={`mt-1 text-[22px] font-semibold ${c.flagged ? "text-lv-review" : "text-deep"}`}>{t.level[c.latest.level] ?? c.latest.level}</p>
                    <p className="mt-1 text-[12.5px] leading-snug text-body">{c.flagged ? t.whyReview(fmt(c.rciValue)) : t.whyStable}</p>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
        <p className="mt-6 max-w-[860px] text-[12.5px] leading-relaxed text-muted">{t.foot}</p>
      </div>
    </section>
  );
}

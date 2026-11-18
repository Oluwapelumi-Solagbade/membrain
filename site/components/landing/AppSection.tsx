// "MemBrain in your pocket": the mobile app on the landing page, with real screenshots (scripts/app-shots.mjs), the
// Android download (built by .github/workflows/android.yml).
import Image from "next/image";
import { BellRing, Download, MapPinned, Mic, Smartphone, UsersRound } from "lucide-react";
import { Eyebrow } from "@/components/ui";
import { APK_URL } from "@/lib/app";
import { asset } from "@/lib/asset";
import type { Lang } from "@/lib/mb";

const T = {
  en: {
    eyebrow: "The MemBrain app",
    title: ["MemBrain, in your ", "pocket", "."],
    intro: "One app for the whole journey. Families report a change by voice and the family questionnaire; the person does the spoken check-in; clinicians work the alert queue, the map of the emirates, referrals and written reports. Everything is read from and written to the MemBrain server as it happens, so the phone and the clinician workspace always show the same record.",
    features: [
      { icon: Mic, title: "Speak, don't type", text: "Concerns and check-ins by voice, in Arabic or English, read on the phone as you speak." },
      { icon: BellRing, title: "Alerts that explain themselves", text: "Urgent first, every level with its reasons and the next action." },
      { icon: MapPinned, title: "The emirates at a glance", text: "Who needs attention where, and where services are missing." },
      { icon: UsersRound, title: "Family in the loop", text: "Report a change since last time and answer the family questionnaire." },
    ],
    download: "Download for Android",
    apk: "Android APK · about 6 MB",
    shots: [
      { src: "/images/app/clinician-home.webp", alt: "The clinician's home screen: people needing review, urgent alerts and triage levels" },
      { src: "/images/app/intake.webp", alt: "A new concern read on the phone: an urgent sign shown first, and the facts picked out" },
      { src: "/images/app/patient-home-ar.webp", alt: "The person's home screen in Arabic: their latest message, next check-in and plan" },
    ],
    note: "Prototype with synthetic data. MemBrain flags risk and change; it never diagnoses.",
  },
  ar: {
    eyebrow: "تطبيق MemBrain",
    title: ["MemBrain ", "في جيبك", "."],
    intro: "تطبيق واحد للرحلة كلها. تبلّغ الأسرة عن التغيّر بالصوت وتجيب عن استبيان الأسرة، ويُجري الشخص الفحص الصوتي، ويعمل الأطباء على قائمة التنبيهات وخريطة الإمارات والإحالات والتقارير المكتوبة. كل ما يجري يُقرأ من خادم MemBrain ويُحفظ فيه لحظة حدوثه، فيرى الهاتف وواجهة الطبيب السجل نفسه دائمًا.",
    features: [
      { icon: Mic, title: "تحدّث بدلًا من الكتابة", text: "البلاغات والفحوص بالصوت، بالعربية أو بالإنجليزية، ويقرؤها الهاتف أثناء حديثك." },
      { icon: BellRing, title: "تنبيهات تشرح نفسها", text: "العاجل أولًا، ولكل مستوى أسبابه والخطوة التالية." },
      { icon: MapPinned, title: "الإمارات في لمحة", text: "من يحتاج إلى اهتمام وأين، وأين تنقص الخدمات." },
      { icon: UsersRound, title: "الأسرة جزء من الرحلة", text: "الإبلاغ عن تغيّر منذ المرة الماضية والإجابة عن استبيان الأسرة." },
    ],
    download: "حمّل التطبيق لأندرويد",
    apk: "ملف APK لأندرويد · نحو ٦ ميغابايت",
    shots: [
      { src: "/images/app/patient-home-ar.webp", alt: "الشاشة الرئيسية للشخص بالعربية: آخر المستجدات والفحص القادم والخطة" },
      { src: "/images/app/intake.webp", alt: "بلاغ جديد يقرؤه الهاتف: العلامة العاجلة أولًا ثم المعلومات المستخرجة" },
      { src: "/images/app/clinician-home.webp", alt: "الشاشة الرئيسية للطبيب: من يحتاج إلى مراجعة والتنبيهات العاجلة ومستويات الفرز" },
    ],
    note: "نموذج تجريبي ببيانات وهمية. يرصد MemBrain الخطر والتغيّر، ولا يشخّص أبدًا.",
  },
};

function Phone({ src, alt, className = "", priority = false }: { src: string; alt: string; className?: string; priority?: boolean }) {
  return (
    <div className={`relative rounded-[42px] bg-[#0d1512] p-[9px] shadow-[0_40px_80px_-30px_rgb(15_35_30/0.55),inset_0_0_0_1.5px_rgb(255_255_255/0.08)] ${className}`}>
      <div className="relative overflow-hidden rounded-[34px] bg-[#f4f6f2]" style={{ aspectRatio: "390 / 844" }}>
        <Image src={asset(src)} alt={alt} fill sizes="(max-width: 768px) 70vw, 300px" className="object-cover object-top" priority={priority} />
        <span aria-hidden className="absolute left-1/2 top-2.5 h-[22px] w-[92px] -translate-x-1/2 rounded-full bg-[#0d1512]" />
      </div>
    </div>
  );
}

export function AppSection({ lang }: { lang: Lang }) {
  const t = T[lang];
  const ar = lang === "ar";
  return (
    <section id="app" aria-labelledby="app-title" className="relative scroll-mt-20 overflow-hidden border-t border-line bg-deep py-16 text-white lg:py-24">
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(70%_60%_at_85%_10%,rgb(224_173_98/0.18),transparent_60%),radial-gradient(60%_70%_at_0%_100%,rgb(56_132_96/0.45),transparent_60%)]" />
      <div className="relative mx-auto grid max-w-[1320px] items-center gap-14 px-4 sm:px-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:px-8">
        <div>
          <Eyebrow className="text-sand"><Smartphone size={15} className="me-2 inline -translate-y-px" aria-hidden />{t.eyebrow}</Eyebrow>
          <h2 id="app-title" className={`mt-3 font-serif text-[36px] font-semibold tracking-[-0.015em] text-balance sm:text-[48px] ${ar ? "leading-[1.3]" : "leading-[1.06]"}`}>
            {t.title[0]}<span className="text-sand">{t.title[1]}</span>{t.title[2]}
          </h2>
          <p className={`mt-4 max-w-[560px] text-[17px] text-white/75 ${ar ? "leading-[1.9]" : "leading-[1.6]"}`}>{t.intro}</p>
          <ul className="mt-8 grid gap-4 sm:grid-cols-2">
            {t.features.map(({ icon: I, title, text }) => (
              <li key={title} className="flex gap-3.5">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/10 text-sand ring-1 ring-white/15"><I size={19} /></span>
                <span>
                  <span className="block text-[15.5px] font-semibold">{title}</span>
                  <span className={`mt-0.5 block text-[14px] text-white/65 ${ar ? "leading-[1.8]" : "leading-snug"}`}>{text}</span>
                </span>
              </li>
            ))}
          </ul>
          <div className="mt-9 flex flex-wrap items-center gap-3">
            <a href={APK_URL} className="inline-flex items-center gap-3 rounded-2xl bg-white px-5 py-3.5 text-deep shadow-[0_16px_34px_-16px_rgb(0_0_0/0.6)] transition-transform hover:-translate-y-0.5">
              <Download size={22} />
              <span className="text-start">
                <span className="block text-[15.5px] font-semibold leading-tight">{t.download}</span>
                <span className="block text-[12px] text-body">{t.apk}</span>
              </span>
            </a>
          </div>
          <p className="mt-5 text-[12.5px] text-white/50">{t.note}</p>
        </div>
        <div className="relative mx-auto flex w-full max-w-[640px] items-end justify-center gap-0">
          <Phone src={t.shots[0].src} alt={t.shots[0].alt} className="z-10 w-[44%] -me-[8%] translate-y-6 rotate-[-6deg] max-sm:hidden" />
          <Phone src={t.shots[1].src} alt={t.shots[1].alt} className="z-20 w-[62%] sm:w-[46%]" priority />
          <Phone src={t.shots[2].src} alt={t.shots[2].alt} className="z-10 w-[44%] -ms-[8%] translate-y-6 rotate-[6deg] max-sm:hidden" />
        </div>
      </div>
    </section>
  );
}

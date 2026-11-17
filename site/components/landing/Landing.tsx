import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  AudioLines,
  ClipboardCheck,
  ClipboardList,
  Ear,
  FileCheck2,
  MessageSquareText,
  Network,
  PlayCircle,
  Route,
  ShieldAlert,
  Stethoscope,
  TrendingUp,
  UsersRound,
} from "lucide-react";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { HeroCard } from "@/components/landing/HeroCard";
import { ChatChannels } from "@/components/landing/ChatChannels";
import { DemoSection } from "@/components/landing/DemoSection";
import { QueuePreview } from "@/components/landing/QueuePreview";
import { BaselineCompare } from "@/components/landing/BaselineCompare";
import { btn, Eyebrow, SectionHeading } from "@/components/ui";
import type { Lang } from "@/lib/mb";
import { LANDING, type Hl } from "./copy";
import { asset } from "@/lib/asset";

const PILLAR_ICONS = [ClipboardList, TrendingUp, UsersRound, Network];
const STEP_ICONS = [UsersRound, MessageSquareText, ShieldAlert, Route];
const AUDIENCE = [
  { id: "families", icon: Ear },
  { id: "adults", icon: AudioLines },
  { id: "clinicians", icon: Stethoscope },
];
const CLIN_ICONS = [ClipboardCheck, FileCheck2, Route];
const arrow = "rtl:-scale-x-100";

/** A heading with its highlighted phrase in the brand green. */
export function H({ h }: { h: Hl }) {
  return (
    <>
      {h[0]}
      <span className="text-leaf">{h[1]}</span>
      {h[2]}
    </>
  );
}

/** The landing page, in English at / and in Arabic at /ar/. */
export function Landing({ lang }: { lang: Lang }) {
  const t = LANDING[lang];
  const ar = lang === "ar";
  const num = (i: number) => (ar ? "٠" + "١٢٣٤٥٦٧٨٩"[i] : `0${i + 1}`);

  return (
    <div id="top" dir={ar ? "rtl" : "ltr"} lang={lang}>
      <div className="flex items-center justify-center gap-2.5 bg-deep px-4 py-2 text-center text-xs text-white">
        <span className="rounded-full bg-white/15 px-2 py-0.5 text-[11px] font-semibold tracking-wide">{t.banner[0]}</span>
        <span>
          {t.banner[1]}
          <span className="hidden sm:inline">{t.banner[2]}</span>
        </span>
      </div>

      <SiteHeader lang={lang} />

      <main>
        {/* Hero */}
        <section className="relative overflow-hidden bg-gradient-to-b from-[#fbfbfa] to-[#f6f6f4] xl:min-h-[min(51.35vw,825px)]">
          {/* Desktop photo. The photo layer keeps the image's own proportions and covers the box on the far side
              from the text (right in English, left in Arabic), so the card can be placed in the photo's coordinates. */}
          <div aria-hidden className="absolute inset-y-0 end-0 hidden w-[56vw] max-w-[900px] overflow-hidden [container-type:size] xl:block">
            <div className="absolute right-0 top-0 aspect-[844/774] w-[max(100cqw,109.05cqh)]">
              <Image src={asset("/images/hero-family.webp")} alt="" fill priority sizes="900px" className="object-cover" />
            </div>
            <div className="absolute inset-y-0 start-0 w-[24%] bg-gradient-to-r from-[#f9f9f8] via-[#f9f9f8]/60 to-transparent rtl:bg-gradient-to-l" />
          </div>
          <div className="pointer-events-none absolute inset-y-0 end-0 hidden w-[56vw] max-w-[900px] [container-type:size] xl:block">
            <div className="absolute right-0 top-0 aspect-[844/774] w-[max(100cqw,109.05cqh)]">
              <div className="pointer-events-auto absolute left-[13.1%] top-[48.6%] flex min-h-[46.6%] w-[74.2%] flex-col">
                <HeroCard className="flex-1" lang={lang} />
              </div>
            </div>
          </div>

          <div className="relative mx-auto max-w-[1320px] px-4 pb-14 pt-10 sm:px-6 lg:px-8 xl:flex xl:min-h-[min(51.35vw,825px)] xl:items-center xl:py-16">
            <div className="max-w-[600px] xl:max-w-[540px] 2xl:max-w-[600px]">
              <p className="flex items-center gap-4 text-[12.5px] font-semibold uppercase tracking-[0.2em] text-deep">
                {t.heroEyebrow} <span aria-hidden className="h-px w-10 bg-leaf/50" />
              </p>
              <h1 className={`mt-7 font-serif font-semibold tracking-[-0.02em] text-ink ${ar ? "text-[36px] leading-[1.3] sm:text-[52px] xl:text-[54px] 2xl:text-[58px]" : "text-[38px] leading-[1.06] sm:text-[58px] xl:text-[60px] 2xl:text-[66px]"}`}>
                <H h={t.heroTitle} />
              </h1>
              <p className="mt-6 text-[20px] font-medium leading-[1.45] text-ink sm:text-[23px]">{t.heroLead}</p>
              <p className={`mt-5 max-w-[560px] text-[17px] text-body sm:text-[18px] ${ar ? "leading-[1.8]" : "leading-[1.6]"}`}>{t.heroBody}</p>
              <div className="mt-9 flex flex-wrap gap-3.5">
                <Link href={t.concernHref} className="inline-flex items-center gap-2.5 rounded-xl bg-deep px-7 py-4 text-[17px] font-medium text-white shadow-sm transition-colors hover:bg-deep-hover">
                  {t.heroCta} <ArrowRight size={19} className={arrow} />
                </Link>
                <Link href={t.checkinHref} className="inline-flex items-center rounded-xl border border-line bg-white px-7 py-4 text-[17px] font-medium text-ink shadow-sm transition-colors hover:bg-mist">
                  {t.heroCta2}
                </Link>
              </div>
              <div className="mt-7 flex flex-wrap gap-x-10 gap-y-2">
                <Link href={t.heroOther.href} lang={ar ? "en" : "ar"} className="inline-flex items-center gap-2 text-[16.5px] font-medium text-deep underline-offset-4 hover:underline">
                  {t.heroOther.label} <ArrowRight size={17} className={arrow} />
                </Link>
                <Link href="/clinician/" className="inline-flex items-center gap-2 text-[16.5px] font-medium text-deep underline-offset-4 hover:underline">
                  {t.heroClinician} <ArrowRight size={17} className={arrow} />
                </Link>
                <a href="#demo" className="inline-flex items-center gap-2 text-[16.5px] font-medium text-deep underline-offset-4 hover:underline">
                  <PlayCircle size={18} /> {t.heroDemo}
                </a>
              </div>
            </div>

            {/* Phones and tablets: the photo above, the card overlapping it. */}
            <div className="mt-12 xl:hidden">
              <div className="relative overflow-hidden rounded-[22px]">
                <Image src={asset("/images/hero-family-top.webp")} alt={t.heroImageAlt} width={724} height={378} sizes="(max-width: 1280px) 100vw" className="h-auto w-full" />
              </div>
              <div className="relative mx-2 -mt-10 sm:mx-10 sm:-mt-16">
                <HeroCard lang={lang} />
              </div>
            </div>
          </div>
        </section>

        {/* What MemBrain does, at a glance */}
        <section aria-label={t.pillarsLabel} className="border-y border-line bg-[#f6f6f4]">
          <ul className="mx-auto grid max-w-[1320px] gap-6 px-4 py-7 sm:grid-cols-2 sm:px-6 lg:grid-cols-4 lg:gap-0 lg:px-8">
            {t.pillars.map(([title, text], i) => {
              const Icon = PILLAR_ICONS[i];
              return (
                <li key={title} className={`flex items-center gap-4 ${i ? "lg:border-s lg:border-line lg:ps-10" : ""} ${i < 3 ? "lg:pe-6" : ""}`}>
                  <Icon size={30} strokeWidth={1.6} className="shrink-0 text-deep" aria-hidden />
                  <span>
                    <span className="block text-[17px] font-semibold tracking-[-0.01em]">{title}</span>
                    <span className="block text-[14.5px] text-body">{text}</span>
                  </span>
                </li>
              );
            })}
          </ul>
        </section>

        {/* How it works */}
        <section id="how" aria-labelledby="how-title" className="scroll-mt-20 py-14 lg:py-20">
          <div className="mx-auto max-w-[1320px] px-4 sm:px-6 lg:px-8">
            <SectionHeading id="how-title" eyebrow={t.howEyebrow} title={<H h={t.howTitle} />} intro={t.howIntro} />
            <ol className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {t.steps.map(([title, text], i) => {
                const Icon = STEP_ICONS[i];
                return (
                  <li key={title} className="relative rounded-2xl border border-line bg-white p-6">
                    <div className="flex items-center justify-between">
                      <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-mist text-deep">
                        <Icon size={22} strokeWidth={1.9} aria-hidden />
                      </span>
                      <span className="font-mono text-[13px] text-muted">{num(i)}</span>
                    </div>
                    <h3 className="mt-4 text-[19px] font-semibold tracking-tight">{title}</h3>
                    <p className={`mt-1.5 text-[15px] text-body ${ar ? "leading-[1.75]" : "leading-[1.5]"}`}>{text}</p>
                  </li>
                );
              })}
            </ol>
          </div>
        </section>

        <DemoSection lang={lang} />

        {/* Audiences */}
        <section id="families" aria-label={t.audiencesLabel} className="scroll-mt-20 border-t border-line bg-paper py-14 lg:py-20">
          <div className="mx-auto max-w-[1320px] px-4 sm:px-6 lg:px-8">
            <SectionHeading eyebrow={t.audiencesEyebrow} title={t.audiencesTitle} />
            <div className="mt-10 grid gap-4 lg:grid-cols-3">
              {t.audiences.map((a, i) => {
                const Icon = AUDIENCE[i].icon;
                return (
                  <article key={AUDIENCE[i].id} className="flex flex-col rounded-2xl border border-line bg-white p-7">
                    <Icon size={26} strokeWidth={1.8} className="text-leaf" aria-hidden />
                    <Eyebrow className="mt-5">{a.eyebrow}</Eyebrow>
                    <h3 className="mt-2 text-[21px] font-semibold leading-snug tracking-tight">{a.title}</h3>
                    <p className={`mt-2 flex-1 text-[15px] text-body ${ar ? "leading-[1.8]" : "leading-[1.55]"}`}>{a.text}</p>
                    <Link href={a.href} className={`${btn.quiet} mt-5`}>
                      {a.cta} <ArrowRight size={15} className={arrow} />
                    </Link>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        <ChatChannels lang={lang} />

        {/* Clinicians */}
        <section id="clinicians" aria-labelledby="clin-title" className="scroll-mt-20 border-t border-line py-14 lg:py-20">
          <div className="mx-auto grid max-w-[1320px] items-center gap-12 px-4 sm:px-6 lg:grid-cols-[0.9fr_1.1fr] [&>*]:min-w-0">
            <div>
              <SectionHeading id="clin-title" eyebrow={t.clinEyebrow} title={t.clinTitle} intro={t.clinIntro} />
              <ul className="mt-6 space-y-3 text-[15px] text-body">
                {t.clinPoints.map((p, i) => {
                  const I = CLIN_ICONS[i];
                  return (
                    <li key={p} className="flex gap-3">
                      <I size={19} className="mt-0.5 shrink-0 text-leaf" aria-hidden />
                      {p}
                    </li>
                  );
                })}
              </ul>
              <Link href="/clinician/" className={`${btn.primary} mt-8`}>
                {t.clinCta} <ArrowRight size={17} className={arrow} />
              </Link>
            </div>
            {/* The workspace itself is in English; its preview stays in English on both pages. */}
            <div dir="ltr" lang="en">
              <QueuePreview />
            </div>
          </div>
        </section>

        {/* One score can mislead: one-off cut-off vs personal baseline, computed by the engine */}
        <BaselineCompare lang={lang} />

        {/* Evidence */}
        <section id="evidence" aria-labelledby="ev-title" className="scroll-mt-20 border-t border-line bg-mist py-14 lg:py-20">
          <div className="mx-auto max-w-[1320px] px-4 sm:px-6 lg:px-8">
            <SectionHeading id="ev-title" eyebrow={t.evEyebrow} title={t.evTitle} intro={t.evIntro} />
            <div className="mt-10 grid gap-x-8 gap-y-8 sm:grid-cols-2 lg:grid-cols-4">
              {t.evidence.map(([value, label, note], i) => (
                <div key={value} className={i ? "lg:border-s lg:border-mist-strong lg:ps-8" : ""}>
                  <p className="font-serif text-[38px] font-semibold tracking-tight text-deep">{value}</p>
                  <p className="mt-1 text-[14.5px] font-medium leading-snug text-ink">{label}</p>
                  <p className="mt-2 text-[13px] leading-snug text-body">{note}</p>
                </div>
              ))}
            </div>
            <div className="mt-12 grid grid-cols-2 gap-x-6 gap-y-5 border-t border-mist-strong pt-8 lg:grid-cols-[200px_repeat(4,minmax(0,1fr))] lg:gap-8">
              <p className="col-span-2 text-sm leading-snug text-body lg:col-span-1">{t.groundingTitle}</p>
              {t.grounding.map(([name, note]) => (
                <div key={name}>
                  <p className="text-[15px] font-semibold tracking-tight">{name}</p>
                  <p className="text-xs text-muted">{note}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Closing call to action */}
        <section className="bg-deep">
          <div className="mx-auto flex max-w-[1320px] flex-col items-start justify-between gap-6 px-4 py-14 sm:px-6 lg:flex-row lg:items-center">
            <div className="max-w-[620px]">
              <h2 className="font-serif text-[30px] font-semibold leading-tight tracking-[-0.015em] text-white text-balance sm:text-[38px]">{t.closeTitle}</h2>
              <p lang={t.closeEcho.lang} dir={t.closeEcho.lang === "ar" ? "rtl" : "ltr"} className="mt-2 w-fit text-[19px] text-white/80">
                {t.closeEcho.text}
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap gap-3">
              <Link href={t.concernHref} className="inline-flex items-center gap-2 rounded-xl bg-sand px-5 py-3.5 text-[15px] font-semibold text-deep transition-colors hover:bg-[#e8bd7c]">
                {t.closeCta} <ArrowRight size={17} className={arrow} />
              </Link>
              <Link href={t.closeOther.href} lang={t.closeOther.lang} className="inline-flex items-center gap-2 rounded-xl border border-white/25 px-5 py-3.5 text-[15.5px] font-medium text-white transition-colors hover:bg-white/10">
                {t.closeOther.label}
              </Link>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter lang={lang} />
    </div>
  );
}

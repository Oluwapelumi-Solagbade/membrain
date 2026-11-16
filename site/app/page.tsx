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
import { btn, Eyebrow, SectionHeading } from "@/components/ui";

const pillars = [
  { title: "Concern to action", text: "Structured and guided", icon: ClipboardList },
  { title: "Whole-person view", text: "Health, lifestyle and risk factors", icon: TrendingUp },
  { title: "Ongoing monitoring", text: "Track change over time", icon: UsersRound },
  { title: "Connected care", text: "To the right services in the UAE", icon: Network },
];

const grounding = [
  { name: "IQCODE-16", note: "Informant questionnaire" },
  { name: "Lancet Commission 2024", note: "14 modifiable risk factors" },
  { name: "HL7 FHIR R4", note: "Referral and review records" },
  { name: "Emirati speech", note: "Recogniser tuned and measured" },
];

const steps = [
  {
    title: "Notice",
    icon: UsersRound,
    text: "Anyone can raise it: the person, family, a household helper or a doctor. Who raised it stays with the concern, so a family account is never mistaken for the person's own.",
  },
  {
    title: "Describe",
    icon: MessageSquareText,
    text: "Speak or type in your own words. Every fact keeps the exact words it came from, and you can untick anything that is wrong before it goes anywhere.",
  },
  {
    title: "Check",
    icon: ShieldAlert,
    text: "Urgent signs, such as a fall with a head injury or sudden confusion, stop everything and show the emergency steps. A significant concern goes straight to a clinician.",
  },
  {
    title: "Follow through",
    icon: Route,
    text: "The referral is tracked step by step. It only counts as done when the assessment has happened and the follow-up is written down.",
  },
];

const audiences = [
  {
    id: "families",
    eyebrow: "For families",
    title: "You don't need a diagnosis to ask for help",
    text: "Describe what has changed at home: the repeated questions, the bills, the drive that went wrong. MemBrain reads it back to you aloud and tells you what happens next, in plain words.",
    icon: Ear,
    cta: { label: "Raise a concern", href: "/concern/" },
  },
  {
    id: "adults",
    eyebrow: "For adults 50 to 75",
    title: "A six-minute spoken check-in, repeated over time",
    text: "Word lists, a short story and everyday questions, in your own dialect. You are compared with your own earlier results and with people of your age and schooling, so real change shows earlier and fewer people are flagged by mistake.",
    icon: AudioLines,
    cta: { label: "Try the check-in", href: "/prototype/#participant" },
  },
  {
    id: "clinicians",
    eyebrow: "For clinicians",
    title: "One queue, sorted by urgency, with the evidence attached",
    text: "Each case arrives with the concern in the reporter's own words, the drivers behind its level, what is still missing, and a referral draft that only states confirmed facts.",
    icon: Stethoscope,
    cta: { label: "Open the clinician view", href: "/clinician/" },
  },
];

const evidence = [
  { value: "12 of 12", label: "urgent red-flag stories caught in the held-out test set", note: "Too few to prove 99%. About 300 are needed, planned for Phase A." },
  { value: "0 of 50", label: "template referral drafts containing a sentence the checker blocks", note: "The checker rejects any diagnosis word, new number or unconfirmed claim." },
  { value: "41.2%", label: "word error on held-out Emirati speech, down from 49.5%", note: "103 broadcast clips. Older speakers are still to be measured." },
  { value: "0.85", label: "accuracy (F1) picking out what changed, against a 0.90 target", note: "Not met yet. Rules are the fallback while a larger model is evaluated." },
];

export default function HomePage() {
  return (
    <div id="top">
      <div className="flex items-center justify-center gap-2.5 bg-deep px-4 py-2 text-center text-xs text-white">
        <span className="rounded-full bg-white/15 px-2 py-0.5 text-[11px] font-semibold tracking-wide">PROTOTYPE</span>
        <span>All people and records are synthetic.<span className="hidden sm:inline"> MemBrain flags risk and change; it never diagnoses.</span></span>
      </div>

      <SiteHeader />

      <main>
        {/* Hero */}
        <section className="relative overflow-hidden bg-gradient-to-b from-[#fbfbfa] to-[#f6f6f4] xl:min-h-[min(51.35vw,825px)]">
          {/* Desktop photo. The photo layer keeps the image's own proportions and covers the right-hand box, so
              the card can be placed in the photo's coordinates at any width. */}
          <div aria-hidden className="absolute inset-y-0 right-0 hidden w-[56vw] max-w-[900px] overflow-hidden [container-type:size] xl:block">
            <div className="absolute right-0 top-0 aspect-[844/774] w-[max(100cqw,109.05cqh)]">
              <Image src="/images/hero-family.webp" alt="" fill priority sizes="900px" className="object-cover" />
            </div>
            <div className="absolute inset-y-0 left-0 w-[24%] bg-gradient-to-r from-[#f9f9f8] via-[#f9f9f8]/60 to-transparent" />
          </div>
          <div className="pointer-events-none absolute inset-y-0 right-0 hidden w-[56vw] max-w-[900px] [container-type:size] xl:block">
            <div className="absolute right-0 top-0 aspect-[844/774] w-[max(100cqw,109.05cqh)]">
              <div className="pointer-events-auto absolute left-[13.1%] top-[48.6%] flex min-h-[46.6%] w-[74.2%] flex-col">
                <HeroCard className="flex-1" />
              </div>
            </div>
          </div>

          <div className="relative mx-auto max-w-[1320px] px-4 pb-14 pt-10 sm:px-6 lg:px-8 xl:flex xl:min-h-[min(51.35vw,825px)] xl:items-center xl:py-16">
            <div className="max-w-[600px] xl:max-w-[540px] 2xl:max-w-[600px]">
              <p className="flex items-center gap-4 text-[12.5px] font-semibold uppercase tracking-[0.2em] text-deep">
                Brain health navigation · UAE <span aria-hidden className="h-px w-10 bg-leaf/50" />
              </p>
              <h1 className="mt-7 font-serif text-[38px] font-semibold leading-[1.06] tracking-[-0.02em] text-ink sm:text-[58px] xl:text-[60px] 2xl:text-[66px]">
                From “something’s not right” to the <span className="text-leaf">right clinician.</span>
              </h1>
              <p className="mt-6 text-[20px] font-medium leading-[1.4] text-ink sm:text-[23px]">
                Have you noticed a change in your memory, thinking or everyday activities? Start here.
              </p>
              <p className="mt-5 max-w-[560px] text-[17px] leading-[1.6] text-body sm:text-[18px]">
                Describe the change you have noticed, by voice or text, in Gulf Arabic or English. MemBrain checks for urgent warning signs first, turns your words into facts a clinician can act on, and follows the referral until someone is actually seen.
              </p>
              <div className="mt-9 flex flex-wrap gap-3.5">
                <Link href="/concern/" className="inline-flex items-center gap-2.5 rounded-xl bg-deep px-7 py-4 text-[17px] font-medium text-white shadow-sm transition-colors hover:bg-deep-hover">
                  I&apos;ve noticed a change <ArrowRight size={19} />
                </Link>
                <Link href="/prototype/#participant" className="inline-flex items-center rounded-xl border border-line bg-white px-7 py-4 text-[17px] font-medium text-ink shadow-sm transition-colors hover:bg-mist">
                  Check my own brain health
                </Link>
              </div>
              <div className="mt-7 flex flex-wrap gap-x-10 gap-y-2">
                <Link href="/concern/?lang=ar" className="inline-flex items-center gap-2 text-[16.5px] font-medium text-deep underline-offset-4 hover:underline">
                  Start in Arabic <ArrowRight size={17} />
                </Link>
                <Link href="/clinician/" className="inline-flex items-center gap-2 text-[16.5px] font-medium text-deep underline-offset-4 hover:underline">
                  See the clinician view <ArrowRight size={17} />
                </Link>
                <a href="#demo" className="inline-flex items-center gap-2 text-[16.5px] font-medium text-deep underline-offset-4 hover:underline">
                  <PlayCircle size={18} /> Watch the demo
                </a>
              </div>
            </div>

            {/* Phones and tablets: the photo above, the card overlapping it. */}
            <div className="mt-12 xl:hidden">
              <div className="relative overflow-hidden rounded-[22px]">
                <Image src="/images/hero-family-top.webp" alt="An older Emirati man and his daughter looking at a tablet together" width={724} height={378} sizes="(max-width: 1280px) 100vw" className="h-auto w-full" />
              </div>
              <div className="relative mx-2 -mt-10 sm:mx-10 sm:-mt-16">
                <HeroCard />
              </div>
            </div>
          </div>
        </section>

        {/* What MemBrain does, at a glance */}
        <section aria-label="What MemBrain does" className="border-y border-line bg-[#f6f6f4]">
          <ul className="mx-auto grid max-w-[1320px] gap-6 px-4 py-7 sm:grid-cols-2 sm:px-6 lg:grid-cols-4 lg:gap-0 lg:px-8">
            {pillars.map(({ title, text, icon: Icon }, i) => (
              <li key={title} className={`flex items-center gap-4 ${i ? "lg:border-l lg:border-line lg:pl-10" : ""} ${i < 3 ? "lg:pr-6" : ""}`}>
                <Icon size={30} strokeWidth={1.6} className="shrink-0 text-deep" aria-hidden />
                <span>
                  <span className="block text-[17px] font-semibold tracking-[-0.01em]">{title}</span>
                  <span className="block text-[14.5px] text-body">{text}</span>
                </span>
              </li>
            ))}
          </ul>
        </section>

        {/* How it works */}
        <section id="how" aria-labelledby="how-title" className="scroll-mt-20 py-14 lg:py-20">
          <div className="mx-auto max-w-[1320px] px-4 sm:px-6 lg:px-8">
            <SectionHeading
              id="how-title"
              eyebrow="How it works"
              title={
                <>
                  Four steps, and <span className="text-leaf">nobody is left waiting</span> in between
                </>
              }
              intro="Families get lost in the gap between the first worry and a memory assessment. MemBrain makes the first step easy and makes sure the last one happens."
            />
            <ol className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {steps.map(({ title, text, icon: Icon }, i) => (
                <li key={title} className="relative rounded-2xl border border-line bg-white p-6">
                  <div className="flex items-center justify-between">
                    <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-mist text-deep">
                      <Icon size={22} strokeWidth={1.9} aria-hidden />
                    </span>
                    <span className="font-mono text-[13px] text-muted">0{i + 1}</span>
                  </div>
                  <h3 className="mt-4 text-[19px] font-semibold tracking-tight">{title}</h3>
                  <p className="mt-1.5 text-[15px] leading-[1.5] text-body">{text}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <DemoSection />

        {/* Audiences */}
        <section id="families" aria-label="Who it is for" className="scroll-mt-20 border-t border-line bg-paper py-14 lg:py-20">
          <div className="mx-auto max-w-[1320px] px-4 sm:px-6 lg:px-8">
            <SectionHeading eyebrow="Two doors, one loop" title="Start from a worry, or from a routine check-in" />
            <div className="mt-10 grid gap-4 lg:grid-cols-3">
              {audiences.map(({ id, eyebrow, title, text, icon: Icon, cta }) => (
                <article key={id} className="flex flex-col rounded-2xl border border-line bg-white p-7">
                  <Icon size={26} strokeWidth={1.8} className="text-leaf" aria-hidden />
                  <Eyebrow className="mt-5">{eyebrow}</Eyebrow>
                  <h3 className="mt-2 text-[21px] font-semibold leading-snug tracking-tight">{title}</h3>
                  <p className="mt-2 flex-1 text-[15px] leading-[1.55] text-body">{text}</p>
                  <Link href={cta.href} className={`${btn.quiet} mt-5`}>
                    {cta.label} <ArrowRight size={15} />
                  </Link>
                </article>
              ))}
            </div>
          </div>
        </section>

        <ChatChannels />

        {/* Clinicians */}
        <section id="clinicians" aria-labelledby="clin-title" className="scroll-mt-20 border-t border-line py-14 lg:py-20">
          <div className="mx-auto grid max-w-[1320px] items-center gap-12 px-4 sm:px-6 lg:grid-cols-[0.9fr_1.1fr] [&>*]:min-w-0">
            <div>
              <SectionHeading
                id="clin-title"
                eyebrow="For clinicians"
                title="Every alert explains itself"
                intro="Levels come from rules you can read, not a black box. Each person is compared with their own baseline and with norms for their age and schooling, and every level shows the inputs and thresholds behind it."
              />
              <ul className="mt-6 space-y-3 text-[15px] text-body">
                {[
                  [ClipboardCheck, "A review packet with the concern, the evidence and what is still missing"],
                  [FileCheck2, "Referral drafts that state confirmed facts only, checked sentence by sentence"],
                  [Route, "Closed-loop tracking, from sent to attended to follow-up documented"],
                ].map(([Icon, t]) => {
                  const I = Icon as typeof ClipboardCheck;
                  return (
                    <li key={t as string} className="flex gap-3">
                      <I size={19} className="mt-0.5 shrink-0 text-leaf" aria-hidden />
                      {t as string}
                    </li>
                  );
                })}
              </ul>
              <Link href="/clinician/" className={`${btn.primary} mt-8`}>
                Open the clinician view <ArrowRight size={17} />
              </Link>
            </div>
            <QueuePreview />
          </div>
        </section>

        {/* Evidence */}
        <section id="evidence" aria-labelledby="ev-title" className="scroll-mt-20 border-t border-line bg-mist py-14 lg:py-20">
          <div className="mx-auto max-w-[1320px] px-4 sm:px-6 lg:px-8">
            <SectionHeading
              id="ev-title"
              eyebrow="Evidence, honestly"
              title="What we have measured, and what is not proven yet"
              intro="All of these come from synthetic or public data written or gathered by the team. They show the system works as designed. They do not show it works for real families yet; that is what the pilot is for."
            />
            <div className="mt-10 grid gap-x-8 gap-y-8 sm:grid-cols-2 lg:grid-cols-4">
              {evidence.map((e, i) => (
                <div key={e.value} className={i ? "lg:border-l lg:border-mist-strong lg:pl-8" : ""}>
                  <p className="font-serif text-[38px] font-semibold tracking-tight text-deep">{e.value}</p>
                  <p className="mt-1 text-[14.5px] font-medium leading-snug text-ink">{e.label}</p>
                  <p className="mt-2 text-[13px] leading-snug text-body">{e.note}</p>
                </div>
              ))}
            </div>
            <div className="mt-12 grid grid-cols-2 gap-x-6 gap-y-5 border-t border-mist-strong pt-8 lg:grid-cols-[200px_repeat(4,minmax(0,1fr))] lg:gap-8">
              <p className="col-span-2 text-sm leading-snug text-body lg:col-span-1">Built on recognised tools and measured results</p>
              {grounding.map((g) => (
                <div key={g.name}>
                  <p className="text-[15px] font-semibold tracking-tight">{g.name}</p>
                  <p className="text-xs text-muted">{g.note}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Closing call to action */}
        <section className="bg-deep">
          <div className="mx-auto flex max-w-[1320px] flex-col items-start justify-between gap-6 px-4 py-14 sm:px-6 lg:flex-row lg:items-center">
            <div className="max-w-[620px]">
              <h2 className="font-serif text-[30px] font-semibold leading-tight tracking-[-0.015em] text-white text-balance sm:text-[38px]">Worried about someone? Start with what you have noticed.</h2>
              <p lang="ar" dir="rtl" className="mt-2 w-fit text-[19px] text-white/80">
                قلقان على أحد؟ ابدأ باللي لاحظته.
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap gap-3">
              <Link href="/concern/" className="inline-flex items-center gap-2 rounded-xl bg-sand px-5 py-3.5 text-[15px] font-semibold text-deep transition-colors hover:bg-[#e8bd7c]">
                Raise a concern <ArrowRight size={17} />
              </Link>
              <Link href="/concern/?lang=ar" lang="ar" className="inline-flex items-center gap-2 rounded-xl border border-white/25 px-5 py-3.5 text-[15.5px] font-medium text-white transition-colors hover:bg-white/10">
                ابدأ بالعربي
              </Link>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}

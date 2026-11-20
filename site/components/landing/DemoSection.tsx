"use client";

import { useEffect, useRef } from "react";
import { Download, PlayCircle } from "lucide-react";
import type { Lang } from "@/lib/mb";
import { SectionHeading, btn } from "../ui";
import { LANDING } from "./copy";
import { asset } from "@/lib/asset";

// The demo: one real journey recorded from the live site and API on synthetic data (scripts/record-demo.mjs).
// The looping clip is the concern chat at double speed; it stays still for people who ask for less motion.



function LoopClip() {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    const still = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => (still.matches ? v.pause() : v.play().catch(() => undefined));
    apply();
    still.addEventListener("change", apply);
    return () => still.removeEventListener("change", apply);
  }, []);
  return (
    <video
      ref={ref}
      className="block h-auto w-full"
      src={asset("/demo/membrain-chat-loop.mp4")}
      poster={asset("/demo/membrain-chat-loop-poster.jpg")}
      muted
      loop
      playsInline
      preload="metadata"
      aria-label="The concern chat: a family member describes changes in their father, MemBrain picks out the facts with the words they came from, and sets a clinician review within 24 hours"
    />
  );
}

export function DemoSection({ lang = "en" }: { lang?: Lang }) {
  const t = LANDING[lang].demo;
  const play = () => {
    const v = document.getElementById("demo-video") as HTMLVideoElement | null;
    if (!v) return;
    v.scrollIntoView({ behavior: "smooth", block: "center" });
    window.setTimeout(() => v.play().catch(() => undefined), 450);
  };

  return (
    <section id="demo" aria-labelledby="demo-title" className="scroll-mt-20 border-t border-line bg-white py-14 lg:py-20">
      <div className="mx-auto max-w-[1320px] px-4 sm:px-6 lg:px-8">
        <div className="grid items-center gap-12 lg:grid-cols-[1fr_minmax(0,520px)] lg:gap-16">
          <div>
            <SectionHeading
              id="demo-title"
              eyebrow={t.eyebrow}
              title={
                <>
                  {t.title[0]}
                  <span className="text-leaf">{t.title[1]}</span>
                  {t.title[2]}
                </>
              }
              intro={t.inEnglish ? `${t.intro} ${t.inEnglish}` : t.intro}
            />
            <ol className="mt-7 space-y-3">
              {t.steps.map((s, i) => (
                <li key={s} className="flex gap-3.5 text-[15.5px] leading-snug text-body">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-mist font-mono text-[13px] font-medium text-deep">{lang === "ar" ? "١٢٣٤٥٦٧٨٩"[i] : i + 1}</span>
                  <span className="pt-0.5">{s}</span>
                </li>
              ))}
            </ol>
            <div className="mt-8 flex flex-wrap gap-3">
              <button type="button" onClick={play} className={btn.primary}>
                <PlayCircle size={18} /> {t.watch}
              </button>
              <a href={asset("/demo/membrain-chat.gif")} download className={btn.secondary}>
                <Download size={17} /> {t.gif}
              </a>
            </div>
          </div>

          <figure className="mx-auto w-full max-w-[520px]" dir="ltr">
            <div className="overflow-hidden rounded-[22px] border border-black/[0.06] bg-white shadow-[0_32px_70px_-30px_rgb(15_40_30/0.45),0_8px_20px_-10px_rgb(0_0_0/0.12)]">
              <div className="flex items-center gap-2 border-b border-line bg-paper px-4 py-2.5">
                <span className="h-2.5 w-2.5 rounded-full bg-[#e6e4de]" />
                <span className="h-2.5 w-2.5 rounded-full bg-[#e6e4de]" />
                <span className="h-2.5 w-2.5 rounded-full bg-[#e6e4de]" />
                <span className="ms-3 truncate rounded-md bg-white px-3 py-1 font-mono text-[11.5px] text-muted">membrain / raise-a-concern</span>
              </div>
              <LoopClip />
            </div>
            <figcaption className="mt-3 text-center text-[13px] text-muted">{t.loopCaption}</figcaption>
          </figure>
        </div>

        <figure className="mt-14">
          <video
            id="demo-video"
            className="aspect-[1440/900] w-full rounded-[22px] border border-line bg-[#fbfaf7] shadow-[0_24px_60px_-28px_rgb(15_40_30/0.4)]"
            src={asset("/demo/membrain-demo.mp4")}
            poster={asset("/demo/membrain-demo-poster.jpg")}
            controls
            playsInline
            preload="none"
            aria-describedby="demo-video-note"
          >
            <a href={asset("/demo/membrain-demo.mp4")}>Download the demo video (MP4, 12 MB)</a>
          </video>
          <figcaption id="demo-video-note" className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[13.5px] text-muted">
            <span>{t.videoNote}</span>
            <a href={asset("/demo/membrain-demo.mp4")} download className="font-medium text-leaf hover:underline">
              {t.videoDownload}
            </a>
          </figcaption>
        </figure>
      </div>
    </section>
  );
}

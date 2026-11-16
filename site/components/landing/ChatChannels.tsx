"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { ArrowLeft, Camera, ChevronLeft, Mic, MoreVertical, Paperclip, Phone, Smile, Video } from "lucide-react";
import { AndroidPhone, IPhone } from "../Phones";
import { LogoMark } from "../Logo";
import { SectionHeading } from "../ui";

/**
 * "Raise it in the chat apps families already use": a WhatsApp chat in Gulf Arabic on an Android phone and a
 * Telegram chat in English on an iPhone. Both are previews of a planned channel, labelled as such.
 * The facts in the replies are what the rules extractor really picks out of these two messages, and the
 * outcome is what the triage engine decides for them (two activities taken over, so clinician review).
 */

type Msg = { id: string; side: "in" | "out"; time: string; body: ReactNode; media?: boolean };

/* ── WhatsApp, Gulf Arabic ─────────────────────────────────── */

const waMessages: Msg[] = [
  { id: "w1", side: "out", time: "٨:١٢ م", body: <VoiceNote seconds={14} />, media: true },
  {
    id: "w2",
    side: "in",
    time: "٨:١٢ م",
    body: <>سمعت: «أبوي من سنة تقريبا صار ينسى المواعيد ويعيد نفس السالفة. أخوي الحين يسوق عنه بعد ما ضاع في الطريق، وأخوي بعد صار يدفع فواتيره.»</>,
  },
  {
    id: "w3",
    side: "in",
    time: "٨:١٢ م",
    body: (
      <>
        <b>هذا اللي فهمته:</b>
        <br />• الذاكرة: «ينسى»، «يعيد نفس»
        <br />• الأنشطة اليومية: «يسوق»
        <br />• من سنة أو أكثر
        <br />• أخوك الحين يسوق عنه ويدفع الفواتير
        <br />
        <br />ما فيه علامات عاجلة. صح كذا؟
      </>
    ),
  },
  { id: "w4", side: "out", time: "٨:١٣ م", body: "إيه صح" },
  {
    id: "w5",
    side: "in",
    time: "٨:١٣ م",
    body: <>شكرًا لك. لأن أخوك صار يسوي عنه شيئين، بنرسل الحالة لطبيب يراجعها خلال ٢١ يوم، بدون ما ننتظر أي فحص. الطبيب هو اللي يقرر.</>,
  },
];

function WaTail({ side, fill }: { side: "in" | "out"; fill: string }) {
  // Right-to-left chat: incoming bubbles sit on the right, so their tail points right.
  return (
    <svg aria-hidden viewBox="0 0 8 13" className={`absolute top-0 h-[13px] w-[8px] ${side === "in" ? "-right-[8px] -scale-x-100" : "-left-[8px]"}`}>
      <path d="M8 0v13L.8 3.3C-.3 1.8.3 0 2.2 0Z" fill={fill} />
    </svg>
  );
}

function WaTicks() {
  return (
    <svg aria-hidden viewBox="0 0 16 11" className="h-[11px] w-[16px] text-[#53bdeb]" fill="currentColor">
      <path d="M11.07.65a.46.46 0 0 0-.32-.15.45.45 0 0 0-.34.13L4.63 7.71 2.32 5.52a.46.46 0 0 0-.64.02l-.33.33a.45.45 0 0 0 .01.64l2.98 2.84c.18.17.46.17.64 0L11.4 1.6a.45.45 0 0 0 .03-.63ZM15.07.65a.46.46 0 0 0-.32-.15.45.45 0 0 0-.34.13L8.63 7.71l-.57-.54-.66.81 1.05 1c.18.17.46.17.64 0L15.4 1.6a.45.45 0 0 0 .03-.63Z" />
    </svg>
  );
}

function WhatsAppChat({ shown, typing }: { shown: number; typing: boolean }) {
  const list = waMessages.slice(0, shown);
  return (
    <div className="flex h-full flex-col text-[14px] leading-[1.5] text-[#111b21]" dir="rtl" lang="ar">
      <div className="flex items-center gap-1.5 bg-[#008069] px-1.5 pb-2 pt-1 text-white">
        <ArrowLeft size={21} className="-scale-x-100" />
        <LogoMark round className="h-9 w-9" />
        <div className="ms-0.5 min-w-0 flex-1">
          <p className="text-[15.5px] font-medium leading-tight">MemBrain</p>
          <p className="truncate text-[12.5px] leading-tight text-white/85">{typing ? "يكتب…" : "متصل"}</p>
        </div>
        <Video size={21} className="mx-1.5" />
        <Phone size={19} className="mx-1" />
        <MoreVertical size={20} />
      </div>

      <div className="mb-wa-wallpaper relative flex min-h-0 flex-1 flex-col justify-end overflow-hidden px-2.5 pb-1.5 pt-2">
        <p className="mx-auto mb-2 max-w-[94%] rounded-[7px] bg-[#ffeecd] px-2.5 py-[5px] text-center text-[11.5px] leading-snug text-[#54656f]">
          الرسائل مشفّرة. MemBrain ما يشخّص، والطبيب يأكد كل معلومة.
        </p>
        {list.map((m, i) => {
          const first = list[i - 1]?.side !== m.side;
          const out = m.side === "out";
          const fill = out ? "#d9fdd3" : "#ffffff";
          return (
            <div key={m.id} className={`mb-msg-in flex ${out ? "justify-end" : "justify-start"} ${first ? "mt-2" : "mt-[2px]"}`}>
              <div
                className={`relative max-w-[86%] rounded-[7.5px] px-[8px] pb-[5px] pt-[5px] shadow-[0_1px_0.5px_rgb(11_20_26/0.13)] ${first ? (out ? "rounded-tl-none" : "rounded-tr-none") : ""}`}
                style={{ background: fill }}
              >
                {m.body}
                <span className="float-left me-2.5 mt-[6px] inline-flex translate-y-[3px] items-center gap-[3px] text-[11px] text-[#667781]" dir="ltr">
                  {out && <WaTicks />}
                  {m.time}
                </span>
                {first && <WaTail side={m.side} fill={fill} />}
              </div>
            </div>
          );
        })}
        {typing && (
          <div className="mb-msg-in mt-2 flex justify-start" aria-hidden>
            <span className="relative flex gap-1 rounded-[7.5px] rounded-tr-none bg-white px-3.5 py-3 shadow-[0_1px_0.5px_rgb(11_20_26/0.13)]">
              <Dots />
              <WaTail side="in" fill="#ffffff" />
            </span>
          </div>
        )}
      </div>

      <div className="flex items-center gap-1.5 bg-[#efeae2] px-1.5 pb-1.5 pt-1">
        <span className="flex flex-1 items-center gap-2.5 rounded-full bg-white py-[9px] pe-3.5 ps-3 text-[15px] text-[#8696a0] shadow-[0_1px_0.5px_rgb(11_20_26/0.13)]">
          <Smile size={22} strokeWidth={1.8} />
          <span className="flex-1">مراسلة</span>
          <Paperclip size={20} strokeWidth={1.8} className="-rotate-45" />
          <Camera size={21} strokeWidth={1.8} />
        </span>
        <span className="flex h-[46px] w-[46px] items-center justify-center rounded-full bg-[#00a884] text-white shadow-sm">
          <Mic size={21} />
        </span>
      </div>
    </div>
  );
}

/* ── Telegram, English ─────────────────────────────────────── */

const tgMessages: Msg[] = [
  {
    id: "t1",
    side: "out",
    time: "19:02",
    body: "For about a year Dad keeps asking the same questions. My brother drives him everywhere now since he got lost coming home from the mosque, and my brother handles his bills too.",
  },
  {
    id: "t2",
    side: "in",
    time: "19:02",
    body: (
      <>
        <b>Here is what I picked out.</b> Tell me if anything is wrong.
        <br />
        <br />— Memory: “same questions”
        <br />— Getting lost: “got lost”
        <br />— Money and planning: “bills”
        <br />— For a year or more
        <br />— Your brother now drives him and handles his bills
        <br />
        <br />No urgent warning signs.
      </>
    ),
  },
  { id: "t3", side: "out", time: "19:03", body: "That's right" },
  {
    id: "t4",
    side: "in",
    time: "19:03",
    body: (
      <>
        Thank you. Two everyday activities are now done by someone else, so a clinician will review this within <b>21 days</b>, without waiting for any test. MemBrain does not diagnose.
      </>
    ),
  },
];

const tgKeyboard = ["Add more detail", "Read it back to me", "Talk to a person", "العربية"];

function TgTail({ side, fill }: { side: "in" | "out"; fill: string }) {
  return (
    <svg aria-hidden viewBox="0 0 12 18" className={`absolute bottom-0 h-[18px] w-[12px] ${side === "in" ? "-left-[5px]" : "-right-[5px] -scale-x-100"}`}>
      <path d="M12 0v18H1.2C.4 18 0 17 .7 16.4 4.6 13 6 9 6.4 0Z" fill={fill} />
    </svg>
  );
}

function TgTicks() {
  return (
    <svg aria-hidden viewBox="0 0 19 11" className="h-[10px] w-[17px]" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="m1 6 3.4 3.4L11.6 1.6M8.6 8.9l.5.5 7.3-7.8" />
    </svg>
  );
}

function TelegramChat({ shown, typing }: { shown: number; typing: boolean }) {
  const list = tgMessages.slice(0, shown);
  return (
    <div className="flex h-full flex-col text-[14px] leading-[1.36] text-black" lang="en">
      <div className="relative z-10 flex items-center gap-1.5 border-b border-black/[0.08] bg-[#f6f6f6]/[0.94] px-2 pb-1.5 pt-1 backdrop-blur">
        <span className="flex w-[74px] items-center text-[#007aff]">
          <ChevronLeft size={26} strokeWidth={2.4} className="-ml-1" />
          <span className="-ml-1 rounded-full bg-[#007aff] px-[6px] text-[12.5px] font-semibold leading-[18px] text-white">3</span>
        </span>
        <div className="flex-1 text-center">
          <p className="text-[15.5px] font-semibold leading-tight tracking-[-0.01em]">MemBrain</p>
          <p className="text-[12.5px] leading-tight text-[#8e8e93]">{typing ? <span className="text-[#007aff]">typing…</span> : "bot"}</p>
        </div>
        <span className="flex w-[74px] justify-end">
          <LogoMark round className="h-9 w-9" />
        </span>
      </div>

      <div className="mb-tg-wallpaper relative flex min-h-0 flex-1 flex-col justify-end overflow-hidden px-2 pb-1.5 pt-2">
        <p className="mx-auto mb-2 rounded-full bg-[#4f7b6c]/40 px-2.5 py-[2px] text-[12.5px] font-semibold text-white">Today</p>
        {list.map((m, i) => {
          const last = list[i + 1]?.side !== m.side;
          const out = m.side === "out";
          const fill = out ? "#e1fec6" : "#ffffff";
          return (
            <div key={m.id} className={`mb-msg-in flex ${out ? "justify-end pr-[5px]" : "justify-start pl-[5px]"} ${last ? "mb-2" : "mb-[3px]"}`}>
              <div
                className={`relative max-w-[86%] rounded-[17px] px-[9px] pb-[5px] pt-[5px] ${last ? (out ? "rounded-br-[5px]" : "rounded-bl-[5px]") : ""}`}
                style={{ background: fill }}
              >
                {m.body}
                <span className={`float-right ml-2.5 mt-[5px] inline-flex translate-y-[3px] items-center gap-[3px] text-[11px] ${out ? "text-[#3db84a]" : "text-[#a3a8ad]"}`}>
                  {m.time}
                  {out && <TgTicks />}
                </span>
                {last && <TgTail side={m.side} fill={fill} />}
              </div>
            </div>
          );
        })}
        {typing && (
          <div className="mb-msg-in mb-2 flex justify-start pl-[5px]" aria-hidden>
            <span className="relative flex gap-1 rounded-[17px] rounded-bl-[5px] bg-white px-3.5 py-3">
              <Dots />
              <TgTail side="in" fill="#ffffff" />
            </span>
          </div>
        )}
      </div>

      <div className="border-t border-black/[0.08] bg-[#f6f6f6] px-2 pt-1.5">
        <div className="flex items-center gap-2 pb-1.5">
          <Paperclip size={22} strokeWidth={1.7} className="-rotate-45 text-[#8e8e93]" />
          <span className="flex flex-1 items-center rounded-full border border-black/[0.12] bg-white py-[5px] pl-3 pr-1.5 text-[15px] text-[#c4c4c6]">Message</span>
          <Mic size={22} strokeWidth={1.7} className="text-[#8e8e93]" />
        </div>
        <div className="-mx-2 grid grid-cols-2 gap-[5px] bg-[#d1d3d9] px-[5px] pb-1.5 pt-[5px]">
          {tgKeyboard.map((k) => (
            <span key={k} className="truncate rounded-[7px] bg-white px-1 py-[7px] text-center text-[12.5px] shadow-[0_1px_0_rgb(0_0_0/0.3)]">
              {k}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ── Shared parts ──────────────────────────────────────────── */

function VoiceNote({ seconds }: { seconds: number }) {
  const bars = [3, 7, 12, 6, 10, 16, 9, 5, 13, 10, 4, 12, 15, 7, 3, 9, 13, 5, 8, 4, 6, 10, 5];
  return (
    <div className="flex w-[200px] items-center gap-2" dir="ltr">
      <svg viewBox="0 0 24 24" className="h-7 w-7 shrink-0 text-[#8696a0]" fill="currentColor" aria-hidden>
        <path d="M8 5.5v13l10.5-6.5Z" />
      </svg>
      <span className="flex flex-1 flex-col">
        <span className="relative flex h-[22px] items-center gap-[2px]" aria-hidden>
          <span className="absolute left-0 h-3 w-3 rounded-full bg-[#53bdeb]" />
          {bars.map((h, i) => (
            <span key={i} className="w-[2.5px] rounded-full bg-[#b0bcc1]" style={{ height: h }} />
          ))}
        </span>
        <span className="text-[11px] text-[#667781]">0:{String(seconds).padStart(2, "0")}</span>
      </span>
      <span className="relative shrink-0">
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#dfe5e7] text-[#8696a0]">
          <svg viewBox="0 0 24 24" className="h-7 w-7" fill="currentColor" aria-hidden>
            <circle cx="12" cy="8.5" r="4" />
            <path d="M4 20c0-4 3.6-6.5 8-6.5s8 2.5 8 6.5Z" />
          </svg>
        </span>
        <Mic size={13} className="absolute -bottom-0.5 -right-1 text-[#53bdeb]" fill="currentColor" />
      </span>
    </div>
  );
}

function Dots() {
  return (
    <>
      <span className="mb-dot h-[7px] w-[7px] rounded-full bg-[#9aa3a8]" />
      <span className="mb-dot h-[7px] w-[7px] rounded-full bg-[#9aa3a8] [animation-delay:150ms]" />
      <span className="mb-dot h-[7px] w-[7px] rounded-full bg-[#9aa3a8] [animation-delay:300ms]" />
    </>
  );
}

/** Plays a chat once when it scrolls into view, with a typing indicator before each reply. */
function useChatPlayback(total: number, isReply: (index: number) => boolean) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(total);
  const [typing, setTyping] = useState(false);
  const [start, setStart] = useState(false);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const node = ref.current;
    if (!node) return;
    const box = node.getBoundingClientRect();
    if (box.top < window.innerHeight && box.bottom > 0) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setStart(true);
          observer.disconnect();
        }
      },
      { threshold: 0.2 },
    );
    observer.observe(node);
    const hide = window.setTimeout(() => setShown(1), 0);
    return () => {
      observer.disconnect();
      window.clearTimeout(hide);
    };
  }, []);

  useEffect(() => {
    if (!start || shown >= total) return;
    const timers: number[] = [];
    if (isReply(shown)) {
      timers.push(window.setTimeout(() => setTyping(true), 500));
      timers.push(window.setTimeout(() => { setTyping(false); setShown((n) => n + 1); }, 1800));
    } else {
      timers.push(window.setTimeout(() => setShown((n) => n + 1), 1300));
    }
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, [start, shown, total, isReply]);

  return { ref, shown, typing };
}

const waIsReply = (i: number) => waMessages[i]?.side === "in";
const tgIsReply = (i: number) => tgMessages[i]?.side === "in";

function WhatsAppIcon({ size = 16 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden fill="currentColor">
      <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38a9.9 9.9 0 0 0 4.74 1.2h.01c5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0 0 12.04 2Zm4.52 11.99c-.25-.12-1.47-.72-1.69-.81-.23-.08-.39-.12-.56.13-.17.25-.64.81-.78.97-.14.17-.29.19-.54.06-.25-.12-1.05-.39-1.99-1.23-.74-.66-1.23-1.47-1.38-1.72-.14-.25-.02-.38.11-.51.11-.11.25-.29.37-.43.13-.15.17-.25.25-.42.08-.17.04-.31-.02-.43-.06-.12-.56-1.34-.76-1.84-.2-.48-.41-.42-.56-.43h-.48c-.17 0-.43.06-.66.31-.23.25-.86.85-.86 2.07 0 1.22.89 2.4 1.01 2.56.12.17 1.75 2.67 4.23 3.74.59.26 1.05.41 1.41.52.59.19 1.13.16 1.56.1.48-.07 1.47-.6 1.67-1.18.21-.58.21-1.07.14-1.18-.06-.1-.22-.16-.47-.28Z" />
    </svg>
  );
}

function TelegramIcon({ size = 15 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden fill="currentColor">
      <path d="M9.04 15.28 8.7 19.6c.48 0 .69-.21.94-.46l2.26-2.16 4.68 3.43c.86.47 1.47.22 1.7-.79l3.08-14.43c.28-1.27-.46-1.77-1.3-1.46L1.95 10.7c-1.24.48-1.22 1.17-.21 1.48l4.62 1.44L17.1 6.9c.5-.33.96-.15.58.18" />
    </svg>
  );
}

export function ChatChannels() {
  const { ref: waRef, shown: waShown, typing: waTyping } = useChatPlayback(waMessages.length, waIsReply);
  const { ref: tgRef, shown: tgShown, typing: tgTyping } = useChatPlayback(tgMessages.length, tgIsReply);

  return (
    <section id="chat" aria-labelledby="chat-title" className="scroll-mt-20 overflow-hidden border-t border-line bg-paper py-14 lg:py-20">
      <div className="mx-auto max-w-[1320px] px-4 sm:px-6">
        <SectionHeading
          id="chat-title"
          eyebrow="No app needed"
          title={
            <>
              Raise it where families already talk: <span className="text-leaf">WhatsApp and Telegram</span>
            </>
          }
          intro="Send a voice note or a message in Gulf Arabic or English. MemBrain reads back what it understood, with the words each fact came from, and tells you what happens next. It never gives a diagnosis."
        />

        <div className="mt-12 grid gap-14 md:grid-cols-2 md:gap-8 lg:gap-14">
          <div className="flex flex-col items-center">
            <div ref={waRef} className="w-full">
              <AndroidPhone label="A WhatsApp chat in Gulf Arabic: a daughter's voice note about her father, the facts MemBrain picked out, and the next step">
                <WhatsAppChat shown={waShown} typing={waTyping} />
              </AndroidPhone>
            </div>
            <div className="mt-6 w-full max-w-[360px] text-center">
              <p className="flex items-center justify-center gap-2 text-[17px] font-semibold tracking-tight">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#25d366] text-white">
                  <WhatsAppIcon />
                </span>
                WhatsApp, in Gulf Arabic
              </p>
              <p className="mt-1.5 text-[14px] leading-snug text-body">The app most families in the UAE already have open. A voice note is enough.</p>
            </div>
          </div>

          <div className="flex flex-col items-center">
            <div ref={tgRef} className="w-full">
              <IPhone label="A Telegram chat in English: a son describes his father's changes, MemBrain lists the facts with quotes, and explains the clinician review">
                <TelegramChat shown={tgShown} typing={tgTyping} />
              </IPhone>
            </div>
            <div className="mt-6 w-full max-w-[360px] text-center">
              <p className="flex items-center justify-center gap-2 text-[17px] font-semibold tracking-tight">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#229ed9] text-white">
                  <TelegramIcon />
                </span>
                Telegram, in English
              </p>
              <p className="mt-1.5 text-[14px] leading-snug text-body">For expatriate families and carers. The same checks, the same clinician queue.</p>
            </div>
          </div>
        </div>
        <p className="mt-10 text-center text-[13px] text-muted">
          Both channels are planned for the pilot and shown here as previews. The facts and the outcome are the engine&apos;s real output for these two messages.
        </p>
      </div>
    </section>
  );
}

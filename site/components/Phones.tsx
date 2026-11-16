import type { CSSProperties, ReactNode } from "react";

/* Phone frames for the landing-page previews, adapted from the KlimateX landing page. */

export const IOS_FONT: CSSProperties = { fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", system-ui, sans-serif' };
export const ANDROID_FONT: CSSProperties = { fontFamily: 'Roboto, "Google Sans", "Segoe UI", system-ui, sans-serif' };

function SignalBars({ className = "" }: { className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 18 12" className={className} fill="currentColor">
      <rect x="0" y="8" width="3" height="4" rx="0.8" />
      <rect x="5" y="5.5" width="3" height="6.5" rx="0.8" />
      <rect x="10" y="3" width="3" height="9" rx="0.8" />
      <rect x="15" y="0" width="3" height="12" rx="0.8" />
    </svg>
  );
}

function Wifi({ className = "" }: { className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 16 12" className={className} fill="currentColor">
      <path d="M8 2.2c2.3 0 4.4.9 6 2.4l1.2-1.3A10.4 10.4 0 0 0 8 .4 10.4 10.4 0 0 0 .8 3.3L2 4.6a8.6 8.6 0 0 1 6-2.4Zm0 3.6c1.3 0 2.6.5 3.5 1.4l1.2-1.3A6.8 6.8 0 0 0 8 4 6.8 6.8 0 0 0 3.3 5.9l1.2 1.3c.9-.9 2.2-1.4 3.5-1.4Zm0 3.4c.4 0 .8.2 1.1.4L8 11.8 6.9 9.6c.3-.2.7-.4 1.1-.4Z" />
    </svg>
  );
}

const PHONE_SHADOW = "shadow-[0_34px_70px_-26px_rgb(15_63_44/0.55),0_8px_18px_-8px_rgb(0_0_0/0.25)]";

/** An iPhone: titanium edge, Dynamic Island, iOS status bar and home indicator. */
export function IPhone({ children, label, bar = "#f6f6f6", footer = "#ffffff" }: { children: ReactNode; label: string; bar?: string; footer?: string }) {
  return (
    <div role="img" aria-label={label} className="relative mx-auto w-full max-w-[318px]">
      <span aria-hidden className="absolute -left-[3px] top-[96px] h-[26px] w-[3px] rounded-l-sm bg-[#8b8f8e]" />
      <span aria-hidden className="absolute -left-[3px] top-[140px] h-[52px] w-[3px] rounded-l-sm bg-[#8b8f8e]" />
      <span aria-hidden className="absolute -left-[3px] top-[202px] h-[52px] w-[3px] rounded-l-sm bg-[#8b8f8e]" />
      <span aria-hidden className="absolute -right-[3px] top-[160px] h-[80px] w-[3px] rounded-r-sm bg-[#8b8f8e]" />
      <div className={`aspect-[9/19.3] rounded-[3rem] bg-gradient-to-br from-[#b9bdbc] via-[#7d8281] to-[#c9cccb] p-[3px] ${PHONE_SHADOW}`}>
        <div className="h-full rounded-[2.85rem] bg-black p-[9px]">
          <div className="relative flex h-full w-full flex-col overflow-hidden rounded-[2.3rem] bg-white" style={IOS_FONT}>
            <div className="relative flex h-[38px] shrink-0 items-center justify-between px-7 pt-1.5 text-[14px] font-semibold text-black" style={{ background: bar }} dir="ltr">
              <span className="tracking-[-0.01em]">9:41</span>
              <span aria-hidden className="absolute left-1/2 top-[9px] h-[24px] w-[84px] -translate-x-1/2 rounded-full bg-black" />
              <span className="flex items-center gap-[5px]">
                <SignalBars className="h-[11px] w-[17px]" />
                <Wifi className="h-[11px] w-[15px]" />
                <span aria-hidden className="relative flex h-[12px] w-[25px] items-center rounded-[4px] border border-black/40 p-[1.5px]">
                  <span className="h-full w-[78%] rounded-[2px] bg-black" />
                  <span className="absolute -right-[3.5px] top-1/2 h-[4px] w-[1.5px] -translate-y-1/2 rounded-r bg-black/40" />
                </span>
              </span>
            </div>
            <div className="min-h-0 flex-1">{children}</div>
            <div className="flex h-[22px] shrink-0 items-center justify-center" style={{ background: footer }}>
              <span aria-hidden className="h-[5px] w-[118px] rounded-full bg-black" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/** An Android phone: flat black frame, punch-hole camera, status bar tinted by the app, gesture bar. */
export function AndroidPhone({ children, label, bar = "#008069" }: { children: ReactNode; label: string; bar?: string }) {
  return (
    <div role="img" aria-label={label} className="relative mx-auto w-full max-w-[318px]">
      <span aria-hidden className="absolute -right-[3px] top-[118px] h-[46px] w-[3px] rounded-r-sm bg-[#3a3f42]" />
      <span aria-hidden className="absolute -right-[3px] top-[180px] h-[84px] w-[3px] rounded-r-sm bg-[#3a3f42]" />
      <div className={`aspect-[9/19.3] rounded-[2.6rem] bg-gradient-to-b from-[#3d4346] to-[#202426] p-[3px] ${PHONE_SHADOW}`}>
        <div className="h-full rounded-[2.45rem] bg-black p-[8px]">
          <div className="relative flex h-full w-full flex-col overflow-hidden rounded-[2.05rem] bg-[#efeae2]" style={ANDROID_FONT}>
            <div className="relative flex h-[32px] shrink-0 items-center justify-between px-5 text-[13px] font-medium text-white" style={{ background: bar }} dir="ltr">
              <span>9:41</span>
              <span aria-hidden className="absolute left-1/2 top-[8px] h-[14px] w-[14px] -translate-x-1/2 rounded-full bg-black ring-[1.5px] ring-[#1d2b33]" />
              <span className="flex items-center gap-[5px]">
                <Wifi className="h-[11px] w-[14px]" />
                <SignalBars className="h-[11px] w-[15px]" />
                <span className="text-[12px]">78%</span>
              </span>
            </div>
            <div className="min-h-0 flex-1">{children}</div>
            <div className="flex h-[18px] shrink-0 items-center justify-center bg-[#efeae2]">
              <span aria-hidden className="h-[4px] w-[96px] rounded-full bg-[#1f2c34]/80" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

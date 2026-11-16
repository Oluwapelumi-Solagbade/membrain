import Image from "next/image";
import { asset } from "@/lib/asset";

// The MemBrain logo, from the supplied artwork (public/brand/, generated at 1557 px wide so it stays sharp
// on high-density screens). Original colours on light backgrounds; the white version on dark ones.
const LOGO = { w: 1557, h: 312 };
const MARK = { w: 355, h: 312 };

/** The mark as an app icon (chat avatars, phone previews): the white mark on a brand-green tile. */
export function LogoMark({ className = "h-8 w-8", inverted = false, round = false }: { className?: string; inverted?: boolean; round?: boolean }) {
  return (
    <span aria-hidden className={`inline-flex shrink-0 items-center justify-center ${round ? "rounded-full" : "rounded-[28%]"} ${inverted ? "bg-white" : "bg-deep"} ${className}`}>
      <Image
        src={inverted ? asset("/brand/membrain-mark.png") : asset("/brand/membrain-mark-white.png")}
        alt=""
        width={MARK.w}
        height={MARK.h}
        className="h-auto w-[64%]"
      />
    </span>
  );
}

/** The full logo: mark and wordmark. */
export function Logo({ inverted = false, className = "", size = "md", priority = false }: { inverted?: boolean; className?: string; size?: "sm" | "md" | "lg"; priority?: boolean }) {
  const h = size === "lg" ? "h-[34px]" : size === "md" ? "h-7" : "h-6";
  return (
    <Image
      src={inverted ? asset("/brand/membrain-logo-white.png") : asset("/brand/membrain-logo.png")}
      alt="MemBrain"
      width={LOGO.w}
      height={LOGO.h}
      priority={priority}
      className={`${h} w-auto ${className}`}
    />
  );
}

/** The mark alone, in its original colours, for light backgrounds (app headers). */
export function Mark({ className = "h-8 w-auto" }: { className?: string }) {
  return <Image src={asset("/brand/membrain-mark.png")} alt="" aria-hidden width={MARK.w} height={MARK.h} className={className} />;
}

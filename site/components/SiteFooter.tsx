import Link from "next/link";
import { Logo } from "./Logo";

export function SiteFooter() {
  return (
    <footer className="border-t border-white/10 bg-[#0b3324] text-white/70">
      <div className="mx-auto flex max-w-[1320px] flex-col gap-5 px-4 py-9 text-sm sm:px-6 md:flex-row md:items-center md:justify-between">
        <Logo inverted />
        <nav aria-label="Footer" className="flex flex-wrap gap-x-6 gap-y-2">
          <Link href="/concern/" className="hover:text-white">Raise a concern</Link>
          <Link href="/clinician/" className="hover:text-white">Clinician view</Link>
          <a href="/prototype/" className="hover:text-white">Full prototype</a>
          <Link href="/#evidence" className="hover:text-white">Evidence</Link>
        </nav>
        <p className="max-w-[340px] text-xs leading-relaxed">
          Prototype for the Future Health Digital Innovation Challenge. Synthetic data only. Not a medical device; in an emergency call 998.
        </p>
      </div>
    </footer>
  );
}

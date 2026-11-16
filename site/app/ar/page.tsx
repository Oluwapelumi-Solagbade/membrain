import type { Metadata } from "next";
import { Landing } from "@/components/landing/Landing";

export const metadata: Metadata = {
  title: "MemBrain | من أول قلق إلى الطبيب المناسب",
  description: "صِف التغيّر في الذاكرة أو التفكير بالعربية أو بالإنجليزية. يتحقّق MemBrain من العلامات العاجلة أولًا، ويراجع الطبيب كل حالة. لا يشخّص أبدًا.",
  alternates: { languages: { en: "/", ar: "/ar/" } },
};

export default function ArabicHomePage() {
  return <Landing lang="ar" />;
}

import type { Metadata } from "next";
import { ReportsView } from "@/components/clinician/programme/ReportsView";

export const metadata: Metadata = {
  title: "Reports | MemBrain",
  description: "Whether the referral loop closes: completion, timing and equity across groups.",
};

export default function ReportsPage() {
  return <ReportsView />;
}

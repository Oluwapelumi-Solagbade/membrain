import type { Metadata } from "next";
import { LiveView } from "@/components/clinician/programme/LiveView";

export const metadata: Metadata = {
  title: "Live data | MemBrain",
  description: "Concerns, check-ins and clinician decisions made in the demo, saved and analysed as they happen.",
};

export default function LivePage() {
  return <LiveView />;
}

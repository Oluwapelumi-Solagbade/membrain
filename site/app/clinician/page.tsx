import type { Metadata } from "next";
import { QueueView } from "@/components/clinician/QueueView";

export const metadata: Metadata = {
  title: "Review queue | MemBrain",
  description: "The clinician review queue: every case sorted by urgency, with the reasons and thresholds behind its level.",
};

export default function ClinicianPage() {
  return <QueueView />;
}

import type { Metadata } from "next";
import { CohortsView } from "@/components/clinician/programme/CohortsView";

export const metadata: Metadata = {
  title: "Cohorts | MemBrain",
  description: "Everyone in the programme and every concern raised, with where each person stands.",
};

export default function CohortsPage() {
  return <CohortsView />;
}

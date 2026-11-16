import type { Metadata } from "next";
import { ValidationView } from "@/components/clinician/programme/ValidationView";

export const metadata: Metadata = {
  title: "Validation | MemBrain",
  description: "What has been measured: the simulated cohort, the concern extractor's release gates and speech recognition.",
};

export default function ValidationPage() {
  return <ValidationView />;
}

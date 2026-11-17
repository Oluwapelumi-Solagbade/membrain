import type { Metadata } from "next";
import { Suspense } from "react";
import { SouqRoute } from "@/components/checkin/SouqRoute";

export const metadata: Metadata = {
  title: "Souq route | MemBrain",
  description: "An exploratory two-minute route-memory task in a market scene. Shown to the clinician; not used for triage.",
};

export default function SouqRoutePage() {
  return (
    <Suspense fallback={<div className="h-dvh bg-paper" />}>
      <SouqRoute />
    </Suspense>
  );
}

import type { Metadata } from "next";
import { Suspense } from "react";
import { Questionnaire } from "@/components/informant/Questionnaire";

export const metadata: Metadata = {
  title: "Family questionnaire | MemBrain",
  description: "Ten short questions for a family member about everyday activities, asked again at each follow-up. A screening step, never a diagnosis.",
};

export default function InformantPage() {
  return (
    <Suspense fallback={<div className="h-dvh bg-paper" />}>
      <Questionnaire />
    </Suspense>
  );
}

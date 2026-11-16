import type { Metadata } from "next";
import { Suspense } from "react";
import { CaseView } from "@/components/clinician/case/CaseView";
import { Loading } from "@/components/clinician/parts";

export const metadata: Metadata = {
  title: "Case | MemBrain",
  description: "One case in full: why it has its level, the scores behind it, the concern, prevention, referrals and activity.",
};

export default function CasePage() {
  return (
    <Suspense fallback={<Loading label="Loading the case" />}>
      <CaseView />
    </Suspense>
  );
}

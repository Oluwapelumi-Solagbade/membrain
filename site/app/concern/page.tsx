import type { Metadata } from "next";
import { Suspense } from "react";
import { ConcernChat } from "@/components/concern/ConcernChat";

export const metadata: Metadata = {
  title: "Raise a concern | MemBrain",
  description: "Describe a change in memory or thinking, in Gulf Arabic or English. Urgent signs are checked first and a clinician reviews every case.",
};

export default function ConcernPage() {
  return (
    <Suspense fallback={<div className="h-dvh bg-paper" />}>
      <ConcernChat />
    </Suspense>
  );
}

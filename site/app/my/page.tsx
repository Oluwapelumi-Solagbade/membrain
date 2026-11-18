import type { Metadata } from "next";
import { Suspense } from "react";
import { NextStep } from "@/components/NextStep";

export const metadata: Metadata = { title: "Your next step | MemBrain", description: "The next step your clinician approved, and your referral's progress." };

export default function MyPage() {
  return (
    <Suspense fallback={<div className="h-dvh bg-paper" />}>
      <NextStep />
    </Suspense>
  );
}

import type { Metadata } from "next";
import { Suspense } from "react";
import { Checkin } from "@/components/checkin/Checkin";

export const metadata: Metadata = {
  title: "Check-in | MemBrain",
  description: "A six-minute spoken check-in in Gulf Arabic or English, compared with your own earlier results. A clinician reviews anything that needs a closer look.",
};

export default function CheckinPage() {
  return (
    <Suspense fallback={<div className="h-dvh bg-paper" />}>
      <Checkin />
    </Suspense>
  );
}

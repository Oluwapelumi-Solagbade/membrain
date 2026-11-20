import type { Metadata } from "next";
import { Suspense } from "react";
import { MyLifeView } from "@/components/mylife/MyLifeView";

export const metadata: Metadata = {
  title: "MyLife Profile & Quick Care Card (Coming Soon) | MemBrain",
  description:
    "Person-centred life story, daily rhythms, and distress-reduction Quick Care Card for hospital admissions and caregiving.",
};

export default function MyLifePage() {
  return (
    <Suspense fallback={<div className="min-h-dvh bg-paper" />}>
      <MyLifeView />
    </Suspense>
  );
}

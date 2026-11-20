import type { Metadata } from "next";
import { Suspense } from "react";
import { SignedOutView } from "@/components/auth/SignedOutView";

export const metadata: Metadata = {
  title: "Signed Out | MemBrain",
  description: "You have been safely signed out. All local session data and health records have been cleared from this browser.",
};

export default function SignedOutPage() {
  return (
    <Suspense fallback={<div className="min-h-dvh bg-paper" />}>
      <SignedOutView />
    </Suspense>
  );
}

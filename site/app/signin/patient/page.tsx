import type { Metadata } from "next";
import { Suspense } from "react";
import { PatientSignIn } from "@/components/auth/PatientSignIn";

export const metadata: Metadata = { title: "Sign in | MemBrain", robots: { index: false } };

export default function PatientSignInPage() {
  return (
    <Suspense fallback={<div className="min-h-dvh bg-white" />}>
      <PatientSignIn />
    </Suspense>
  );
}

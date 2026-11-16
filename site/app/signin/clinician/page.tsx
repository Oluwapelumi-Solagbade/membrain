import type { Metadata } from "next";
import { Suspense } from "react";
import { ClinicianSignIn } from "@/components/auth/ClinicianSignIn";

export const metadata: Metadata = { title: "Clinician sign-in | MemBrain", robots: { index: false } };

export default function ClinicianSignInPage() {
  return (
    <Suspense fallback={<div className="min-h-dvh bg-white" />}>
      <ClinicianSignIn />
    </Suspense>
  );
}

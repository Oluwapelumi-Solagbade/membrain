import type { Metadata } from "next";
import { SignInChooser } from "@/components/auth/SignInChooser";

export const metadata: Metadata = { title: "Sign in | MemBrain", robots: { index: false } };

export default function SignInPage() {
  return <SignInChooser />;
}

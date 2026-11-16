"use client";

import Link from "next/link";
import { ArrowRight, FlaskConical, HeartHandshake, MapPin, ShieldCheck, Stethoscope } from "lucide-react";
import { AuthShell } from "./AuthShell";

const doors = [
  {
    href: "/signin/patient/",
    icon: HeartHandshake,
    title: "Patient or family",
    text: "Do your spoken check-in and see what happens next. Sign in with your phone; no password.",
    ar: "المرضى والعائلات",
  },
  {
    href: "/signin/clinician/",
    icon: Stethoscope,
    title: "Clinical staff",
    text: "The review queue, case packets and referrals. Sign in with your work account.",
    ar: "الكادر الطبي",
  },
];

export function SignInChooser() {
  return (
    <AuthShell
      variant="neutral"
      eyebrow="Welcome to MemBrain"
      title={
        <>
          From the first worry <span className="text-sand">to the right clinician.</span>
        </>
      }
      body="One place for people noticing a change, the clinicians who review it, and the referral that follows. MemBrain flags risk and change; it never diagnoses."
      trust={[
        { icon: ShieldCheck, text: "Role-based access; every case view is audited" },
        { icon: MapPin, text: "Hosted in-country, Azure UAE North" },
        { icon: FlaskConical, text: "Prototype: synthetic records only" },
      ]}
      back={{ href: "/", label: "MemBrain" }}
      footer={<span className="text-lv-urgent">In an emergency, call 998.</span>}
    >
      <h2 className="text-[30px] font-semibold leading-tight tracking-[-0.02em]">Sign in</h2>
      <p className="mt-2 text-[15.5px] text-body">Who are you signing in as?</p>
      <div className="mt-8 space-y-3">
        {doors.map(({ href, icon: I, title, text, ar }) => (
          <Link key={href} href={href} className="group flex items-start gap-4 rounded-2xl border border-line bg-white p-5 transition-all hover:-translate-y-0.5 hover:border-leaf/40 hover:shadow-[0_14px_34px_-20px_rgb(15_63_44/0.5)]">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-mist text-deep">
              <I size={24} strokeWidth={1.8} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-baseline justify-between gap-3">
                <span className="text-[17.5px] font-semibold">{title}</span>
                <span lang="ar" className="text-[14px] text-muted">{ar}</span>
              </span>
              <span className="mt-1 block text-[14.5px] leading-snug text-body">{text}</span>
            </span>
            <ArrowRight size={19} className="mt-1 shrink-0 text-deep transition-transform group-hover:translate-x-0.5" />
          </Link>
        ))}
      </div>
      <div className="mt-8 rounded-2xl bg-paper p-4 text-[14.5px] leading-snug text-body">
        Worried about someone? You don&apos;t need an account to raise a concern.{" "}
        <Link href="/concern/" className="font-medium text-deep hover:underline">
          Raise a concern
        </Link>
      </div>
    </AuthShell>
  );
}

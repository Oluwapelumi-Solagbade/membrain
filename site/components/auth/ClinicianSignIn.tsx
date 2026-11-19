"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Building2, Eye, EyeOff, FlaskConical, Loader2, Lock, Mail, MapPin, ShieldCheck } from "lucide-react";
import { LevelPill } from "../ui";
import { demoAccounts, homeFor, hospitalLabel, signInClinician, useSession, type DemoAccounts } from "@/lib/auth";
import { Alert, AuthShell, Divider, Field, input, safeNext } from "./AuthShell";

function QueueCard() {
  const rows: [string, string, "URGENT" | "CLINICIAN_REVIEW" | "CHECK_AGAIN"][] = [
    ["MB-1322", "Recent fall with head injury reported", "URGENT"],
    ["MB-1187", "Delayed recall below own baseline, repeated", "CLINICIAN_REVIEW"],
    ["MB-C7F2A", "Bills now handled by the daughter", "CLINICIAN_REVIEW"],
    ["MB-1455", "Lower than usual; poor sleep reported", "CHECK_AGAIN"],
  ];
  return (
    <div className="rounded-2xl border border-white/12 bg-white/[0.07] p-1.5 shadow-[0_30px_60px_-30px_rgb(0_0_0/0.5)] backdrop-blur-sm">
      <div className="rounded-xl bg-white text-ink">
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <p className="text-[14px] font-semibold">Review queue</p>
          <span className="text-[12px] text-muted">4 open · sorted by urgency</span>
        </div>
        <ul className="divide-y divide-line">
          {rows.map(([id, why, lv]) => (
            <li key={id} className="flex items-center gap-3 px-4 py-2.5">
              <span className="w-[78px] shrink-0 font-mono text-[12.5px] font-semibold">{id}</span>
              <span className="min-w-0 flex-1 truncate text-[12.5px] text-body">{why}</span>
              <LevelPill level={lv} size="sm" />
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export function ClinicianSignIn() {
  const router = useRouter();
  const { session, ready } = useSession();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [remember, setRemember] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [demo, setDemo] = useState<DemoAccounts | null>(null);
  const [recentId, setRecentId] = useState<string | null>(null);
  const [recentHospital, setRecentHospital] = useState<{ id: string; name: string } | null>(null);

  useEffect(() => {
    void demoAccounts().then(setDemo);
    if (typeof window !== "undefined") {
      const urlNext = new URLSearchParams(window.location.search).get("next");
      const matchId = urlNext ? new URLSearchParams(urlNext.split("?")[1] || "").get("id") : null;
      const storedId = window.sessionStorage.getItem("membrain.recent_concern_id");
      const hid = window.sessionStorage.getItem("membrain.recent_concern_hospital_id");
      const hname = window.sessionStorage.getItem("membrain.recent_concern_hospital_name");
      const pid = matchId || storedId;
      if (pid) setRecentId(pid);
      if (hid && hname) setRecentHospital({ id: hid, name: hname });
    }
  }, []);

  const getDestination = (u: { role: string; pid?: string }) => {
    const urlNext = safeNext("");
    const fallbackTarget = recentId ? `/clinician/case/?id=${encodeURIComponent(recentId)}` : homeFor(u as any);
    return urlNext && urlNext !== "/clinician/" ? urlNext : fallbackTarget;
  };

  // Already signed in as clinical staff: straight through.
  useEffect(() => {
    if (ready && session && session.user.role !== "participant") {
      router.replace(getDestination(session.user));
    }
  }, [ready, session, router, recentId]);

  const submit = async (e?: React.FormEvent, creds?: { email: string; password: string }) => {
    e?.preventDefault();
    const em = creds?.email ?? email;
    const pw = creds?.password ?? password;
    if (!em || !pw) return setError("Enter your work email and password.");
    setBusy(true);
    setError(null);
    try {
      const u = await signInClinician(em, pw, remember);
      router.replace(getDestination(u));
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  };

  return (
    <AuthShell
      variant="clinician"
      eyebrow="Clinician workspace"
      title={
        <>
          Every alert, <span className="text-sand">with its reasons.</span>
        </>
      }
      body="One queue sorted by urgency, the concern in the reporter's own words, and referrals tracked until follow-up is written down."
      preview={<QueueCard />}
      trust={[
        { icon: ShieldCheck, text: "Role-based access; every case view is audited" },
        { icon: MapPin, text: "Hosted in-country, Azure UAE North" },
        { icon: FlaskConical, text: "Prototype: synthetic records only" },
      ]}
      back={{ href: "/", label: "MemBrain" }}
      footer={
        <>
          <span>Patient or family member?</span>
          <Link href="/signin/patient/" className="font-medium text-deep hover:underline">
            Sign in with your phone
          </Link>
        </>
      }
    >
      <div className="mb-8">
        <span className="inline-flex items-center gap-2 rounded-full bg-mist px-3 py-1 text-[12.5px] font-semibold text-deep">
          <Building2 size={14} /> Clinical staff
        </span>
        <h2 className="mt-4 text-[30px] font-semibold leading-tight tracking-[-0.02em]">Sign in to the workspace</h2>
        <p className="mt-2 text-[15.5px] leading-relaxed text-body">Use the work account your clinic or programme gave you.</p>
      </div>

      {recentId && (
        <div className="mb-6 rounded-2xl border border-leaf/30 bg-leaf/5 p-4 text-start">
          <div className="flex items-start gap-3">
            <Building2 className="mt-0.5 h-5 w-5 shrink-0 text-leaf" />
            <div className="min-w-0 flex-1">
              <p className="text-[14.5px] font-semibold text-deep">
                Reviewing concern <span className="font-mono">{recentId}</span>
              </p>
              {recentHospital?.name && (
                <p className="mt-0.5 text-[13px] text-muted">
                  Hospital selected: <span className="font-medium text-ink">{recentHospital.name}</span>
                </p>
              )}
              <p className="mt-1 text-[12.5px] text-muted">
                Sign in below to open this person's case dossier immediately.
              </p>
            </div>
          </div>
        </div>
      )}

      <form onSubmit={submit} className="space-y-5" noValidate>
        {error && <Alert>{error}</Alert>}
        <Field label="Work email" htmlFor="email">
          <div className="relative">
            <Mail size={18} className="pointer-events-none absolute start-4 top-1/2 -translate-y-1/2 text-muted" />
            <input id="email" type="email" autoComplete="username" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@clinic.ae" className={`${input} ps-11`} />
          </div>
        </Field>
        <Field label="Password" htmlFor="password">
          <div className="relative">
            <Lock size={18} className="pointer-events-none absolute start-4 top-1/2 -translate-y-1/2 text-muted" />
            <input id="password" type={show ? "text" : "password"} autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} className={`${input} pe-12 ps-11`} />
            <button type="button" onClick={() => setShow((s) => !s)} aria-label={show ? "Hide password" : "Show password"} className="absolute end-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-muted hover:bg-mist hover:text-ink">
              {show ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </Field>
        <label className="flex cursor-pointer items-center gap-2.5 text-[14.5px] text-body">
          <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} className="h-[18px] w-[18px] rounded accent-[#0f3f2c]" />
          Keep me signed in on this device for 7 days
        </label>
        <button type="submit" disabled={busy} className="inline-flex h-[52px] w-full items-center justify-center gap-2 rounded-xl bg-deep text-[16px] font-semibold text-white shadow-sm transition-colors hover:bg-deep-hover disabled:opacity-70">
          {busy ? <Loader2 size={19} className="animate-spin" /> : null} {busy ? "Signing in…" : "Sign in"} {!busy && <ArrowRight size={18} />}
        </button>
      </form>

      <div className="mt-7 space-y-4">
        <Divider label="or" />
        <button type="button" disabled className="flex h-[52px] w-full items-center justify-center gap-2.5 rounded-xl border border-line bg-white text-[15px] font-medium text-body opacity-80" title="Planned for the pilot">
          <Building2 size={18} /> Hospital single sign-on <span className="rounded-full bg-paper px-2 py-0.5 text-[11.5px] font-semibold text-muted">Pilot</span>
        </button>
      </div>

      {demo?.enabled && demo.clinicians?.length ? (
        <div className="mt-8 rounded-2xl border border-dashed border-[#cdd6d1] bg-paper/70 p-4">
          <p className="text-[12.5px] font-semibold uppercase tracking-[0.12em] text-leaf">Demo accounts (synthetic data)</p>
          <div className="mt-3 space-y-2">
            {demo.clinicians
              .slice(0, 10)
              .sort((a, b) => {
                const matchA = a.hospital_id && recentHospital?.id === a.hospital_id ? -1 : 0;
                const matchB = b.hospital_id && recentHospital?.id === b.hospital_id ? -1 : 0;
                return matchA - matchB;
              })
              .map((d) => {
                const isMatch = d.hospital_id && recentHospital?.id === d.hospital_id;
                return (
                  <button
                    key={d.email}
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      setEmail(d.email);
                      setPassword(d.password);
                      void submit(undefined, d);
                    }}
                    className={`flex w-full items-center justify-between gap-3 rounded-xl bg-white px-3.5 py-2.5 text-start ring-1 transition-shadow hover:ring-leaf/50 ${
                      isMatch ? "ring-2 ring-leaf" : "ring-line"
                    }`}
                  >
                    <span className="min-w-0">
                      <span className="flex items-center gap-2">
                        <span className="block truncate text-[14.5px] font-medium">{d.name}</span>
                        {isMatch && (
                          <span className="rounded bg-leaf/10 px-2 py-0.5 text-[11px] font-bold text-deep">
                            Selected hospital
                          </span>
                        )}
                      </span>
                      <span className="block truncate text-[12.5px] text-muted">{d.hospital_name ? hospitalLabel(d.hospital_name) : "All hospitals (programme coordinator)"}</span>
                      <span className="block truncate text-[12px] text-muted/80">{d.email}</span>
                    </span>
                    <span className="shrink-0 text-[13px] font-semibold text-deep">Use →</span>
                  </button>
                );
              })}
          </div>
        </div>
      ) : null}
    </AuthShell>
  );
}

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, Clock, Phone } from "lucide-react";
import { authHeader } from "@/lib/auth";
import { getBackend } from "@/lib/workspace/backend";

/* "Your next step": only words a clinician approved (api/family.py), and the referral's progress in plain language. */

type Data = { status: "approved" | "waiting"; text: string; approved_at: string | null; referrals: { service: string | null; steps: { date: string; text: string }[] }[] };
const T = {
  en: { title: "Your next step", approved: "Approved by your clinician", waiting: "Being reviewed", progress: "Referral progress", none: "No referral so far.",
        offline: "This page needs the MemBrain server.", back: "Back to MemBrain", emergency: "In an emergency, call 998." },
  ar: { title: "خطوتك التالية", approved: "اعتمدها طبيبك", waiting: "قيد المراجعة", progress: "مسار الإحالة", none: "لا توجد إحالة حتى الآن.",
        offline: "تحتاج هذه الصفحة إلى خادم MemBrain.", back: "العودة إلى MemBrain", emergency: "في حالات الطوارئ اتصل بالرقم 998." },
};

export function NextStep() {
  const params = useSearchParams();
  const pid = params.get("id") ?? "";
  const lang = params.get("lang") === "en" ? "en" : "ar";
  const t = T[lang];
  const [d, setD] = useState<Data | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    getBackend().then(async (b) => {
      if (b.mode !== "server") return setErr(t.offline);
      const r = await fetch(`${b.base ?? ""}/me/${encodeURIComponent(pid)}/next-step?lang=${lang}`, { headers: { ...authHeader() } });
      if (!r.ok) throw new Error(`${r.status}`);
      setD((await r.json()) as Data);
    }).catch((e) => setErr(String((e as Error).message)));
  }, [pid, lang, t.offline]);

  return (
    <div dir={lang === "ar" ? "rtl" : "ltr"} lang={lang} className="min-h-dvh bg-paper">
      <main className="mx-auto max-w-[680px] space-y-5 px-4 py-10">
        <h1 className="font-serif text-[34px] font-semibold">{t.title}</h1>
        {err && <p className="text-lv-review">{err}</p>}
        {d && (
          <>
            <div className="rounded-2xl border border-line bg-white p-5">
              <p className={`inline-flex items-center gap-2 rounded-md px-2 py-0.5 text-[13px] font-semibold ${d.status === "approved" ? "bg-[#e3f1e8] text-lv-stable" : "bg-mist text-deep"}`}>
                {d.status === "approved" ? <CheckCircle2 size={15} /> : <Clock size={15} />} {d.status === "approved" ? t.approved : t.waiting}
              </p>
              <p className="mt-3 text-[18px] leading-relaxed text-ink">{d.text}</p>
            </div>
            <div className="rounded-2xl border border-line bg-white p-5">
              <h2 className="text-[17px] font-semibold">{t.progress}</h2>
              {d.referrals.length === 0 ? <p className="mt-2 text-body">{t.none}</p> : d.referrals.map((r, i) => (
                <div key={i} className="mt-3">
                  {r.service && <p className="font-medium">{r.service}</p>}
                  <ol className="mt-1.5 space-y-1.5 border-s-2 border-leaf/40 ps-4">
                    {r.steps.map((s, j) => <li key={j} className="text-[15px]"><span className="text-muted">{s.date} · </span>{s.text}</li>)}
                  </ol>
                </div>
              ))}
            </div>
          </>
        )}
        <p className="flex items-center gap-2 font-medium text-lv-urgent"><Phone size={16} /> {t.emergency}</p>
        <Link href="/" className="inline-flex rounded-xl border border-line bg-white px-5 py-3 text-[15px] font-medium hover:bg-mist">{t.back}</Link>
      </main>
    </div>
  );
}

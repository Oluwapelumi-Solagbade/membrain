import type { IntakeResult } from "@/lib/mb";

type Mark = { a: number; b: number; kind: string; title: string };

/** The narrative with the words each extracted fact came from highlighted. Overlapping spans keep the first. */
export function Narrative({ text, result, className = "" }: { text: string; result: IntakeResult; className?: string }) {
  const marks: Mark[] = [];
  for (const f of result.fields) for (const [a, b] of f.spans) marks.push({ a, b, kind: f.kind, title: f.label });
  if (result.onset) for (const [a, b] of result.onset.spans) marks.push({ a, b, kind: "onset", title: "When it started" });
  marks.sort((x, y) => x.a - y.a || y.b - x.b);

  const parts: React.ReactNode[] = [];
  let pos = 0;
  marks.forEach((m, i) => {
    if (m.a < pos) return;
    if (m.a > pos) parts.push(text.slice(pos, m.a));
    parts.push(
      <mark key={i} title={m.title} className={`mb-ev mb-ev-${m.kind}`}>
        {text.slice(m.a, m.b)}
      </mark>,
    );
    pos = m.b;
  });
  parts.push(text.slice(pos));

  const ar = result.lang === "ar";
  return (
    <p dir={ar ? "rtl" : "ltr"} lang={ar ? "ar" : "en"} className={`${ar ? "text-[17px] leading-[2]" : "text-[15.5px] leading-[1.75]"} ${className}`}>
      {parts}
    </p>
  );
}

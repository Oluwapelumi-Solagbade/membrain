// The MemBrain engine and intake extractor, as the site uses them. Both are byte-identical copies of
// web/engine.js and web/intake.js (see scripts/sync-data.mjs), so the parity tests against the Python
// engine cover what runs here.
import makeEngine from "./generated/engine.mjs";
import makeIntake from "./generated/intake.mjs";
import engineData from "./generated/engine-data.json";
import intakeData from "./generated/intake-data.json";

export type Level = "BASELINE" | "STABLE" | "CHECK_AGAIN" | "CLINICIAN_REVIEW" | "URGENT" | "INVALID";
export type Lang = "en" | "ar";
/** Who raised a concern (membrain/config.py REPORTER_LABEL keys). The navigator's entry route is mapped from it. */
export type Reporter = "self" | "family" | "helper" | "professional" | "coordinator";

export type Span = [number, number];
export type IntakeField = {
  kind: "domain" | "red_flag" | "confounder";
  key: string;
  label: string;
  confidence: number;
  needs_confirmation: boolean;
  spans: Span[];
  evidence: string[];
};
export type IntakeResult = {
  engine: string;
  version: string;
  lang: Lang;
  fields: IntakeField[];
  onset: { value: string; label: string; confidence: number; spans: Span[] } | null;
  timeline: { activity: string; activity_label: string; who_took_over: string; who_label: string; confidence: number; spans: Span[] }[];
  urgent: boolean;
};

export type Driver = { input: string; value: number; threshold: number; change?: number };
export type Evaluation = {
  session_id: string;
  date: string;
  level: Level;
  reasons: string[];
  drivers: Driver[];
  pathways: string[];
  valid: boolean;
  composite_z?: number;
  next_action?: string;
  held_for_clinician?: boolean;
};

export type Session = {
  session_id: string;
  date: string;
  type?: "intake";
  channel?: string;
  concern?: string;
  reporter?: Reporter;
  activities_taken_over?: string[];
  reported_concern?: { reporter: Reporter; domains: string[]; activities_taken_over: string[] };
  red_flags?: string[];
  [key: string]: unknown;
};

export type Persona = {
  id: string;
  display_name: { en: string; ar: string };
  age: number;
  sex: string;
  education: "none" | "primary" | "secondary" | "tertiary";
  dialect: string;
  language: Lang;
  story: string;
  emirate?: string;
  entry_route?: string;
  sessions: Session[];
  referrals?: { id: string; pathway: string; service_id: string; state: string; urgency: string; history: { state: string; date: string }[] }[];
  context?: Record<string, unknown>;
};

type Engine = {
  LEVELS: Level[];
  evaluate: (p: Persona | { id: string; age: number; education: string }, sessions: Session[]) => { latest: Evaluation; history: Evaluation[] };
};
type Intake = { extract: (text: string, lang: Lang) => IntakeResult; detectLang: (text: string) => Lang };

export const config = engineData.config as Record<string, unknown> & {
  ENGINE_VERSION: string;
  NORMS_VERSION: string;
  IQCODE_CUTOFF: number;
  CONCERN_REVIEW_MIN_ACTIVITIES: number;
  CONCERN_COGNITIVE_DOMAINS: string[];
  REVIEW_TARGET_DAYS: Record<string, number>;
};

let engine: Engine | null = null;
let intake: Intake | null = null;
export const getEngine = (): Engine => (engine ??= makeEngine(engineData) as Engine);
export const getIntake = (): Intake => (intake ??= makeIntake(intakeData) as Intake);
export const intakeVersion = (intakeData as { INTAKE_VERSION: string }).INTAKE_VERSION;

export const LEVEL_LABEL: Record<Lang, Record<Level, string>> = {
  en: {
    BASELINE: "Building baseline",
    STABLE: "Stable",
    CHECK_AGAIN: "Check again",
    CLINICIAN_REVIEW: "Clinician review",
    URGENT: "Urgent review",
    INVALID: "Not scored",
  },
  ar: {
    BASELINE: "بناء خط الأساس",
    STABLE: "مستقر",
    CHECK_AGAIN: "إعادة الفحص",
    CLINICIAN_REVIEW: "مراجعة الطبيب",
    URGENT: "مراجعة عاجلة",
    INVALID: "لم يُحتسب",
  },
};

export const LEVEL_TONE: Record<Level, { fg: string; bg: string; dot: string }> = {
  BASELINE: { fg: "text-lv-base", bg: "bg-lv-base-soft", dot: "bg-lv-base" },
  STABLE: { fg: "text-lv-stable", bg: "bg-lv-stable-soft", dot: "bg-lv-stable" },
  CHECK_AGAIN: { fg: "text-lv-check", bg: "bg-lv-check-soft", dot: "bg-lv-check" },
  CLINICIAN_REVIEW: { fg: "text-lv-review", bg: "bg-lv-review-soft", dot: "bg-lv-review" },
  URGENT: { fg: "text-lv-urgent", bg: "bg-lv-urgent-soft", dot: "bg-lv-urgent" },
  INVALID: { fg: "text-muted", bg: "bg-paper", dot: "bg-muted" },
};

export const REPORTER_LABEL: Record<Lang, Record<Reporter, string>> = {
  en: {
    self: "Myself",
    family: "A family member",
    helper: "A household helper",
    professional: "A doctor or nurse",
    coordinator: "A programme coordinator",
  },
  ar: {
    self: "أنا نفسي",
    family: "أحد من العائلة",
    helper: "العاملة أو المساعد في البيت",
    professional: "طبيب أو ممرض",
    coordinator: "منسق البرنامج",
  },
};

export const DOMAIN_AR: Record<string, string> = {
  memory: "الذاكرة",
  language: "إيجاد الكلمات والمحادثة",
  orientation: "معرفة الوقت والمكان والناس",
  executive: "الفلوس والتخطيط",
  daily_function: "الأنشطة اليومية",
  mood: "المزاج",
  behaviour: "التصرفات أو الطبع",
  sleep: "النوم",
};

export const EDUCATION_LABEL: Record<Persona["education"], string> = {
  none: "No formal schooling",
  primary: "Primary",
  secondary: "Secondary",
  tertiary: "University",
};

/** Today's date in the synthetic world the demo data lives in. */
export const DEMO_TODAY = "2026-11-14";

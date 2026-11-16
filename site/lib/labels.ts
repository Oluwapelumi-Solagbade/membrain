// Labels for what the intake extractor finds, in both languages. English follows membrain/intake.py;
// the Arabic is written for Gulf readers and needs native-speaker review before any pilot.
import type { Lang } from "./mb";

type Dict = Record<string, { en: string; ar: string }>;

export const DOMAIN: Dict = {
  memory: { en: "Memory", ar: "الذاكرة" },
  language: { en: "Finding words and following conversation", ar: "إيجاد الكلمات ومتابعة الكلام" },
  orientation: { en: "Knowing the time, place or people", ar: "معرفة الوقت والمكان والناس" },
  executive: { en: "Money, planning and decisions", ar: "الفلوس والتخطيط والقرارات" },
  daily_function: { en: "Daily activities", ar: "الأنشطة اليومية" },
  mood: { en: "Mood", ar: "المزاج" },
  behaviour: { en: "Behaviour or personality", ar: "التصرفات أو الطبع" },
  sleep: { en: "Sleep", ar: "النوم" },
};

export const RED_FLAG: Dict = {
  sudden_onset: { en: "A sudden change", ar: "تغيّر مفاجئ" },
  fluctuating_confusion: { en: "Confusion that comes and goes", ar: "لخبطة تروح وتجي خلال اليوم" },
  new_neuro_symptoms: { en: "New weakness, facial droop, slurred speech or a severe headache", ar: "ضعف جديد أو ميلان في الوجه أو ثقل في الكلام أو صداع شديد" },
  recent_fall_head_injury: { en: "A recent fall or head injury", ar: "طيحة أو ضربة على الراس مؤخرًا" },
  rapid_deterioration: { en: "Getting worse quickly", ar: "تدهور سريع" },
  safety_risk: { en: "A safety risk at home (wandering, gas or stove left on)", ar: "خطر على السلامة في البيت (يضيع، أو يترك الغاز شغّال)" },
};

export const CONFOUNDER: Dict = {
  new_medication: { en: "A new or changed medicine", ar: "دواء جديد أو تغيير في الدواء" },
  recent_illness: { en: "A recent illness or hospital stay", ar: "مرض أو دخول مستشفى مؤخرًا" },
  hearing: { en: "Difficulty hearing", ar: "ضعف في السمع" },
  bereavement: { en: "A recent loss of someone close", ar: "فقدان شخص عزيز مؤخرًا" },
};

export const ACTIVITY: Dict = {
  money: { en: "Money and bills", ar: "الفلوس والفواتير" },
  medicines: { en: "Medicines", ar: "الأدوية" },
  cooking: { en: "Cooking", ar: "الطبخ" },
  shopping: { en: "Shopping", ar: "التسوّق" },
  driving: { en: "Driving or getting around", ar: "السواقة والتنقّل" },
  phone: { en: "Using the phone", ar: "استخدام التلفون" },
  appointments: { en: "Remembering appointments", ar: "تذكّر المواعيد" },
  household: { en: "Household tasks", ar: "شغل البيت" },
  prayer: { en: "Prayer times and routines", ar: "أوقات الصلاة والروتين" },
};

export const WHO: Dict = {
  son: { en: "the son", ar: "الابن" },
  daughter: { en: "the daughter", ar: "البنت" },
  wife: { en: "the wife", ar: "الزوجة" },
  husband: { en: "the husband", ar: "الزوج" },
  brother: { en: "the brother", ar: "الأخ" },
  sister: { en: "the sister", ar: "الأخت" },
  driver: { en: "the driver", ar: "السوّاق" },
  helper: { en: "the household helper", ar: "العاملة في البيت" },
  informant: { en: "the person telling us", ar: "الشخص اللي يخبرنا" },
  other: { en: "another relative", ar: "قريب ثاني" },
};

export const ONSET: Dict = {
  days: { en: "Over the last few days", ar: "من أيام" },
  weeks: { en: "Over recent weeks", ar: "من أسابيع" },
  months: { en: "Over recent months", ar: "من شهور" },
  years: { en: "For a year or more", ar: "من سنة أو أكثر" },
};

export const label = (dict: Dict, key: string, lang: Lang, fallback = key) => dict[key]?.[lang] ?? fallback;

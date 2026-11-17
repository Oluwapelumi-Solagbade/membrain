// The family questionnaire: the Functional Activities Questionnaire (Pfeffer et al., 1982), worded for the UAE.
// A family member rates ten everyday activities as they are NOW, so it can be asked again at each follow-up; the
// engine compares each answer with the last (membrain/triage.py). A screening step: it never diagnoses anything.
// The item order and thresholds come from membrain/config.py (FAQ_ITEMS, FAQ_CUTOFF, FAQ_RISE). The Arabic wording
// is Modern Standard Arabic and, like all of MemBrain's Arabic, needs native-speaker and clinical review; this Arabic
// version of the questionnaire has not been validated.
import { config, type Lang } from "../mb";
import type { Respondent } from "./types";

export const FAQ_ITEMS = (config as unknown as { FAQ_ITEMS: string[] }).FAQ_ITEMS;
export const FAQ_MAX = (config as unknown as { FAQ_MAX: number }).FAQ_MAX;
export const FAQ_CUTOFF = (config as unknown as { FAQ_CUTOFF: number }).FAQ_CUTOFF;
export const FAQ_INTERVAL_WEEKS = (config as unknown as { FAQ_INTERVAL_WEEKS: number }).FAQ_INTERVAL_WEEKS;

/** Each activity: [English, Arabic], with a short example. */
export const ITEM: Record<string, { en: string; ar: string; en_eg: string; ar_eg: string }> = {
  bills: { en: "Paying bills and handling money", ar: "دفع الفواتير والتعامل مع المال", en_eg: "bank transfers, cheques, keeping track of spending", ar_eg: "التحويلات المصرفية والشيكات ومتابعة المصروفات" },
  papers: { en: "Official papers and household affairs", ar: "الأوراق الرسمية وشؤون المنزل", en_eg: "renewals, forms, keeping documents in order", ar_eg: "تجديد الوثائق وتعبئة النماذج وترتيب المستندات" },
  shopping: { en: "Shopping alone for groceries or clothes", ar: "التسوّق وحده لشراء الطعام أو الملابس", en_eg: "choosing, paying, coming back with the right things", ar_eg: "الاختيار والدفع والعودة بالأشياء المطلوبة" },
  hobby: { en: "A game of skill or a hobby", ar: "لعبة تحتاج إلى مهارة أو هواية", en_eg: "cards, dominoes, chess, sewing, gardening", ar_eg: "الورق أو الدومينو أو الشطرنج أو الخياطة أو الزراعة" },
  hot_drink: { en: "Making tea or coffee and turning off the stove", ar: "إعداد الشاي أو القهوة وإطفاء الموقد", en_eg: "", ar_eg: "" },
  meal: { en: "Preparing a full meal", ar: "إعداد وجبة كاملة", en_eg: "", ar_eg: "" },
  current_events: { en: "Keeping up with news and family events", ar: "متابعة الأخبار وأحداث العائلة", en_eg: "", ar_eg: "" },
  follow_media: { en: "Following and discussing a TV programme, the news or a book", ar: "متابعة برنامج تلفزيوني أو الأخبار أو كتاب ومناقشته", en_eg: "", ar_eg: "" },
  remembering: { en: "Remembering appointments, occasions and medicines", ar: "تذكّر المواعيد والمناسبات والأدوية", en_eg: "family occasions, Eid, prayer times, doses", ar_eg: "المناسبات العائلية والعيد ومواعيد الأدوية" },
  travel: { en: "Getting around outside the neighbourhood", ar: "التنقّل خارج الحي", en_eg: "driving, taking a taxi or bus, arranging a lift", ar_eg: "القيادة أو ركوب سيارة أجرة أو حافلة أو ترتيب من يوصله" },
};

/** The answer scale. "Never did it" keeps the published scoring: could do it now = 0, would find it hard now = 1. */
export const SCALE: { value: number; key: string; en: string; ar: string }[] = [
  { value: 0, key: "normal", en: "Manages normally", ar: "يقوم به بشكل طبيعي" },
  { value: 1, key: "difficulty", en: "Has some difficulty, but manages alone", ar: "يجد بعض الصعوبة لكنه يقوم به وحده" },
  { value: 2, key: "help", en: "Needs help", ar: "يحتاج إلى مساعدة" },
  { value: 3, key: "dependent", en: "Someone else does it now", ar: "يقوم به شخص آخر الآن" },
];
export const NEVER: { value: number; key: string; en: string; ar: string }[] = [
  { value: 0, key: "never_could", en: "Never did it, but could now", ar: "لم يكن يقوم به، لكنه يستطيع الآن" },
  { value: 1, key: "never_hard", en: "Never did it, and would find it hard now", ar: "لم يكن يقوم به، وسيجده صعبًا الآن" },
];

export const RESPONDENT: Record<Respondent, { en: string; ar: string }> = {
  spouse: { en: "Husband or wife", ar: "الزوج أو الزوجة" },
  child: { en: "Son or daughter", ar: "الابن أو الابنة" },
  sibling: { en: "Brother or sister", ar: "الأخ أو الأخت" },
  other_family: { en: "Another relative", ar: "قريب آخر" },
  helper: { en: "Household helper", ar: "العاملة المنزلية" },
  friend: { en: "Friend or neighbour", ar: "صديق أو جار" },
  self: { en: "The person themselves", ar: "الشخص نفسه" },
};

/** What the family sees afterwards (identical to api/main.py INFORMANT_MESSAGE). */
export const INFORMANT_MESSAGE: Record<Lang, string> = {
  en: "Thank you. Your answers are now with the clinic team, together with everything reported before. If they show that everyday activities have become harder, the clinic will contact you about a full assessment by a doctor. This questionnaire is a screening step: it cannot diagnose any condition, including dementia or Alzheimer's disease.",
  ar: "شكرًا لك. أصبحت إجاباتك الآن لدى فريق العيادة مع كل ما أُبلغ عنه سابقًا. إذا أظهرت أن الأنشطة اليومية أصبحت أصعب، فستتواصل معك العيادة بشأن تقييم كامل يجريه طبيب. هذا الاستبيان خطوة فحص أولي، ولا يمكنه تشخيص أي حالة، بما في ذلك الخرف أو مرض ألزهايمر.",
};

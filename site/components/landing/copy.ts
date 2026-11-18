// The landing page's words, in English and Arabic. The Arabic is Modern Standard Arabic with a warm, plain register
// (the register UAE health services use on the web); the chats themselves stay in Gulf dialect. It needs a
// native-speaker review before any pilot, as the rest of MemBrain's Arabic does.
import type { Lang } from "@/lib/mb";

/** A heading with one highlighted phrase: [before, highlighted, after]. */
export type Hl = [string, string, string];

export const LANDING = {
  en: {
    metaTitle: "MemBrain | Brain health navigation for the UAE",
    banner: ["PROTOTYPE", "All people and records are synthetic.", " MemBrain flags risk and change; it never diagnoses."],
    nav: [
      { label: "How it works", href: "#how" },
      { label: "Demo", href: "#demo" },
      { label: "Families", href: "#families" },
      { label: "Clinicians", href: "#clinicians" },
      { label: "Evidence", href: "#evidence" },
    ],
    switchLabel: "العربية",
    switchHref: "/ar/",
    switchLang: "ar",
    clinicianView: "Clinician view",
    signIn: "Sign in",
    newTab: "(opens in a new tab)",
    raise: "Raise a concern",
    menuOpen: "Open menu",
    menuClose: "Close menu",
    home: "MemBrain home",

    heroEyebrow: "Brain health navigation · UAE",
    heroTitle: ["From “something’s not right” to the ", "right clinician.", ""] as Hl,
    heroLead: "Have you noticed a change in your memory, thinking or everyday activities? Start here.",
    heroBody:
      "Describe the change you have noticed, by voice or text, in Arabic (Gulf or any other dialect) or English. MemBrain checks for urgent warning signs first, turns your words into facts a clinician can act on, and follows the referral until someone is actually seen.",
    heroCta: "I've noticed a change",
    heroCta2: "Check my own brain health",
    heroOther: { label: "Start in Arabic", href: "/concern/?lang=ar" },
    heroClinician: "See the clinician view",
    heroDemo: "Watch the demo",
    heroImageAlt: "An older Emirati man and his daughter looking at a tablet together",

    pillarsLabel: "What MemBrain does",
    pillars: [
      ["Concern to action", "Structured and guided"],
      ["Whole-person view", "Health, lifestyle and risk factors"],
      ["Ongoing monitoring", "Track change over time"],
      ["Connected care", "To the right services in the UAE"],
    ],

    howEyebrow: "How it works",
    howTitle: ["Four steps, and ", "nobody is left waiting", " in between"] as Hl,
    howIntro: "Families get lost in the gap between the first worry and a memory assessment. MemBrain makes the first step easy and makes sure the last one happens.",
    steps: [
      ["Notice", "Anyone can raise it: the person, family, a household helper or a doctor. Who raised it stays with the concern, so a family account is never mistaken for the person's own."],
      ["Describe", "Speak or type in your own words. Every fact keeps the exact words it came from, and you can untick anything that is wrong before it goes anywhere."],
      ["Check", "Urgent signs, such as a fall with a head injury or sudden confusion, stop everything and show the emergency steps. A significant concern goes straight to a clinician."],
      ["Follow through", "The referral is tracked step by step. It only counts as done when the assessment has happened and the follow-up is written down."],
    ],

    audiencesLabel: "Who it is for",
    audiencesEyebrow: "Two doors, one loop",
    audiencesTitle: "Start from a worry, or from a routine check-in",
    audiences: [
      {
        eyebrow: "For families",
        title: "You don't need a diagnosis to ask for help",
        text: "Describe what has changed at home: the repeated questions, the bills, the drive that went wrong. MemBrain reads it back to you aloud and tells you what happens next, in plain words.",
        cta: "Raise a concern",
        href: "/concern/",
      },
      {
        eyebrow: "For adults 50 to 75",
        title: "A six-minute spoken check-in, repeated over time",
        text: "Word lists, a short story and everyday questions, in your own dialect. You are compared with your own earlier results and with people of your age and schooling, so real change shows earlier and fewer people are flagged by mistake.",
        cta: "Try the check-in",
        href: "/checkin/",
      },
      {
        eyebrow: "For clinicians",
        title: "One queue, sorted by urgency, with the evidence attached",
        text: "Each case arrives with the concern in the reporter's own words, the drivers behind its level, what is still missing, and a referral draft that only states confirmed facts.",
        cta: "Open the clinician view",
        href: "/clinician/",
      },
    ],

    clinEyebrow: "For clinicians",
    clinTitle: "Every alert explains itself",
    clinIntro:
      "Levels come from rules you can read, not a black box. Each person is compared with their own baseline and with norms for their age and schooling, and every level shows the inputs and thresholds behind it.",
    clinPoints: [
      "A review packet with the concern, the evidence and what is still missing",
      "Referral drafts that state confirmed facts only, checked sentence by sentence",
      "Closed-loop tracking, from sent to attended to follow-up documented",
    ],
    clinCta: "Open the clinician view",

    evEyebrow: "Evidence, honestly",
    evTitle: "What we have measured, and what is not proven yet",
    evIntro:
      "All of these come from synthetic or public data written or gathered by the team. They show the system works as designed. They do not show it works for real families yet; that is what the pilot is for.",
    evidence: [
      ["12 of 12", "urgent red-flag stories caught in the held-out test set", "Too few to prove 99%. About 300 are needed, planned for Phase A."],
      ["0 of 50", "template referral drafts containing a sentence the checker blocks", "The checker rejects any diagnosis word, new number or unconfirmed claim."],
      ["41.2%", "word error on held-out Emirati speech, down from 49.5%", "103 broadcast clips. Older speakers are still to be measured."],
      ["0.85", "accuracy (F1) picking out what changed, against a 0.90 target", "Not met yet. Rules are the fallback while a larger model is evaluated."],
    ],
    groundingTitle: "Built on recognised tools and measured results",
    grounding: [
      ["IQCODE-16", "Informant questionnaire"],
      ["Lancet Commission 2024", "14 modifiable risk factors"],
      ["HL7 FHIR R4", "Referral and review records"],
      ["Emirati speech", "Recogniser tuned and measured"],
    ],

    closeTitle: "Worried about someone? Start with what you have noticed.",
    closeEcho: { text: "هل أنت قلق على أحد؟ ابدأ بما لاحظته.", lang: "ar" as Lang },
    closeCta: "Raise a concern",
    closeOther: { label: "ابدأ بالعربية", href: "/concern/?lang=ar", lang: "ar" as Lang },

    concernHref: "/concern/",
    checkinHref: "/checkin/",

    footer: {
      links: [
        ["Raise a concern", "/concern/"],
        ["Clinician view", "/clinician/"],
        ["Check-in", "/checkin/"],
        ["Evidence", "#evidence"],
      ],
      note: "Prototype for the Future Health Digital Innovation Challenge. Synthetic data only. Not a medical device; in an emergency call 998.",
    },

    hero: {
      heard: "What we heard",
      reporter: "A family member",
      language: "English",
      who: "Who is doing what now?",
      what: "What has changed?",
      none: "No change reported",
      urgent: ["Emergency steps shown now", "Urgent"],
      review: ["Next: a clinician review", "Review in 21 days"],
      routine: ["Next: a first check-in", "Routine path"],
      confirm: "A clinician confirms every fact first.",
    },

    demo: {
      eyebrow: "See it work",
      title: ["From a worried message to a ", "tracked referral", ", in about 90 seconds"] as Hl,
      intro: "Recorded from the live site and the MemBrain server, start to finish, on synthetic data. Nothing is mocked up: every fact, level and referral on screen is what the engine produced.",
      steps: [
        "Anyone who notices a change raises it: the person, family, a helper or a doctor.",
        "They describe it in their own words, by voice or text, in Arabic (Gulf or any other dialect) or English.",
        "MemBrain picks out the facts, each with the words it came from.",
        "The engine sets the next step: here, a clinician review within 21 days.",
        "It arrives at the top of the clinician's review queue, with the reason.",
        "The clinician refers, with a reason drafted only from confirmed facts.",
        "The referral is tracked until follow-up is written down.",
      ],
      watch: "Watch the full demo",
      gif: "Download the GIF",
      loopCaption: "The concern chat, at double speed",
      videoNote: "96 seconds · captions are on screen, no sound · all people and records are synthetic",
      videoDownload: "Download the video (MP4, 12 MB)",
      inEnglish: "",
    },

    chat: {
      eyebrow: "No app needed",
      title: ["Raise it where families already talk: ", "WhatsApp and Telegram", ""] as Hl,
      intro: "Send a voice note or a message in Arabic (Gulf or any other dialect) or English. MemBrain reads back what it understood, with the words each fact came from, and tells you what happens next. It never gives a diagnosis.",
      wa: ["WhatsApp, in Arabic", "The app most families in the UAE already have open. A voice note is enough."],
      tg: ["Telegram, in English", "For expatriate families and carers. The same checks, the same clinician queue."],
      note: "Both channels are planned for the pilot and shown here as previews. The facts and the outcome are the engine's real output for these two messages.",
    },
  },

  ar: {
    metaTitle: "MemBrain | دليلك لصحة الدماغ في الإمارات",
    banner: ["نموذج تجريبي", "جميع الأشخاص والسجلات وهمية.", " يرصد MemBrain المخاطر والتغيّرات، ولا يشخّص أبدًا."],
    nav: [
      { label: "كيف يعمل", href: "#how" },
      { label: "العرض", href: "#demo" },
      { label: "للعائلات", href: "#families" },
      { label: "للأطباء", href: "#clinicians" },
      { label: "الأدلة", href: "#evidence" },
    ],
    switchLabel: "English",
    switchHref: "/",
    switchLang: "en",
    clinicianView: "واجهة الطبيب",
    signIn: "تسجيل الدخول",
    newTab: "(تُفتح في نافذة جديدة)",
    raise: "أبلغ عن تغيّر",
    menuOpen: "افتح القائمة",
    menuClose: "أغلق القائمة",
    home: "الصفحة الرئيسية لـ MemBrain",

    heroEyebrow: "دليل صحة الدماغ · الإمارات",
    heroTitle: ["من «هناك شيء ليس على ما يرام» إلى ", "الطبيب المناسب.", ""] as Hl,
    heroLead: "هل لاحظت تغيّرًا في ذاكرتك أو تفكيرك أو أنشطتك اليومية؟ ابدأ من هنا.",
    heroBody:
      "صِف التغيّر الذي لاحظته، بالصوت أو بالكتابة، بالعربية بأي لهجة، ومنها الخليجية، أو بالإنجليزية. يتحقّق MemBrain أولًا من علامات الخطر العاجلة، ثم يحوّل كلامك إلى معلومات يستطيع الطبيب أن يتصرّف بناءً عليها، ويتابع الإحالة حتى يُرى الشخص فعلًا.",
    heroCta: "لاحظت تغيّرًا",
    heroCta2: "أفحص صحة دماغي",
    heroOther: { label: "Start in English", href: "/concern/" },
    heroClinician: "شاهد واجهة الطبيب",
    heroDemo: "شاهد العرض",
    heroImageAlt: "رجل إماراتي مسنّ وابنته ينظران معًا إلى جهاز لوحي",

    pillarsLabel: "ماذا يقدّم MemBrain",
    pillars: [
      ["من القلق إلى الإجراء", "خطوات واضحة ومنظّمة"],
      ["صورة كاملة للشخص", "الصحة ونمط الحياة وعوامل الخطر"],
      ["متابعة مستمرة", "رصد التغيّر مع الوقت"],
      ["رعاية مترابطة", "إلى الخدمات المناسبة في الإمارات"],
    ],

    howEyebrow: "كيف يعمل",
    howTitle: ["أربع خطوات، و", "لا أحد يبقى منتظرًا", " بينها"] as Hl,
    howIntro: "تضيع العائلات بين أول قلق وبين تقييم الذاكرة. يجعل MemBrain الخطوة الأولى سهلة، ويتأكد من أن الخطوة الأخيرة تحدث فعلًا.",
    steps: [
      ["الملاحظة", "يستطيع أي شخص أن يبلّغ: الشخص نفسه، أو أحد من العائلة، أو العاملة في المنزل، أو الطبيب. ويبقى اسم من بلّغ مع البلاغ، فلا يُخلط كلام العائلة بكلام الشخص نفسه."],
      ["الوصف", "تحدّث أو اكتب بكلماتك. كل معلومة تحتفظ بالكلمات التي جاءت منها، ويمكنك إلغاء أي شيء غير صحيح قبل أن يذهب إلى أي مكان."],
      ["الفحص", "العلامات العاجلة، مثل سقوط مع إصابة في الرأس أو تشوّش مفاجئ، توقف كل شيء وتعرض خطوات الطوارئ. والقلق الواضح يذهب مباشرة إلى الطبيب."],
      ["المتابعة حتى النهاية", "تُتابَع الإحالة خطوة بخطوة، ولا تُعدّ مكتملة إلا بعد إجراء التقييم وتوثيق المتابعة."],
    ],

    audiencesLabel: "لمن هذا",
    audiencesEyebrow: "بابان، ودائرة واحدة",
    audiencesTitle: "ابدأ من قلق، أو من فحص دوري",
    audiences: [
      {
        eyebrow: "للعائلات",
        title: "لا تحتاج إلى تشخيص لتطلب المساعدة",
        text: "صِف ما تغيّر في البيت: الأسئلة المتكرّرة، والفواتير، والمشوار الذي لم يمضِ كما يجب. يقرأ MemBrain ما فهمه بصوت مسموع، ويخبرك بالخطوة التالية بكلمات بسيطة.",
        cta: "أبلغ عن تغيّر",
        href: "/concern/?lang=ar",
      },
      {
        eyebrow: "للبالغين من ٥٠ إلى ٧٥ عامًا",
        title: "فحص صوتي مدته ست دقائق، يتكرّر مع الوقت",
        text: "قوائم كلمات، وقصة قصيرة، وأسئلة من الحياة اليومية، بلهجتك. نقارنك بنتائجك السابقة وبأشخاص من عمرك ومستوى تعليمك، فيظهر التغيّر الحقيقي مبكرًا ويقلّ عدد من يُنبَّه عليهم خطأً.",
        cta: "جرّب الفحص",
        href: "/checkin/?lang=ar",
      },
      {
        eyebrow: "للأطباء",
        title: "قائمة واحدة مرتّبة حسب الأولوية، والأدلة مرفقة",
        text: "تصل كل حالة ومعها القلق بكلمات من بلّغ عنه، والأسباب وراء مستواها، وما زال ناقصًا، ومسودّة إحالة لا تذكر إلا المعلومات المؤكَّدة.",
        cta: "افتح واجهة الطبيب",
        href: "/clinician/",
      },
    ],

    clinEyebrow: "للأطباء",
    clinTitle: "كل تنبيه يشرح نفسه",
    clinIntro:
      "تأتي المستويات من قواعد يمكن قراءتها، لا من صندوق أسود. يُقارَن كل شخص بخط الأساس الخاص به وبمعايير عمره وتعليمه، ويعرض كل مستوى المدخلات والحدود التي أدّت إليه.",
    clinPoints: [
      "ملف مراجعة فيه القلق والأدلة وما زال ناقصًا",
      "مسودّات إحالة لا تذكر إلا المعلومات المؤكَّدة، تُفحص جملةً جملة",
      "متابعة مغلقة الحلقة: من الإرسال إلى الحضور إلى توثيق المتابعة",
    ],
    clinCta: "افتح واجهة الطبيب",

    evEyebrow: "الأدلة، بصراحة",
    evTitle: "ما قِسناه، وما لم يثبت بعد",
    evIntro:
      "كل هذه الأرقام من بيانات وهمية أو عامة كتبها الفريق أو جمعها. تُظهر أن النظام يعمل كما صُمّم، لكنها لا تُثبت بعد أنه يعمل مع عائلات حقيقية؛ ولهذا نحتاج إلى التجربة الميدانية.",
    evidence: [
      ["١٢ من ١٢", "قصة فيها علامات خطر عاجلة رُصدت في مجموعة الاختبار المستقلة", "عدد قليل لإثبات ٩٩٪. نحتاج إلى نحو ٣٠٠، وهي مخطّطة للمرحلة الأولى."],
      ["٠ من ٥٠", "مسودّة إحالة نموذجية فيها جملة يرفضها المدقّق", "يرفض المدقّق أي كلمة تشخيص، أو رقم جديد، أو ادّعاء غير مؤكَّد."],
      ["٤١٫٢٪", "نسبة الخطأ في الكلمات على كلام إماراتي مستقل، بعد أن كانت ٤٩٫٥٪", "١٠٣ مقاطع من البث. لم نقِس بعد كلام كبار السن."],
      ["٠٫٨٥", "دقّة (F1) في تحديد ما تغيّر، والهدف ٠٫٩٠", "لم يتحقّق بعد. القواعد هي البديل إلى أن يُقيَّم نموذج أكبر."],
    ],
    groundingTitle: "مبني على أدوات معترف بها ونتائج مقيسة",
    grounding: [
      ["IQCODE-16", "استبيان من شخص قريب"],
      ["Lancet Commission 2024", "١٤ عامل خطر قابل للتعديل"],
      ["HL7 FHIR R4", "سجلات الإحالة والمراجعة"],
      ["الكلام الإماراتي", "نظام تعرّف مضبوط ومقيس"],
    ],

    closeTitle: "هل أنت قلق على أحد؟ ابدأ بما لاحظته.",
    closeEcho: { text: "Worried about someone? Start with what you have noticed.", lang: "en" as Lang },
    closeCta: "أبلغ عن تغيّر",
    closeOther: { label: "Start in English", href: "/concern/", lang: "en" as Lang },

    concernHref: "/concern/?lang=ar",
    checkinHref: "/checkin/?lang=ar",

    footer: {
      links: [
        ["أبلغ عن تغيّر", "/concern/?lang=ar"],
        ["واجهة الطبيب", "/clinician/"],
        ["الفحص", "/checkin/?lang=ar"],
        ["الأدلة", "#evidence"],
      ],
      note: "نموذج تجريبي لتحدّي الابتكار الرقمي لمستقبل الصحة. بيانات وهمية فقط. ليس جهازًا طبيًا؛ في الطوارئ اتصل على ٩٩٨.",
    },

    hero: {
      heard: "ما سمعناه",
      reporter: "أحد أفراد العائلة",
      language: "عربي",
      who: "من يقوم بماذا الآن؟",
      what: "ما الذي تغيّر؟",
      none: "لم يُذكر أي تغيّر",
      urgent: ["تظهر خطوات الطوارئ الآن", "عاجل"],
      review: ["التالي: مراجعة الطبيب", "مراجعة خلال ٢١ يومًا"],
      routine: ["التالي: أول فحص", "المسار المعتاد"],
      confirm: "يؤكّد الطبيب كل معلومة أولًا.",
    },

    demo: {
      eyebrow: "شاهده يعمل",
      title: ["من رسالة قلق إلى ", "إحالة متابَعة", "، في نحو ٩٠ ثانية"] as Hl,
      intro: "سُجّل من الموقع الحي ومن خادم MemBrain، من البداية إلى النهاية، على بيانات وهمية. لا شيء مصطنع: كل معلومة ومستوى وإحالة على الشاشة هي ما أنتجه النظام.",
      steps: [
        "من يلاحظ تغيّرًا يبلّغ عنه: الشخص نفسه، أو العائلة، أو العاملة، أو الطبيب.",
        "يصفه بكلماته، بالصوت أو بالكتابة، بالعربية بأي لهجة، ومنها الخليجية، أو بالإنجليزية.",
        "يستخرج MemBrain المعلومات، كلٌّ منها مع الكلمات التي جاءت منها.",
        "يحدّد النظام الخطوة التالية: هنا، مراجعة الطبيب خلال ٢١ يومًا.",
        "تصل الحالة إلى أعلى قائمة مراجعة الطبيب، ومعها السبب.",
        "يُحيل الطبيب الحالة، بسبب مكتوب من المعلومات المؤكَّدة فقط.",
        "تُتابَع الإحالة إلى أن تُوثَّق المتابعة.",
      ],
      watch: "شاهد العرض كاملًا",
      gif: "حمّل الصورة المتحرّكة",
      loopCaption: "محادثة البلاغ، بسرعة مضاعفة",
      videoNote: "٩٦ ثانية · الشرح مكتوب على الشاشة، بدون صوت · جميع الأشخاص والسجلات وهمية",
      videoDownload: "حمّل الفيديو (MP4، ١٢ ميغابايت)",
      inEnglish: "العرض باللغة الإنجليزية.",
    },

    chat: {
      eyebrow: "بدون تطبيق جديد",
      title: ["بلّغ حيث تتحدّث العائلات أصلًا: ", "واتساب وتيليجرام", ""] as Hl,
      intro: "أرسل رسالة صوتية أو مكتوبة بالعربية بأي لهجة، ومنها الخليجية، أو بالإنجليزية. يعيد MemBrain عليك ما فهمه، مع الكلمات التي جاءت منها كل معلومة، ويخبرك بالخطوة التالية. ولا يعطي تشخيصًا أبدًا.",
      wa: ["واتساب، بالعربية", "التطبيق المفتوح عند أغلب العائلات في الإمارات. تكفي رسالة صوتية."],
      tg: ["تيليجرام، بالإنجليزية", "للعائلات المقيمة ومقدّمي الرعاية. نفس الفحوصات، ونفس قائمة الطبيب."],
      note: "القناتان مخطّطتان للتجربة الميدانية، وتظهران هنا كمعاينة. المعلومات والنتيجة هي ما أخرجه النظام فعلًا لهاتين الرسالتين.",
    },
  },
};

export type LandingCopy = (typeof LANDING)["en"];

"""Versioned item bank: original tasks covering RUDAS-type domains.

These are ORIGINAL items written for MemBrain (not copies of licensed
instruments). Arabic wording is a draft for native-speaker review per
dialect (Emirati / Gulf, Levantine, Egyptian) before Phase A.
Each change to an item creates a new form version and triggers re-equating.
"""
from __future__ import annotations

ITEM_BANK_VERSION = "ib-0.2.0"
FORMS = ["A", "B", "C"]

WORD_LISTS = {
    "A": {"en": ["camel", "window", "orange", "teacher", "river", "coffee", "boat", "garden", "doctor", "moon"],
          "ar": ["جمل", "شباك", "برتقال", "معلم", "نهر", "قهوة", "قارب", "حديقة", "طبيب", "قمر"]},
    "B": {"en": ["horse", "door", "lemon", "farmer", "sea", "bread", "car", "market", "nurse", "star"],
          "ar": ["حصان", "باب", "ليمون", "مزارع", "بحر", "خبز", "سيارة", "سوق", "ممرضة", "نجمة"]},
    "C": {"en": ["goat", "chair", "grape", "driver", "desert", "tea", "plane", "mosque", "baker", "sun"],
          "ar": ["ماعز", "كرسي", "عنب", "سائق", "صحراء", "شاي", "طائرة", "مسجد", "خباز", "شمس"]},
}

FLUENCY = {
    "A": {"category": {"en": "animals", "ar": "الحيوانات"}},
    "B": {"category": {"en": "fruits and vegetables", "ar": "الفواكه والخضروات"}},
    "C": {"category": {"en": "things you can buy in a market", "ar": "أشياء تشتريها من السوق"}},
}

# Stories: 12 idea units each; each unit is matched by any of its keywords.
STORIES = {
    "A": {
        "en": "Last Friday, Fatima drove with her grandson to the old market in Al Ain. "
              "She bought dates and a blue scarf. On the way home the car had a flat tyre, "
              "and a kind policeman helped them change it before sunset.",
        "ar": "يوم الجمعة الماضي، ذهبت فاطمة بالسيارة مع حفيدها إلى السوق القديم في العين. "
              "اشترت تمراً ووشاحاً أزرق. وفي طريق العودة انثقب إطار السيارة، "
              "وساعدهم شرطي لطيف في تغييره قبل غروب الشمس.",
        "units": {
            "en": [["friday"], ["fatima"], ["grandson"], ["market"], ["al ain", "ain"], ["dates"],
                   ["scarf"], ["blue"], ["tyre", "tire", "flat"], ["policeman", "police"], ["helped", "change"], ["sunset"]],
            "ar": [["الجمعه", "جمعه"], ["فاطمه"], ["حفيدها", "حفيد"], ["السوق", "سوق"], ["العين"], ["تمرا", "تمر"],
                   ["وشاح", "وشاحا"], ["ازرق"], ["اطار", "انثقب"], ["شرطي", "شرطه"], ["ساعدهم", "تغييره"], ["غروب"]],
        },
    },
    "B": {
        "en": "On Monday morning, Ahmed took the bus to the hospital in Sharjah to visit his brother. "
              "He brought him oranges and a newspaper. The doctor said his brother could go home on Thursday, "
              "so Ahmed called his sister to share the good news.",
        "ar": "صباح يوم الاثنين، ركب أحمد الحافلة إلى المستشفى في الشارقة لزيارة أخيه. "
              "أحضر له برتقالاً وجريدة. قال الطبيب إن أخاه يستطيع العودة إلى البيت يوم الخميس، "
              "فاتصل أحمد بأخته ليخبرها بالخبر السعيد.",
        "units": {
            "en": [["monday"], ["ahmed"], ["bus"], ["hospital"], ["sharjah"], ["brother"], ["oranges", "orange"],
                   ["newspaper"], ["doctor"], ["thursday"], ["sister", "called"], ["good news", "news"]],
            "ar": [["الاثنين"], ["احمد"], ["الحافله", "حافله", "باص"], ["المستشفى", "مستشفى"], ["الشارقه"], ["اخيه", "اخوه", "اخاه"],
                   ["برتقالا", "برتقال"], ["جريده"], ["الطبيب", "طبيب", "دكتور"], ["الخميس"], ["اخته", "اتصل"], ["الخبر", "السعيد"]],
        },
    },
    "C": {
        "en": "During the holiday, Mariam cooked rice and fish for twelve guests. "
              "Her neighbour brought a cake with yellow flowers. After dinner, everyone walked "
              "to the beach and the children played until the call to prayer.",
        "ar": "في أيام العيد، طبخت مريم الأرز والسمك لاثني عشر ضيفاً. "
              "أحضرت جارتها كعكة عليها زهور صفراء. وبعد العشاء، مشى الجميع "
              "إلى الشاطئ ولعب الأطفال حتى الأذان.",
        "units": {
            "en": [["holiday", "eid"], ["mariam", "maryam"], ["rice"], ["fish"], ["twelve", "12"], ["guests"],
                   ["neighbour", "neighbor"], ["cake"], ["yellow", "flowers"], ["beach"], ["children", "played"], ["prayer"]],
            "ar": [["العيد", "عيد"], ["مريم"], ["الارز", "رز", "عيش"], ["السمك", "سمك"], ["عشر", "اثني"], ["ضيفا", "ضيوف"],
                   ["جارتها", "جاره"], ["كعكه", "كيك"], ["صفراء", "زهور"], ["الشاطئ", "البحر"], ["الاطفال", "لعب"], ["الاذان", "اذان"]],
        },
    },
}

# Judgement scenarios (RUDAS-type domain), scored 0-4 by rubric keywords;
# transcripts are audited by a clinician on a sample.
JUDGEMENT = {
    "A": {"en": "You are cooking and you smell smoke coming from the kitchen. What would you do?",
          "ar": "أنت تطبخ وشممت رائحة دخان من المطبخ. ماذا تفعل؟",
          "rubric": {"en": [["turn off", "switch off", "stove", "gas"], ["leave", "get out", "out"], ["call", "help", "999", "997", "fire"], ["check", "look", "water", "extinguisher"]],
                     "ar": [["اطفي", "اطفئ", "اسكر", "الغاز", "الفرن"], ["اطلع", "اخرج", "برا"], ["اتصل", "الدفاع", "مساعده", "997", "999"], ["اشوف", "ماء", "طفايه"]]}},
    "B": {"en": "You are in a shopping centre and you cannot find the person you came with. What would you do?",
          "ar": "أنت في مركز تسوق ولا تجد الشخص الذي جئت معه. ماذا تفعل؟",
          "rubric": {"en": [["call", "phone"], ["wait", "stay"], ["security", "information", "staff", "ask"], ["meet", "entrance", "car", "place"]],
                     "ar": [["اتصل", "تلفون", "جوال"], ["انتظر", "اظل"], ["الامن", "الاستعلامات", "اسال", "موظف"], ["المدخل", "السياره", "مكان"]]}},
    "C": {"en": "You receive a phone call saying you won money, and they ask for your bank card number. What would you do?",
          "ar": "وصلك اتصال يقول إنك ربحت مالاً، ويطلبون رقم بطاقتك البنكية. ماذا تفعل؟",
          "rubric": {"en": [["no", "refuse", "not give", "never"], ["hang up", "end", "close"], ["bank", "police", "report"], ["family", "son", "daughter", "ask"]],
                     "ar": [["لا", "ما اعطي", "ارفض"], ["اسكر", "اقفل", "انهي"], ["البنك", "الشرطه", "ابلغ"], ["ولدي", "بنتي", "اهلي", "اسال"]]}},
}

# Small demo lexicons for automatic fluency validation. Words not in the
# lexicon are counted as "unverified" and routed to the human audit sample.
FLUENCY_LEXICON = {
    "A": {"en": "dog cat camel horse goat sheep cow lion tiger elephant bird falcon eagle fish shark whale dolphin snake mouse rabbit donkey monkey bear wolf fox deer gazelle oryx chicken duck pigeon parrot frog turtle ant bee spider butterfly crocodile zebra giraffe hippo owl crow",
          "ar": "كلب قطه قط جمل ناقه حصان خيل ماعز غنم خروف بقره اسد نمر فيل طير صقر نسر سمكه سمك قرش حوت دلفين ثعبان حيه فار ارنب حمار قرد دب ذئب ثعلب غزال غزاله مها دجاجه بطه حمامه ببغاء ضفدع سلحفاه نمله نحله عنكبوت فراشه تمساح زرافه بومه غراب"},
    "B": {"en": "apple banana orange grape mango lemon date dates watermelon melon peach pear fig pomegranate strawberry tomato potato onion garlic carrot cucumber lettuce cabbage eggplant okra pepper spinach pumpkin zucchini beans peas corn guava papaya pineapple kiwi plum apricot cherry",
          "ar": "تفاح موز برتقال عنب مانجو ليمون تمر رطب بطيخ شمام خوخ كمثرى تين رمان فراوله طماطم بطاطس بصل ثوم جزر خيار خس ملفوف باذنجان بامیه بامية فلفل سبانخ قرع كوسه فاصوليا بازلاء ذره جوافه بابايا اناناس كيوي برقوق مشمش كرز"},
    "C": {"en": "rice bread milk sugar salt tea coffee oil meat chicken fish eggs cheese butter flour dates spices soap shampoo clothes shoes gold perfume oud bukhoor fabric carpet pots plates cups vegetables fruit water juice honey yoghurt dress abaya kandura toys",
          "ar": "رز ارز خبز حليب سكر ملح شاي قهوه زيت لحم دجاج سمك بيض جبن زبده طحين تمر بهارات صابون شامبو ملابس احذيه ذهب عطر عود بخور قماش سجاد قدور صحون اكواب خضار فواكه ماء عصير عسل لبن فستان عبايه كندوره العاب"},
}


def form_for_session(session_index: int, participant_seed: int = 0) -> str:
    """Counterbalanced form assignment (Latin-square rotation by participant)."""
    order = [FORMS[(participant_seed + k) % 3] for k in range(3)]
    return order[session_index % 3]

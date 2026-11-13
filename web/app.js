/* MemBrain web prototype: participant app, clinician dashboard, validation, architecture. */
(function () {
  const D = window.MB_DATA; const E = window.makeEngine(D); const C = D.config;
  const $ = (s, el = document) => el.querySelector(s);
  const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const fmt = (x, d = 2) => (x == null || Number.isNaN(x) ? "–" : Number(x).toFixed(d));
  const pct = (x) => (x == null ? "–" : Math.round(x * 100) + "%");
  const LV = { BASELINE: "Building baseline", STABLE: "Stable", CHECK_AGAIN: "Check again", CLINICIAN_REVIEW: "Clinician review", URGENT: "Urgent review", INVALID: "Not scored" };
  const LV_AR = { BASELINE: "بناء خط الأساس", STABLE: "مستقر", CHECK_AGAIN: "إعادة الفحص", CLINICIAN_REVIEW: "مراجعة الطبيب", URGENT: "مراجعة عاجلة" };
  const LVCOL = { BASELINE: "#4d5f8a", STABLE: "#2f7d4f", CHECK_AGAIN: "#a8661b", CLINICIAN_REVIEW: "#b2462e", URGENT: "#8f1d3b" };
  const PATH = { memory_clinic: "Memory clinic / geriatrics / neurology", mental_health: "Mental health services", primary_care: "Primary care", primary_care_urgent: "Primary care (urgent safety review)" };
  const EDU = { none: "No formal education", primary: "Primary (1–6 y)", secondary: "Secondary (7–12 y)", tertiary: "Tertiary (>12 y)" };
  const pill = (lv) => `<span class="pill lv-${lv}">${LV[lv] || lv}</span>`;

  // ---------------------------------------------------------------- state
  const S = {
    view: "participant",
    people: D.personas.map((p) => ({ ...p, sessions: p.sessions.map((s) => ({ ...s })) })),
    actions: {}, audit: [], selected: null, sub: "education",
    pt: null,
  };
  S.selected = (S.people.find((p) => p.id === "MB-1322") || S.people[0]).id;
  const toast = (m) => { const t = $("#toast"); t.textContent = m; t.classList.add("on"); setTimeout(() => t.classList.remove("on"), 2200); };
  const log = (action, target, detail) => S.audit.unshift({ ts: new Date().toISOString().slice(0, 19).replace("T", " "), actor: "dr.demo (clinician)", action, target, detail: detail || "" });
  $("#ver").textContent = `engine ${C.ENGINE_VERSION} · norms ${C.NORMS_VERSION} · items ${D.items.ITEM_BANK_VERSION}`;

  // ---------------------------------------------------------------- routing
  function go(v) { S.view = v; document.querySelectorAll("#tabs button").forEach((b) => b.classList.toggle("on", b.dataset.view === v)); render(); try { history.replaceState(null, "", "#" + v); } catch (e) {} window.scrollTo(0, 0); }
  $("#tabs").addEventListener("click", (e) => { const b = e.target.closest("button"); if (b) go(b.dataset.view); });
  function render() {
    document.documentElement.dir = "ltr"; document.documentElement.lang = "en";
    ({ participant: renderParticipant, clinician: renderClinician, validation: renderValidation, how: renderHow })[S.view]();
  }

  // ================================================================ PARTICIPANT
  const T = {
    en: {
      choose: "Who is doing the check-in?", chooseSub: "Pick a demo participant to continue their monitoring, or start a new person. Each scenario shows a different pathway.",
      newp: "New participant", start: "Start", next: "Next", back: "Back", repeat: "Repeat instruction", skip: "Skip",
      welcome: (n) => `Hello ${n}. This check-in takes about 6 minutes.`, welcomeSub: "I will speak each instruction. You answer by speaking. There is no typing and no right or wrong for most questions. A family member can help if needed.",
      helper: "Someone is helping me today", consentT: "What you agreed to share", hearQ: "Can you hear me clearly?", play: "Play sound",
      yes: "Yes", no: "No", noiseQ: "Let's check the room is quiet enough.", noiseBtn: "Check the room", seeQ: "Can you read this text easily?",
      wordsL: "I will say 10 words. Listen carefully and try to remember them.", wordsR: "Now say all the words you remember, in any order.",
      storyL: "I will tell you a short story. Listen carefully.", storyR: "Now tell me the story with as much detail as you can remember.",
      flu: (c) => `Say as many ${c} as you can in one minute.`, judg: "Listen to this situation and tell me what you would do.",
      delayed: "Earlier I said 10 words. Say all the words you still remember.",
      tap: "Tap to speak", stop: "Tap when finished", listening: "Listening…", typed: "Microphone not available here. Type what the person said, or use a sample answer.",
      sampleGood: "Sample: typical answer", sampleWeak: "Sample: weaker answer",
      moodT: "How have you been feeling?", moodSub: "Over the last 2 weeks, how often have you been bothered by:",
      phq: ["Having little interest or pleasure in doing things", "Feeling down, depressed or hopeless"],
      gad: ["Feeling nervous, anxious or on edge", "Not being able to stop or control worrying"],
      freq: ["Not at all", "Several days", "More than half the days", "Nearly every day"],
      sleepQ: "How many hours did you usually sleep each night this week?", sleepO: ["Less than 5", "5 to 6", "6 to 7", "7 to 8", "More than 8"],
      illQ: "In the last 2 weeks, have you been ill or started a new medicine?",
      finish: "Finish", doneT: "Thank you", planT: "Things that help keep your brain healthy", next_session: "Next check-in",
      behind: "Demo transparency: what the system did", openClin: "Open in clinician dashboard",
      a11y: "Display", larger: "Larger text", contrast: "High contrast", slow: "Slower speech",
    },
    ar: {
      choose: "من سيقوم بالفحص؟", chooseSub: "اختر مشاركاً لمتابعة فحوصاته، أو ابدأ مع شخص جديد.",
      newp: "مشارك جديد", start: "ابدأ", next: "التالي", back: "رجوع", repeat: "أعد التعليمات", skip: "تخطَّ",
      welcome: (n) => `مرحباً ${n}. يستغرق هذا الفحص حوالي 6 دقائق.`, welcomeSub: "سأقرأ لك كل تعليمات بصوت مسموع، وأنت تجيب بالكلام. لا حاجة للكتابة. يمكن لأحد أفراد العائلة المساعدة عند الحاجة.",
      helper: "هناك من يساعدني اليوم", consentT: "ما وافقت على مشاركته", hearQ: "هل تسمعني بوضوح؟", play: "شغّل الصوت",
      yes: "نعم", no: "لا", noiseQ: "لنتأكد أن المكان هادئ بما يكفي.", noiseBtn: "افحص المكان", seeQ: "هل تستطيع قراءة هذا النص بسهولة؟",
      wordsL: "سأقول 10 كلمات. استمع جيداً وحاول أن تتذكرها.", wordsR: "الآن قل كل الكلمات التي تتذكرها، بأي ترتيب.",
      storyL: "سأحكي لك قصة قصيرة. استمع جيداً.", storyR: "الآن احكِ لي القصة بأكبر قدر من التفاصيل التي تتذكرها.",
      flu: (c) => `قل أكبر عدد ممكن من ${c} خلال دقيقة واحدة.`, judg: "استمع إلى هذا الموقف وقل لي ماذا تفعل.",
      delayed: "قلت لك قبل قليل 10 كلمات. قل كل الكلمات التي ما زلت تتذكرها.",
      tap: "اضغط وتكلم", stop: "اضغط عند الانتهاء", listening: "أستمع…", typed: "الميكروفون غير متاح هنا. اكتب ما قاله الشخص، أو استخدم إجابة نموذجية.",
      sampleGood: "نموذج: إجابة معتادة", sampleWeak: "نموذج: إجابة أضعف",
      moodT: "كيف كان شعورك؟", moodSub: "خلال الأسبوعين الماضيين، كم مرة انزعجت من:",
      phq: ["قلة الاهتمام أو المتعة في القيام بالأشياء", "الشعور بالحزن أو الاكتئاب أو اليأس"],
      gad: ["الشعور بالتوتر أو القلق أو العصبية", "عدم القدرة على إيقاف القلق أو التحكم فيه"],
      freq: ["أبداً", "عدة أيام", "أكثر من نصف الأيام", "تقريباً كل يوم"],
      sleepQ: "كم ساعة كنت تنام عادةً كل ليلة هذا الأسبوع؟", sleepO: ["أقل من 5", "من 5 إلى 6", "من 6 إلى 7", "من 7 إلى 8", "أكثر من 8"],
      illQ: "خلال الأسبوعين الماضيين، هل كنت مريضاً أو بدأت دواءً جديداً؟",
      finish: "إنهاء", doneT: "شكراً لك", planT: "أمور تساعد في الحفاظ على صحة دماغك", next_session: "الفحص القادم",
      behind: "شفافية العرض: ماذا فعل النظام", openClin: "افتح في لوحة الطبيب",
      a11y: "العرض", larger: "خط أكبر", contrast: "تباين عالٍ", slow: "كلام أبطأ",
    },
  };
  const STEPS = ["welcome", "hear", "noise", "see", "words_listen", "words_recall", "story_listen", "story_recall", "fluency", "judgement", "delayed", "mood", "sleep", "done"];

  function newPt(person) {
    const idx = person.sessions.length;
    return { pid: person.id, lang: person.language, step: "welcome", form: E.formForSession(idx, hashSeed(person.id)), tr: {}, audio: {}, vf: {},
             precheck: { hearing_ok: true, vision_ok: true, noise_ok: true }, phq: [0, 0], gad: [0, 0], sleep: 6.5, ill: false,
             assisted: false, big: false, hc: false, slow: false, noiseDb: null, result: null };
  }
  function hashSeed(id) { let h = 0; for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) % 997; return h % 3; }
  const L = () => T[S.pt.lang];
  const person = (id) => S.people.find((p) => p.id === id);

  // --- speech output
  let voices = []; try { speechSynthesis.onvoiceschanged = () => (voices = speechSynthesis.getVoices()); voices = speechSynthesis.getVoices(); } catch (e) {}
  function speak(text, lang, onend) {
    try {
      speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(text);
      u.lang = lang === "ar" ? "ar-AE" : "en-GB"; u.rate = S.pt && S.pt.slow ? 0.75 : 0.9;
      const v = voices.find((v) => v.lang && v.lang.toLowerCase().startsWith(lang)); if (v) u.voice = v;
      if (onend) u.onend = onend; speechSynthesis.speak(u);
    } catch (e) { if (onend) setTimeout(onend, 600); }
  }

  // --- speech input + on-device acoustic features (audio never leaves the device)
  const Rec = {
    active: false, fallback: false, async start(lang, onText) {
      this.text = ""; this.frames = []; this.t0 = performance.now(); this.clip = 0; this.samples = 0;
      try {
        this.stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, sampleRate: 16000 } });
        this.ctx = new (window.AudioContext || window.webkitAudioContext)(); const src = this.ctx.createMediaStreamSource(this.stream);
        this.an = this.ctx.createAnalyser(); this.an.fftSize = 1024; src.connect(this.an); const buf = new Float32Array(this.an.fftSize);
        this.iv = setInterval(() => { this.an.getFloatTimeDomainData(buf); let s = 0; for (const x of buf) { s += x * x; if (Math.abs(x) > 0.99) this.clip++; this.samples++; }
          const db = 10 * Math.log10(s / buf.length + 1e-10); this.frames.push(db); const m = $("#lvl"); if (m) m.style.width = Math.max(0, Math.min(100, (db + 60) * 1.8)) + "%"; }, 50);
      } catch (e) { this.fallback = true; return false; }
      const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (SR) {
        this.sr = new SR(); this.sr.lang = lang === "ar" ? "ar-AE" : "en-US"; this.sr.continuous = true; this.sr.interimResults = true;
        this.sr.onresult = (ev) => { let f = ""; for (let i = 0; i < ev.results.length; i++) f += ev.results[i][0].transcript + " "; this.text = f.trim(); onText && onText(this.text); };
        this.sr.onerror = () => {}; try { this.sr.start(); } catch (e) {}
      }
      this.active = true; return true;
    },
    stop(noiseDb) {
      this.active = false; clearInterval(this.iv); try { this.sr && this.sr.stop(); } catch (e) {}
      try { this.stream.getTracks().forEach((t) => t.stop()); this.ctx.close(); } catch (e) {}
      const dur = (performance.now() - this.t0) / 1000; const fr = this.frames;
      const floor = noiseDb ?? (fr.length ? [...fr].sort((a, b) => a - b)[Math.floor(fr.length * 0.1)] : -60);
      const speech = fr.map((d) => d > floor + 10); const sp = speech.filter(Boolean).length;
      let pauses = 0, run = 0, pauseLens = []; speech.forEach((s) => { if (!s) run++; else { if (run * 0.05 >= 0.25) { pauses++; pauseLens.push(run * 0.05); } run = 0; } });
      const spDb = fr.filter((d, i) => speech[i]); const meanSp = spDb.length ? spDb.reduce((a, b) => a + b, 0) / spDb.length : floor;
      const words = (this.text || "").split(/\s+/).filter(Boolean);
      return { audio: { snr_db: +(meanSp - floor).toFixed(1), clipping: this.samples ? +(this.clip / this.samples).toFixed(4) : 0, speech_ratio: fr.length ? +(sp / fr.length).toFixed(2) : 0, duration_s: +dur.toFixed(1) },
               features: { speech_rate_wpm: sp ? +(words.length / (sp * 0.05 / 60)).toFixed(1) : 0, pause_count: pauses, mean_pause_s: pauseLens.length ? +(pauseLens.reduce((a, b) => a + b, 0) / pauseLens.length).toFixed(2) : 0,
                           type_token_ratio: words.length ? +(new Set(words).size / words.length).toFixed(2) : 0, word_count: words.length } };
    },
  };

  function samples(task, form, lang) {
    const it = D.items;
    const wl = it.WORD_LISTS[form][lang]; const lex = it.FLUENCY_LEXICON[form][lang].split(" ");
    const st = it.STORIES[form][lang]; const rub = it.JUDGEMENT[form].rubric[lang];
    const parts = st.split(/[.،,]/).filter((x) => x.trim());
    return {
      words_recall: [wl.slice(0, 7).join(" "), wl.slice(0, 4).join(" ")],
      delayed: [wl.slice(1, 7).join(" "), wl.slice(0, 2).join(" ")],
      story_recall: [parts.slice(0, 4).join(" "), parts[0].split(" ").slice(0, 6).join(" ")],
      fluency: [lex.slice(0, 17).join(" "), lex.slice(0, 8).join(" ")],
      judgement: [rub.map((r) => r[0]).join(" "), rub[0][0]],
    }[task];
  }

  function renderParticipant() {
    if (!S.pt) return renderChoose();
    const pt = S.pt, l = L(), p = person(pt.pid), ar = pt.lang === "ar";
    document.body.classList.toggle("hc", pt.hc); document.documentElement.style.setProperty("--fs", pt.big ? "19px" : "16px");
    const si = STEPS.indexOf(pt.step);
    $("#main").innerHTML = `<div class="pt-wrap">
      <div class="panel phone ${ar ? "ar" : ""}" dir="${ar ? "rtl" : "ltr"}" lang="${pt.lang}">
        <div class="bar"><button class="btn ghost" id="pt-exit" title="Exit">✕</button><div class="progress"><i style="width:${(si / (STEPS.length - 1)) * 100}%"></i></div>
          <button class="btn ghost" id="pt-lang">${ar ? "English" : "عربي"}</button></div>
        <div class="body" id="pt-body"></div>
        <div class="foot" id="pt-foot"></div>
      </div>
      <aside class="side grid" dir="${ar ? "rtl" : "ltr"}">
        <div class="panel pad"><h3>${l.a11y}</h3>
          <label class="check"><input type="checkbox" id="a-big" ${pt.big ? "checked" : ""}> ${l.larger}</label>
          <label class="check"><input type="checkbox" id="a-hc" ${pt.hc ? "checked" : ""}> ${l.contrast}</label>
          <label class="check"><input type="checkbox" id="a-slow" ${pt.slow ? "checked" : ""}> ${l.slow}</label>
          <label class="check"><input type="checkbox" id="a-help" ${pt.assisted ? "checked" : ""}> ${l.helper}</label></div>
        <div class="panel pad small" dir="ltr"><h3>Demo notes</h3>
          <div><b>${esc(p.display_name.en)}</b> · ${p.age} y · ${EDU[p.education]} · ${esc(p.dialect)}</div>
          <div class="muted" style="margin-top:6px">${esc(p.story || "New participant.")}</div>
          <div style="margin-top:8px">Session ${p.sessions.length + 1}, alternate form <b>${pt.form}</b></div>
          <div class="muted tiny" style="margin-top:8px">Hosted preview: browsers block the microphone inside embedded pages, so answers are typed or sampled. Run the repo locally for live speech recognition and on-device voice features.</div></div>
      </aside></div>`;
    $("#pt-exit").onclick = () => { try { speechSynthesis.cancel(); } catch (e) {} S.pt = null; render(); };
    $("#pt-lang").onclick = () => { pt.lang = ar ? "en" : "ar"; render(); };
    $("#a-big").onchange = (e) => { pt.big = e.target.checked; render(); };
    $("#a-hc").onchange = (e) => { pt.hc = e.target.checked; render(); };
    $("#a-slow").onchange = (e) => { pt.slow = e.target.checked; };
    $("#a-help").onchange = (e) => { pt.assisted = e.target.checked; };
    STEP[pt.step](pt, l, p);
  }
  function foot(prev, nextFn, nextLabel, disabled) {
    const l = L();
    $("#pt-foot").innerHTML = `<button class="btn" id="f-back" ${prev ? "" : "disabled"}>${l.back}</button><button class="btn primary big" id="f-next" ${disabled ? "disabled" : ""}>${nextLabel || l.next}</button>`;
    $("#f-back").onclick = () => { S.pt.step = STEPS[Math.max(0, STEPS.indexOf(S.pt.step) - 1)]; render(); };
    $("#f-next").onclick = nextFn || (() => { S.pt.step = STEPS[STEPS.indexOf(S.pt.step) + 1]; render(); });
  }
  const nextStep = () => { S.pt.step = STEPS[STEPS.indexOf(S.pt.step) + 1]; render(); };
  function sayBlock(text) {
    const l = L();
    return `<div class="say">${esc(text)}</div><div><button class="btn" id="rep">🔊 ${l.repeat}</button></div>`;
  }
  function bindRepeat(text) { const b = $("#rep"); if (b) b.onclick = () => speak(text, S.pt.lang); }

  function recordBlock(task) {
    const pt = S.pt, l = L(); const [good, weak] = samples(task, pt.form, pt.lang);
    return `<button class="mic" id="mic">${l.tap}</button><div class="meter"><i id="lvl"></i></div>
      <div class="small muted" id="rec-status"></div>
      <textarea id="tr" placeholder="…">${esc(pt.tr[task] || "")}</textarea>
      <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn small" id="s-good" data-t="${esc(good)}">${l.sampleGood}</button><button class="btn small" id="s-weak" data-t="${esc(weak)}">${l.sampleWeak}</button></div>`;
  }
  function bindRecord(task) {
    const pt = S.pt, l = L(); const ta = $("#tr");
    ta.oninput = () => (pt.tr[task] = ta.value);
    ["#s-good", "#s-weak"].forEach((id) => ($(id).onclick = (e) => { ta.value = e.target.dataset.t; pt.tr[task] = ta.value; }));
    $("#mic").onclick = async () => {
      const m = $("#mic");
      if (!Rec.active) {
        const ok = await Rec.start(pt.lang, (t) => { ta.value = t; pt.tr[task] = t; });
        if (!ok) { $("#rec-status").textContent = l.typed; m.disabled = true; return; }
        m.classList.add("rec"); m.textContent = l.stop; $("#rec-status").textContent = l.listening;
      } else {
        const r = Rec.stop(pt.noiseDb); m.classList.remove("rec"); m.textContent = l.tap;
        pt.audio[task] = r.audio; pt.vf[task] = r.features;
        $("#rec-status").textContent = `SNR ${r.audio.snr_db} dB · speech ${Math.round(r.audio.speech_ratio * 100)}% · ${r.audio.duration_s}s`;
      }
    };
    if (Rec.fallback) { $("#rec-status").textContent = l.typed; }
  }

  const STEP = {
    welcome(pt, l, p) {
      const name = p.display_name[pt.lang] || p.display_name.en; const txt = l.welcome(name);
      const cons = Object.entries(p.consent || {}).map(([k, v]) => `<span class="chip ${v ? "on" : "off"}">${k.replace(/_/g, " ")}</span>`).join("");
      $("#pt-body").innerHTML = sayBlock(txt) + `<p class="muted">${l.welcomeSub}</p><div><div class="small" style="font-weight:600">${l.consentT}</div>${cons}</div>`;
      bindRepeat(txt + " " + l.welcomeSub); foot(false, null, l.start); speak(txt, pt.lang);
    },
    hear(pt, l) {
      $("#pt-body").innerHTML = sayBlock(l.hearQ) + `<button class="btn big" id="play">🔊 ${l.play}</button><div class="opts"><button class="opt" data-v="1">${l.yes}</button><button class="opt" data-v="0">${l.no}</button></div>`;
      bindRepeat(l.hearQ); $("#play").onclick = () => speak(l.hearQ, pt.lang);
      document.querySelectorAll(".opt").forEach((b) => (b.onclick = () => { pt.precheck.hearing_ok = b.dataset.v === "1"; nextStep(); }));
      foot(true, null, l.skip);
    },
    noise(pt, l) {
      $("#pt-body").innerHTML = sayBlock(l.noiseQ) + `<button class="btn big" id="nz">🎙️ ${l.noiseBtn}</button><div class="meter"><i id="lvl"></i></div><div id="nzr" class="small muted"></div>`;
      bindRepeat(l.noiseQ);
      $("#nz").onclick = async () => {
        const ok = await Rec.start(pt.lang); if (!ok) { $("#nzr").textContent = l.typed; return; }
        $("#nzr").textContent = "…"; setTimeout(() => { const fr = Rec.frames.slice(); Rec.stop(); const med = fr.sort((a, b) => a - b)[Math.floor(fr.length / 2)] ?? -60; pt.noiseDb = med; pt.precheck.noise_ok = med < -45;
          $("#nzr").textContent = `Room level ${med.toFixed(0)} dBFS — ${pt.precheck.noise_ok ? "OK" : "noisy: please move somewhere quieter"}`; }, 2500);
      };
      foot(true, null);
    },
    see(pt, l) {
      $("#pt-body").innerHTML = sayBlock(l.seeQ) + `<div class="wordshow" style="font-size:1.6em">${pt.lang === "ar" ? "الشمس مشرقة اليوم" : "The sun is bright today"}</div><div class="opts"><button class="opt" data-v="1">${l.yes}</button><button class="opt" data-v="0">${l.no}</button></div>`;
      bindRepeat(l.seeQ); document.querySelectorAll(".opt").forEach((b) => (b.onclick = () => { pt.precheck.vision_ok = b.dataset.v === "1"; nextStep(); }));
      foot(true, null, l.skip);
    },
    words_listen(pt, l) {
      const words = D.items.WORD_LISTS[pt.form][pt.lang];
      $("#pt-body").innerHTML = sayBlock(l.wordsL) + `<div class="wordshow" id="ws"></div><button class="btn big primary" id="pw">▶ ${l.play}</button>`;
      bindRepeat(l.wordsL);
      $("#pw").onclick = () => { let i = 0; const gap = pt.slow ? 2200 : 1600; const tick = () => { if (i >= words.length) { $("#ws").textContent = "✓"; return; } $("#ws").textContent = words[i]; speak(words[i], pt.lang); i++; setTimeout(tick, gap); }; speak(l.wordsL, pt.lang, tick); };
      foot(true, null);
    },
    words_recall(pt, l) { $("#pt-body").innerHTML = sayBlock(l.wordsR) + recordBlock("words_recall"); bindRepeat(l.wordsR); bindRecord("words_recall"); foot(true, null); speak(l.wordsR, pt.lang); },
    story_listen(pt, l) {
      const st = D.items.STORIES[pt.form][pt.lang];
      $("#pt-body").innerHTML = sayBlock(l.storyL) + `<button class="btn big primary" id="ps">▶ ${l.play}</button><div class="small muted" id="cap" style="display:none">${esc(st)}</div>`;
      bindRepeat(l.storyL); $("#ps").onclick = () => { $("#cap").style.display = "block"; speak(l.storyL + " " + st, pt.lang); };
      foot(true, () => { try { speechSynthesis.cancel(); } catch (e) {} nextStep(); });
    },
    story_recall(pt, l) { $("#pt-body").innerHTML = sayBlock(l.storyR) + recordBlock("story_recall"); bindRepeat(l.storyR); bindRecord("story_recall"); foot(true, null); speak(l.storyR, pt.lang); },
    fluency(pt, l) {
      const txt = l.flu(D.items.FLUENCY[pt.form].category[pt.lang]);
      $("#pt-body").innerHTML = sayBlock(txt) + `<div class="timer" id="tm">60</div>` + recordBlock("fluency");
      bindRepeat(txt); bindRecord("fluency"); let t = 60; clearInterval(S._tm);
      $("#mic").addEventListener("click", () => { if (S._tm) return; S._tm = setInterval(() => { t--; const el = $("#tm"); if (!el) { clearInterval(S._tm); S._tm = null; return; } el.textContent = t; if (t <= 0) { clearInterval(S._tm); S._tm = null; if (Rec.active) $("#mic").click(); } }, 1000); });
      foot(true, () => { clearInterval(S._tm); S._tm = null; nextStep(); }); speak(txt, pt.lang);
    },
    judgement(pt, l) {
      const q = D.items.JUDGEMENT[pt.form][pt.lang];
      $("#pt-body").innerHTML = sayBlock(q) + `<div class="small muted">${l.judg}</div>` + recordBlock("judgement"); bindRepeat(q); bindRecord("judgement"); foot(true, null); speak(l.judg + " " + q, pt.lang);
    },
    delayed(pt, l) { $("#pt-body").innerHTML = sayBlock(l.delayed) + recordBlock("delayed"); bindRepeat(l.delayed); bindRecord("delayed"); foot(true, null); speak(l.delayed, pt.lang); },
    mood(pt, l) {
      const qs = [...l.phq.map((q, i) => ["phq", i, q]), ...l.gad.map((q, i) => ["gad", i, q])];
      $("#pt-body").innerHTML = `<div class="say">${l.moodT}</div><div class="muted">${l.moodSub}</div>` + qs.map(([k, i, q]) =>
        `<div><div style="font-weight:600;margin:6px 0">${esc(q)}</div><div class="seg">${l.freq.map((f, v) => `<button data-k="${k}" data-i="${i}" data-v="${v}" class="${pt[k][i] === v ? "on" : ""}">${f}</button>`).join("")}</div></div>`).join("");
      document.querySelectorAll(".seg button").forEach((b) => (b.onclick = () => { pt[b.dataset.k][+b.dataset.i] = +b.dataset.v; renderParticipant(); }));
      foot(true, null); speak(l.moodT + ". " + l.moodSub, pt.lang);
    },
    sleep(pt, l) {
      const hrs = [4.5, 5.5, 6.5, 7.5, 8.5];
      $("#pt-body").innerHTML = `<div class="say">${l.sleepQ}</div><div class="opts">${l.sleepO.map((o, i) => `<button class="opt ${pt.sleep === hrs[i] ? "sel" : ""}" data-h="${hrs[i]}">${o}</button>`).join("")}</div>
        <div class="say" style="font-size:1.15em;margin-top:8px">${l.illQ}</div><div class="seg"><button data-ill="1" class="${pt.ill ? "on" : ""}">${l.yes}</button><button data-ill="0" class="${!pt.ill ? "on" : ""}">${l.no}</button></div>`;
      document.querySelectorAll(".opt").forEach((b) => (b.onclick = () => { pt.sleep = +b.dataset.h; renderParticipant(); }));
      document.querySelectorAll("[data-ill]").forEach((b) => (b.onclick = () => { pt.ill = b.dataset.ill === "1"; renderParticipant(); }));
      foot(true, submitSession, l.finish); speak(l.sleepQ, pt.lang);
    },
    done(pt, l, p) {
      const r = pt.result; const ev = r.ev; const key = ev.valid ? ev.level : "INVALID";
      const msg = D.messages[key][pt.lang === "ar" ? 1 : 0];
      const support = ev.confounders.some((c) => c.code === "mood") ? D.messages.MOOD_SUPPORT[pt.lang === "ar" ? 1 : 0] : null;
      const showPlan = ["BASELINE", "STABLE", "CHECK_AGAIN"].includes(ev.level);
      const plan = (p.prevention && p.prevention[pt.lang]) ? p.prevention[pt.lang].items : [];
      const nxt = { BASELINE: pt.lang === "ar" ? "بعد أسبوعين" : "in 2 weeks", STABLE: pt.lang === "ar" ? "بعد 6 أشهر" : "in 6 months", CHECK_AGAIN: pt.lang === "ar" ? "بعد 2 إلى 4 أسابيع" : "in 2–4 weeks" }[key];
      $("#pt-body").innerHTML = `<div class="say">${l.doneT}</div>
        <div class="result-card lv-${ev.held_for_clinician ? "BASELINE" : key}" style="font-size:1.1em">${esc(msg)}</div>
        ${support ? `<div class="result-card" style="background:var(--sand-soft)">${esc(support)}</div>` : ""}
        ${nxt ? `<div><b>${l.next_session}:</b> ${nxt}</div>` : ""}
        ${showPlan && plan.length ? `<div><h3>${l.planT}</h3><ul>${plan.map((x) => `<li style="margin-bottom:6px">${esc(x.text)}</li>`).join("")}</ul></div>` : ""}
        <details class="panel pad small" dir="ltr" style="text-align:left"><summary><b>${T.en.behind}</b></summary>
          <div style="margin-top:8px">Level: ${pill(ev.level)} ${ev.held_for_clinician ? "<b>· held for clinician review — participant sees no score</b>" : ""}</div>
          <div>Raw scores (form ${pt.form}): ${Object.entries(r.raw).map(([k, v]) => `${E.DLABEL[k]} <b>${v}</b>`).join(" · ")}</div>
          <ul>${ev.reasons.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>
          ${r.unverified.length ? `<div class="muted">Fluency words outside lexicon routed to human audit: ${esc(r.unverified.join(", "))}</div>` : ""}
          <button class="btn primary" id="toClin" style="margin-top:8px">${T.en.openClin} →</button></details>`;
      $("#toClin").onclick = () => { S.selected = p.id; S.pt = null; go("clinician"); };
      $("#pt-foot").innerHTML = `<span></span><button class="btn primary" id="again">${pt.lang === "ar" ? "تم" : "Done"}</button>`;
      $("#again").onclick = () => { S.pt = null; render(); };
      speak(msg, pt.lang);
    },
  };

  function submitSession() {
    const pt = S.pt, p = person(pt.pid);
    const tr = { memory_immediate: pt.tr.words_recall || "", memory_delayed: pt.tr.delayed || "", fluency: pt.tr.fluency || "", story_recall: pt.tr.story_recall || "", judgement: pt.tr.judgement || "" };
    const sc = E.scoreTranscripts(tr, pt.form, pt.lang);
    const last = p.sessions[p.sessions.length - 1];
    const d = last ? new Date(Date.parse(last.date) + 21 * 86400000) : new Date("2026-11-13");
    const audios = Object.values(pt.audio); const vfs = Object.values(pt.vf);
    const audio = audios.length ? { snr_db: Math.min(...audios.map((a) => a.snr_db)), clipping: Math.max(...audios.map((a) => a.clipping)),
                                    speech_ratio: audios.reduce((a, b) => a + b.speech_ratio, 0) / audios.length, duration_s: Math.min(...audios.map((a) => a.duration_s)) } : null;
    const s = { session_id: `${p.id}-s${p.sessions.length}`, date: d.toISOString().slice(0, 10), channel: "app", form: pt.form, raw: sc.raw, audio,
                precheck: { ...pt.precheck }, phq2: pt.phq[0] + pt.phq[1], gad2: pt.gad[0] + pt.gad[1], sleep_hours: pt.sleep, acute_illness: pt.ill,
                assisted: pt.assisted, helper_role: pt.assisted ? "family member" : null, input_mode: audio ? "voice" : "typed (demo)",
                voice_features: (p.consent || {}).voice_features && vfs.length ? vfs.reduce((acc, f) => { for (const k in f) acc[k] = +(((acc[k] || 0) + f[k] / vfs.length)).toFixed(2); return acc; }, {}) : null, transcripts: tr };
    p.sessions.push(s);
    const ev = E.evaluate(p, p.sessions).latest;
    S.audit.unshift({ ts: new Date().toISOString().slice(0, 19).replace("T", " "), actor: "participant app", action: "session_submitted", target: p.id, detail: ev.level });
    pt.result = { ev, raw: sc.raw, unverified: sc.detail.fluency.unverified };
    pt.step = "done"; render();
  }

  function renderChoose() {
    document.body.classList.remove("hc"); document.documentElement.style.setProperty("--fs", "16px");
    const cards = S.people.map((p) => {
      const lv = p.sessions.length ? E.evaluate(p, p.sessions).latest.level : "BASELINE";
      return `<div class="panel pad" style="display:flex;flex-direction:column;gap:8px">
        <div style="display:flex;justify-content:space-between;align-items:center"><div><b style="font-size:17px">${esc(p.display_name.en)}</b> <span class="ar muted">${esc(p.display_name.ar)}</span></div>${pill(lv)}</div>
        <div class="small muted">${p.age} y · ${EDU[p.education]} · ${esc(p.dialect)} · ${p.sessions.length} sessions</div>
        <div class="small" style="flex:1">${esc(p.story || "")}</div>
        <div style="display:flex;gap:8px"><button class="btn primary" data-go="${p.id}" data-lang="${p.language}">Start check-in (${p.language === "ar" ? "عربي" : "English"})</button>
        <button class="btn" data-go="${p.id}" data-lang="${p.language === "ar" ? "en" : "ar"}">${p.language === "ar" ? "English" : "عربي"}</button></div></div>`;
    }).join("");
    $("#main").innerHTML = `<div style="display:flex;justify-content:space-between;align-items:flex-end;gap:16px;flex-wrap:wrap;margin-bottom:14px">
      <div><h2>Voice-first check-in</h2><div class="muted">${T.en.chooseSub}</div></div>
      <div class="panel pad small" style="max-width:520px"><b>New participant.</b> Enrolled by a coordinator with consent recorded for each data type.
        <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:8px;align-items:center">
        <select id="np-age" class="btn">${[52, 57, 63, 68, 73].map((a) => `<option>${a}</option>`).join("")}</select>
        <select id="np-edu" class="btn">${Object.entries(EDU).map(([k, v]) => `<option value="${k}">${v}</option>`).join("")}</select>
        <select id="np-lang" class="btn"><option value="ar">عربي (Emirati)</option><option value="en">English</option></select>
        <button class="btn primary" id="np-go">Enrol &amp; start</button></div></div></div>
      <div class="grid" style="grid-template-columns:repeat(auto-fill,minmax(330px,1fr))">${cards}</div>`;
    document.querySelectorAll("[data-go]").forEach((b) => (b.onclick = () => { S.pt = newPt(person(b.dataset.go)); S.pt.lang = b.dataset.lang; render(); }));
    $("#np-go").onclick = () => {
      const lang = $("#np-lang").value; const id = "MB-" + (2000 + S.people.length);
      const np = { id, display_name: { en: "New participant", ar: "مشارك جديد" }, age: +$("#np-age").value, age_band: "", sex: "U", education: $("#np-edu").value,
                   dialect: lang === "ar" ? "Emirati" : "English", language: lang, story: "Enrolled during this demo.", context: {},
                   consent: { voice_features: true, wearables: false, clinical_record: false, family_history: true, genomics: false, raw_audio: false }, sessions: [],
                   prevention: { en: { items: [{ text: "Aim for 150 minutes of moving each week, for example a 30-minute walk after Maghrib on five days." }, { text: "Keep your mind active: reading, Quran memorisation, learning a skill, or games with grandchildren all count." }] },
                                 ar: { items: [{ text: "حاول أن تتحرك 150 دقيقة في الأسبوع، مثل المشي 30 دقيقة بعد المغرب خمسة أيام." }, { text: "حافظ على نشاط عقلك: القراءة، حفظ القرآن، تعلّم مهارة جديدة، أو اللعب مع الأحفاد." }] } },
                   risk_context: { modifiable_factors_present: [], count: 0, of: 14, reversible_cause_checks: [] } };
      S.people.push(np); S.pt = newPt(np); S.pt.lang = lang; render();
    };
  }

  // ================================================================ CLINICIAN
  function queueItems() {
    return S.people.map((p) => {
      const ev = p.sessions.length ? E.evaluate(p, p.sessions) : null; const lv = ev ? ev.latest.level : "BASELINE";
      const acts = S.actions[p.id] || []; const closed = acts.some((a) => ["dismiss", "refer", "confirm_concern"].includes(a.action) && a.session === ev?.latest?.session_id);
      return { p, ev, lv, closed };
    }).sort((a, b) => E.LEVELS.indexOf(b.lv) - E.LEVELS.indexOf(a.lv));
  }
  function renderClinician() {
    const items = queueItems(); const sel = items.find((x) => x.p.id === S.selected) || items[0];
    const open = items.filter((x) => (x.lv === "URGENT" || x.lv === "CLINICIAN_REVIEW") && !x.closed);
    const q = (x) => {
      const due = x.ev ? new Date(Date.parse(x.ev.latest.date) + (C.REVIEW_TARGET_DAYS[x.lv] || 0) * 86400000).toISOString().slice(0, 10) : "";
      return `<div class="qitem ${x.p.id === sel.p.id ? "sel" : ""}" data-id="${x.p.id}"><div class="row"><b>${esc(x.p.id)}</b>${pill(x.lv)}</div>
        <div class="small muted">${x.p.age} y · ${EDU[x.p.education]} · ${esc(x.p.dialect)}</div>
        ${x.ev ? `<div class="small">${esc(x.ev.latest.reasons[0] || "")}</div>` : ""}
        ${C.REVIEW_TARGET_DAYS[x.lv] ? `<div class="tiny muted">Review target: ${due}${x.closed ? " · closed" : ""}</div>` : ""}</div>`;
    };
    $("#main").innerHTML = `<div class="cl-wrap">
      <div class="panel" style="overflow:hidden"><div class="pad" style="border-bottom:1px solid var(--line)"><h3 style="margin:0">Review queue</h3>
        <div class="small muted">${open.length} open alert${open.length === 1 ? "" : "s"}, sorted by urgency</div></div>
        ${items.map(q).join("")}</div>
      <div id="detail" class="grid"></div></div>`;
    document.querySelectorAll(".qitem").forEach((el) => (el.onclick = () => { S.selected = el.dataset.id; renderClinician(); }));
    renderDetail(sel);
  }

  function renderDetail(x) {
    const p = x.p, ev = x.ev; const el = $("#detail");
    if (!ev) { el.innerHTML = `<div class="panel pad">No sessions yet.</div>`; return; }
    const L_ = ev.latest; const c = p.context || {}; const rc = p.risk_context || {};
    const consent = Object.entries(p.consent || {}).map(([k, v]) => `<span class="chip ${v ? "on" : "off"}">${k.replace(/_/g, " ")}</span>`).join("");
    const drivers = L_.drivers.length ? `<table><tr><th>Input</th><th class="num">Value</th><th class="num">Threshold</th><th class="num">Change</th></tr>${L_.drivers.map((d) =>
      `<tr><td>${esc(d.input)}</td><td class="num">${d.metric ? d.metric + " " : ""}${fmt(d.value)}</td><td class="num">${d.metric ? "≤ " : ""}${fmt(d.threshold)}</td><td class="num">${d.change != null ? fmt(d.change) : "–"}</td></tr>`).join("")}</table>` : `<div class="small muted">No input crossed an alert threshold.</div>`;
    const confKeys = [["mood", "Mood / anxiety (PHQ-2, GAD-2)"], ["sleep", "Sleep (wearable / self-report)"], ["illness_medication", "Acute illness / new medication"], ["sensory", "Hearing / vision pre-check"], ["assisted", "Assisted session"]];
    const cs = new Set(L_.confounders.map((k) => k.code)); const last = p.sessions.find((s) => s.session_id === L_.session_id) || {};
    const confHtml = confKeys.map(([k, lab]) => `<div class="check"><b style="color:${cs.has(k) ? "var(--check)" : "var(--stable)"}">${cs.has(k) ? "⚠" : "✓"}</b><div>${lab}${cs.has(k) ? ` — <span class="muted">${esc(L_.confounders.find((z) => z.code === k).action)}</span>` : ""}</div></div>`).join("") +
      `<div class="check"><b style="color:${L_.valid ? "var(--stable)" : "var(--check)"}">${L_.valid ? "✓" : "⚠"}</b><div>Audio quality gate${last.audio ? ` (SNR ${fmt(last.audio.snr_db, 1)} dB)` : last.input_mode ? ` (${esc(last.input_mode)})` : ""}</div></div>`;
    let domTable = "";
    if (L_.rci) {
      domTable = `<table><tr><th>Domain</th><th class="num">Baseline</th><th class="num">Now</th><th class="num">Practice adj.</th><th class="num">RCI</th><th></th></tr>` +
        Object.entries(L_.rci.domains).map(([d, r]) => { const w = Math.min(50, Math.abs(r.rci) * 12); const neg = r.rci < 0;
          return `<tr><td>${E.DLABEL[d]}${C.TRIGGER_DOMAINS.includes(d) ? ' <span class="tiny muted">(trigger)</span>' : ""}</td><td class="num">${fmt(r.baseline, 1)}</td><td class="num">${fmt(r.current, 0)}</td><td class="num">+${fmt(r.expected_practice, 2)}</td>
          <td class="num" style="color:${r.rci <= C.RCI_DOMAIN_CHECK ? "var(--review)" : "inherit"};font-weight:${r.rci <= C.RCI_DOMAIN_CHECK ? 700 : 400}">${fmt(r.rci)}</td>
          <td><span class="bar-rci"><span class="zero"></span><i style="${neg ? `right:50%` : `left:50%`};width:${w}%;background:${r.rci <= C.RCI_DOMAIN_CHECK ? "var(--review)" : r.rci < 0 ? "var(--sand)" : "var(--stable)"}"></i></span></td></tr>`; }).join("") +
        `<tr><td><b>Composite</b></td><td class="num">${fmt(L_.rci.composite.baseline)}</td><td class="num">${fmt(L_.rci.composite.current)}</td><td class="num">+${fmt(L_.rci.composite.expected_practice)}</td><td class="num"><b>${fmt(L_.rci.composite.rci)}</b></td><td class="tiny muted">90% range of true change: ${L_.change_interval_90.map((v) => fmt(v)).join(" to ")} SD</td></tr></table>`;
    } else if (L_.z) {
      domTable = `<div class="small muted">Change scores start after ${C.BASELINE_SESSIONS} baseline sessions. Education-stratified z-scores so far:</div><table>${Object.entries(L_.z.domains).map(([d, z]) => `<tr><td>${E.DLABEL[d]}</td><td class="num">${fmt(z)}</td></tr>`).join("")}</table>`;
    }
    const ctxRows = [["Blood pressure", c.sbp ? `${Math.round(c.sbp)}/${Math.round(c.dbp)} mmHg` : null, "clinical_record"], ["HbA1c", c.hba1c ? fmt(c.hba1c, 1) + " %" : null, "clinical_record"],
      ["LDL cholesterol", c.ldl ? fmt(c.ldl, 1) + " mmol/L" : null, "clinical_record"], ["BMI", c.bmi ? fmt(c.bmi, 0) : null, "clinical_record"],
      ["Activity", c.activity_min_week != null ? Math.round(c.activity_min_week) + " min/week" : null, "wearables"], ["Sleep (7-day avg)", c.sleep_hours ? fmt(c.sleep_hours, 1) + " h" : null, "wearables"],
      ["Family history of dementia", c.family_history_dementia != null ? (c.family_history_dementia ? "Yes (first-degree)" : "No") : null, "family_history"],
      ["Genomics (APOE)", c.apoe4 || null, "genomics"]].filter((r) => r[1] != null)
      .map(([k, v, src]) => `<tr><td>${k}</td><td>${(p.consent || {})[src] ? esc(v) : '<span class="muted">not consented</span>'}</td><td class="tiny muted">${src.replace("_", " ")}</td></tr>`).join("");
    const acts = (S.actions[p.id] || []).map((a) => `<div class="tiny">${a.ts} · <b>${a.action.replace(/_/g, " ")}</b>${a.note ? " — " + esc(a.note) : ""}</div>`).join("");
    const vf = last.voice_features;
    el.innerHTML = `
      <div class="panel pad"><div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;align-items:flex-start">
        <div><h2 style="margin:0">${esc(p.id)} <span class="muted small" style="font-weight:400">pseudonymous ID</span></h2>
        <div class="small muted">${p.age} y · ${p.sex === "F" ? "female" : p.sex === "M" ? "male" : ""} · ${EDU[p.education]} · ${esc(p.dialect)} · ${p.sessions.length} sessions</div>
        <div style="margin-top:6px">${consent}</div></div>
        <div class="noprint" style="display:flex;gap:6px;flex-wrap:wrap"><button class="btn" id="b-dos">Referral dossier</button><button class="btn" id="b-fhir">FHIR R4 bundle</button></div></div>
        <div class="alertbox lv-${L_.level}" style="margin-top:14px"><div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">${pill(L_.level)}<span class="small muted">Latest session ${L_.date} · form ${L_.form} · ${L_.channel}</span>
          ${L_.held_for_clinician ? '<span class="small"><b>Held:</b> participant was told only that the clinic will contact them.</span>' : ""}</div>
          <ul style="margin:8px 0 4px">${L_.reasons.map((r) => `<li>${esc(r)}</li>`).join("")}</ul>
          ${L_.pathways.length ? `<div class="small"><b>Suggested pathway:</b> ${L_.pathways.map((x) => PATH[x] || x).join(" · ")}</div>` : ""}</div></div>
      <div class="panel pad"><h3>Trend against personal baseline</h3>${trendChart(ev.history)}
        <div class="legend">${["BASELINE", "STABLE", "CHECK_AGAIN", "CLINICIAN_REVIEW", "URGENT"].map((k) => `<span><i style="background:${LVCOL[k]}"></i>${LV[k]}</span>`).join("")}<span><i style="background:#fff;border:1.5px solid #888"></i>Not scored</span></div></div>
      <div class="two">
        <div class="panel pad"><h3>What drove this result</h3>${drivers}<h3 style="margin-top:14px">Domains (raw points, practice-adjusted RCI)</h3>${domTable}</div>
        <div class="grid">
          <div class="panel pad"><h3>Confounders checked</h3>${confHtml}</div>
          <div class="panel pad"><h3>Integrated risk context</h3><table>${ctxRows}</table>
            <div class="small" style="margin-top:8px"><b>${rc.count ?? 0} of ${rc.of ?? 14}</b> modifiable risk factors present (Lancet Commission 2024): ${(rc.modifiable_factors_present || []).map((f) => `<span class="chip">${f === "ldl" ? "high LDL" : f.replace(/_/g, " ")}</span>`).join("")}</div>
            <div class="tiny muted" style="margin-top:6px">Listed with source and value. No combined probability is shown. Genomic results are disclosed to the person only through clinical counselling.</div></div>
        </div></div>
      <div class="two">
        <div class="panel pad"><h3>Reversible causes to consider</h3>${(rc.reversible_cause_checks || []).map((r, i) => `<label class="check"><input type="checkbox"> ${esc(r)}</label>`).join("") || '<div class="small muted">–</div>'}</div>
        <div class="panel pad"><h3>Review actions</h3>
          <div style="display:flex;gap:6px;flex-wrap:wrap" class="noprint">${[["confirm_concern", "Confirm concern"], ["request_repeat", "Request repeat"], ["order_investigations", "Order investigations"], ["refer", "Refer"], ["dismiss", "Dismiss with reason"]].map(([k, v]) => `<button class="btn${k === "refer" ? " primary" : ""}" data-act="${k}">${v}</button>`).join("")}</div>
          <input id="act-note" class="btn" style="width:100%;margin-top:8px;text-align:start" placeholder="Note / reason (required to dismiss)">
          <div style="margin-top:8px">${acts || '<div class="tiny muted">No actions yet. Every action is written to the audit log.</div>'}</div>
          <h3 style="margin-top:14px">Exploratory voice features</h3>
          ${vf ? `<div class="small">${Object.entries(vf).map(([k, v]) => `<span class="chip">${k.replace(/_/g, " ")}: ${v}</span>`).join("")}</div>` : '<div class="small muted">None recorded for the latest session.</div>'}
          <div class="tiny muted">Collected for research under a pre-specified analysis plan. Not used for alerts until validated per language and dialect.</div></div></div>
      <div class="panel pad"><h3>Audit log</h3>${S.audit.slice(0, 8).map((a) => `<div class="tiny">${a.ts} · ${esc(a.actor)} · <b>${esc(a.action)}</b> · ${esc(a.target)} ${esc(a.detail)}</div>`).join("") || '<div class="tiny muted">Empty.</div>'}</div>`;
    if (!S.audit[0] || S.audit[0].target !== p.id || S.audit[0].action !== "view_evaluation") log("view_evaluation", p.id);
    document.querySelectorAll("[data-act]").forEach((b) => (b.onclick = () => {
      const note = $("#act-note").value.trim(); const a = b.dataset.act;
      if (a === "dismiss" && !note) { toast("A reason is required to dismiss an alert"); $("#act-note").focus(); return; }
      (S.actions[p.id] = S.actions[p.id] || []).push({ action: a, note, ts: new Date().toISOString().slice(0, 16).replace("T", " "), session: L_.session_id });
      log("task_" + a, p.id, note); toast("Recorded: " + a.replace(/_/g, " ")); renderClinician();
    }));
    $("#b-dos").onclick = () => showDossier(p, ev);
    $("#b-fhir").onclick = () => { const b = fhirBundle(p, ev); log("export_fhir", p.id); modal(`<h2>FHIR R4 bundle</h2><div class="small muted">Patient (pseudonymous), Consent per signal, Observation, RiskAssessment, Task. The system never writes Condition (clinician-only).</div>
      <div style="margin:10px 0"><button class="btn primary" id="cp">Copy JSON</button> <button class="btn" id="cl">Close</button></div><pre class="code">${esc(JSON.stringify(b, null, 1))}</pre>`);
      $("#cp").onclick = () => navigator.clipboard.writeText(JSON.stringify(b, null, 1)).then(() => toast("Copied"), () => toast("Copy blocked here")); $("#cl").onclick = closeModal; };
  }

  function trendChart(hist) {
    const W = 760, H = 230, pl = 46, pr = 34, pt = 14, pb = 30;
    const pts = hist.map((h) => ({ d: Date.parse(h.date), z: h.z ? h.z.composite : null, lv: h.level, valid: h.valid }));
    const zs = pts.filter((p) => p.z != null).map((p) => p.z); const lo = Math.min(-2.5, ...zs) - 0.2, hi = Math.max(1.5, ...zs) + 0.2;
    const d0 = pts[0].d, d1 = Math.max(pts[pts.length - 1].d, d0 + 86400000 * 30);
    const X = (d) => pl + ((d - d0) / (d1 - d0)) * (W - pl - pr), Y = (z) => pt + ((hi - z) / (hi - lo)) * (H - pt - pb);
    let g = "";
    for (let z = Math.ceil(lo); z <= hi; z++) g += `<line x1="${pl}" x2="${W - pr}" y1="${Y(z)}" y2="${Y(z)}" stroke="#eee7da"/><text x="${pl - 8}" y="${Y(z) + 4}" font-size="11" text-anchor="end" fill="#7a8587">${z}</text>`;
    g += `<rect x="${pl}" y="${Y(1)}" width="${W - pl - pr}" height="${Y(-1) - Y(1)}" fill="#e2efef" opacity=".55"/>`;
    g += `<line x1="${pl}" x2="${W - pr}" y1="${Y(C.LOW_BASELINE_Z)}" y2="${Y(C.LOW_BASELINE_Z)}" stroke="#b2462e" stroke-dasharray="4 4" opacity=".6"/><text x="${W - pr}" y="${Y(C.LOW_BASELINE_Z) - 5}" font-size="10.5" text-anchor="end" fill="#b2462e">below expected for age &amp; education</text>`;
    const lastR = [...hist].reverse().find((h) => h.rci);
    if (lastR) { const c = lastR.rci.composite; const lim = c.baseline + c.expected_practice + C.RCI_CHECK * c.se_diff;
      g += `<line x1="${pl}" x2="${W - pr}" y1="${Y(c.baseline)}" y2="${Y(c.baseline)}" stroke="#0f5c63" stroke-width="1.5"/><text x="${W - pr}" y="${Y(c.baseline) + (lim > c.baseline ? 13 : -5)}" font-size="10.5" text-anchor="end" fill="#0f5c63">personal baseline</text>`;
      g += `<line x1="${pl}" x2="${W - pr}" y1="${Y(lim)}" y2="${Y(lim)}" stroke="#a8661b" stroke-dasharray="6 3"/><text x="${W - pr}" y="${Y(lim) + (lim > c.baseline ? -5 : 13)}" font-size="10.5" text-anchor="end" fill="#a8661b">reliable-change limit (practice-adjusted)</text>`; }
    const v = pts.filter((p) => p.z != null);
    g += `<polyline fill="none" stroke="#9aa6a8" stroke-width="1.5" points="${v.map((p) => X(p.d) + "," + Y(p.z)).join(" ")}"/>`;
    pts.forEach((p) => { if (p.z == null) g += `<circle cx="${X(p.d)}" cy="${H - pb - 6}" r="5" fill="#fff" stroke="#888" stroke-width="1.5"><title>${new Date(p.d).toISOString().slice(0, 10)} not scored</title></circle>`;
      else g += `<circle cx="${X(p.d)}" cy="${Y(p.z)}" r="6" fill="${LVCOL[p.lv]}" stroke="#fff" stroke-width="2"><title>${new Date(p.d).toISOString().slice(0, 10)} · z ${p.z} · ${LV[p.lv]}</title></circle>`; });
    let lastX = -99; pts.forEach((p) => { const x = X(p.d); if (x - lastX < 52) return; lastX = x; g += `<text x="${x}" y="${H - 8}" font-size="10.5" text-anchor="middle" fill="#7a8587">${new Date(p.d).toISOString().slice(2, 10)}</text>`; });
    return `<svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="Composite score over time"><text x="10" y="${H / 2}" font-size="11" fill="#7a8587" transform="rotate(-90 10 ${H / 2})" text-anchor="middle">composite z (education-adjusted)</text>${g}</svg>`;
  }

  function fhirBundle(p, ev) {
    const CS = "https://fhir.membrain.health/CodeSystem"; const cc = (s, c, d) => ({ coding: [{ system: s, code: c, display: d }], text: d });
    let n = 0; const id = (k) => `${p.id}-${k}-${++n}`; const ent = [];
    ent.push({ resourceType: "Patient", id: p.id, gender: { F: "female", M: "male" }[p.sex] || "unknown", extension: [{ url: CS + "/ext/education-band", valueCode: p.education }, { url: CS + "/ext/dialect", valueString: p.dialect }] });
    Object.entries(p.consent || {}).forEach(([k, v]) => ent.push({ resourceType: "Consent", id: id("consent"), status: v ? "active" : "inactive", category: [cc(CS + "/consent-signal", k, k)], patient: { reference: "Patient/" + p.id }, provision: { type: v ? "permit" : "deny" } }));
    ev.history.forEach((h) => {
      const s = p.sessions.find((x) => x.session_id === h.session_id); if (!s || !s.raw) return;
      const o = { resourceType: "Observation", id: id("obs"), status: "final", code: cc(CS + "/digital-marker", "membrain-checkin", "MemBrain voice check-in"), subject: { reference: "Patient/" + p.id }, effectiveDateTime: h.date,
                  component: Object.entries(s.raw).map(([k, v]) => ({ code: cc(CS + "/cognitive-domain", k, k), valueInteger: v })) };
      if (h.z) o.component.push({ code: cc(CS + "/digital-marker", "composite-z", "Education-stratified composite z"), valueQuantity: { value: h.z.composite, unit: "z" } });
      ent.push(o);
      if (h.valid && h.level !== "BASELINE") {
        const ra = { resourceType: "RiskAssessment", id: id("risk"), status: "preliminary", subject: { reference: "Patient/" + p.id }, occurrenceDateTime: h.date, basis: [{ reference: "Observation/" + o.id }],
                     method: cc(CS + "/method", "rci-rules-" + C.ENGINE_VERSION, "Practice-adjusted RCI + confounder rules"), prediction: [{ outcome: cc(CS + "/triage-level", h.level, LV[h.level]), rationale: h.reasons.join("; ") }],
                     note: [{ text: "Risk/change identification only. Not a diagnosis." }] };
        ent.push(ra);
        if (h.held_for_clinician) ent.push({ resourceType: "Task", id: id("task"), status: "requested", intent: "order", priority: h.level === "URGENT" ? "urgent" : "routine", for: { reference: "Patient/" + p.id }, focus: { reference: "RiskAssessment/" + ra.id }, authoredOn: h.date, code: cc(CS + "/task", "clinician-review", "Clinician review of MemBrain alert") });
      }
    });
    return { resourceType: "Bundle", type: "collection", entry: ent.map((r) => ({ fullUrl: "urn:uuid:" + r.id, resource: r })) };
  }

  function showDossier(p, ev) {
    const L_ = ev.latest; const rc = p.risk_context || {}; log("view_dossier", p.id);
    const txt = [`MemBrain referral summary — screening signal, not a diagnosis`, `Participant ${p.id}, ${p.age} y, ${EDU[p.education]}, ${p.dialect}`,
      `Alert: ${LV[L_.level]} (${L_.date})`, ...L_.reasons.map((r) => "- " + r),
      `Drivers: ${L_.drivers.map((d) => `${d.input} ${d.metric || ""} ${fmt(d.value)} (threshold ${fmt(d.threshold)})`).join("; ") || "none"}`,
      `Confounders: ${L_.confounders.map((c) => c.label).join("; ") || "none detected"}`,
      `Trend (composite z): ${ev.history.map((h) => `${h.date} ${h.z ? fmt(h.z.composite) : "n/s"}`).join(", ")}`,
      `Modifiable risk factors: ${(rc.modifiable_factors_present || []).join(", ") || "none recorded"}`,
      `Suggested pathway: ${L_.pathways.map((x) => PATH[x] || x).join(", ") || "-"}`,
      `Suggested reversible-cause checks: ${(rc.reversible_cause_checks || []).join(", ")}`,
      `Limitations: provisional thresholds; voice features exploratory; channels not pooled.`].join("\n");
    modal(`<h2>Referral dossier</h2><div class="small muted">Auto-generated one-page summary for the receiving clinician (also sent as FHIR ServiceRequest + attachments in the pilot).</div>
      <div style="margin:10px 0"><button class="btn primary" id="cp">Copy text</button> <button class="btn" id="cl">Close</button></div>
      <div class="panel pad" style="white-space:pre-wrap;font-size:13.5px">${esc(txt)}</div>${trendChart(ev.history)}`);
    $("#cp").onclick = () => navigator.clipboard.writeText(txt).then(() => toast("Copied"), () => toast("Copy blocked here")); $("#cl").onclick = closeModal;
  }
  function modal(html) { $("#modal-body").innerHTML = html; $("#modal").classList.add("on"); }
  function closeModal() { $("#modal").classList.remove("on"); }
  $("#modal").addEventListener("click", (e) => { if (e.target.id === "modal") closeModal(); });

  // ================================================================ VALIDATION
  function renderValidation() {
    const V = D.validation, s = V.summary, o = s.overall; const t = s.time_to_assessment_weeks; const ab = s.confounder_rule_ablation;
    const ci = (x) => (x && x[1] != null ? `95% CI ${pct(x[1])}–${pct(x[2])}` : "");
    const kpi = (v, l, c) => `<div class="panel kpi"><div class="v">${v}</div><div class="l">${l}</div><div class="ci">${c || ""}</div></div>`;
    const sg = s.subgroups[S.sub];
    const rows = Object.entries(sg).map(([g, b]) => `<tr><td>${esc(EDU[g] || g)}</td><td class="num">${b.n}</td><td class="num">${pct(b.completion_unaided)}</td><td class="num">${fmt(b.test_retest_icc)}</td>
      <td class="num">${pct(b.membrain.sensitivity[0])}</td><td class="num">${pct(b.membrain.specificity[0])}</td><td class="num">${pct(b.membrain.ppv[0])}</td><td class="num">${b.membrain.referrals_per_confirmed ?? "–"}</td>
      <td class="num muted">${pct(b.usual_care.specificity[0])}</td></tr>`).join("");
    const eduFair = Object.entries(s.subgroups.education).map(([g, b]) => ({ g: EDU[g], naive: 1 - b.baseline_naive.specificity[0], strat: 1 - b.baseline_stratified.specificity[0] }));
    $("#main").innerHTML = `
      <div class="panel pad" style="background:var(--sand-soft);border-color:#ecdcc0;margin-bottom:16px"><b>Synthetic validation run (n = ${V.n.toLocaleString()}, seed ${V.seed}).</b>
        This shows the validation pipeline working end-to-end on simulated people with stated assumptions. It is <b>not</b> clinical evidence. The same code runs on Phase A (feasibility and reliability) and Phase B (accuracy against specialist assessment) data.</div>
      <div class="kpis">${kpi(pct(o.completion_unaided), "Sessions completed unaided")}${kpi(fmt(o.test_retest_icc), "Test–retest ICC(2,1), 2 weeks", `${o.n_retest_pairs} stable pairs`)}
        ${kpi(pct(o.membrain.sensitivity[0]), "Sensitivity (12 months)", ci(o.membrain.sensitivity))}${kpi(pct(o.membrain.specificity[0]), "Specificity", ci(o.membrain.specificity))}
        ${kpi(pct(o.membrain.ppv[0]), "Positive predictive value", `prevalence ${pct(s.prevalence.impaired)} impaired`)}${kpi(o.membrain.referrals_per_confirmed, "Referrals per confirmed finding", `usual care ${o.usual_care.referrals_per_confirmed}`)}
        ${kpi((t.membrain_median ?? "–") + " wk", "Median time to clinical assessment", `usual care ${t.usual_care_median} wk*`)}${kpi(fmt(o.change_detection.sensitivity[0] * 100, 0) + "%", "Meaningful change detected", `specificity ${pct(o.change_detection.specificity[0])}`)}</div>
      <div class="two" style="margin-top:16px">
        <div class="panel pad"><h3>MemBrain vs usual care</h3><div class="small muted">Usual care: one education-blind screen at week 0 and week 52.</div>${bars([["Sensitivity", o.membrain.sensitivity[0], o.usual_care.sensitivity[0]], ["Specificity", o.membrain.specificity[0], o.usual_care.specificity[0]], ["PPV", o.membrain.ppv[0], o.usual_care.ppv[0]]], ["MemBrain", "Usual care"])}</div>
        <div class="panel pad"><h3>Fairness: false-positive rate by education</h3><div class="small muted">Share of cognitively normal people wrongly flagged at entry. Education-blind cutoffs penalise people with little schooling.</div>${bars(eduFair.map((e) => [e.g, e.naive, e.strat]), ["Single cutoff", "MemBrain stratified norms"], ["#c89b5a", "#0f5c63"])}</div></div>
      <div class="panel pad" style="margin-top:16px"><div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px"><h3 style="margin:0">Subgroup performance</h3>
        <div class="seg">${[["dialect", "Language / dialect"], ["age_band", "Age band"], ["education", "Education"]].map(([k, v]) => `<button data-sub="${k}" class="${S.sub === k ? "on" : ""}">${v}</button>`).join("")}</div></div>
        <table style="margin-top:10px"><tr><th>Group</th><th class="num">n</th><th class="num">Completion</th><th class="num">ICC</th><th class="num">Sens.</th><th class="num">Spec.</th><th class="num">PPV</th><th class="num">Ref./confirmed</th><th class="num">Usual-care spec.</th></tr>${rows}</table>
        <div class="tiny muted" style="margin-top:6px">Thresholds are revised if a subgroup falls below the pre-agreed floor. In this run, people with no formal education have lower sensitivity. That gap would trigger local norm work in Phase A.</div></div>
      <div class="two" style="margin-top:16px">
        <div class="panel pad"><h3>What the confounder rules buy</h3><table>
          <tr><td>Alerts with confounder rules</td><td class="num">${ab.alerts_with_rules}</td></tr><tr><td>Alerts without them</td><td class="num">${ab.alerts_without_rules}</td></tr>
          <tr><td>False alerts with rules</td><td class="num">${ab.false_alerts_with_rules}</td></tr><tr><td>False alerts without</td><td class="num">${ab.false_alerts_without_rules}</td></tr>
          <tr><td>Repeat sessions triggered ("check again")</td><td class="num">${s.workload.check_again_repeats} of ${s.workload.sessions_total}</td></tr></table>
          ${s.exploratory_voice ? `<h3 style="margin-top:14px">Exploratory voice signal</h3><div class="small">Speech rate AUC for impairment: <b>${s.exploratory_voice.speech_rate_auc_impairment}</b> (simulated). Not used for alerts.</div>` : ""}</div>
        <div class="panel pad"><h3>Assumptions</h3><div class="small" style="max-height:260px;overflow:auto">${Object.entries(V.assumptions).map(([k, v]) => `<div style="margin-bottom:4px"><b>${k.replace(/_/g, " ")}:</b> ${esc(typeof v === "object" ? JSON.stringify(v) : v)}</div>`).join("")}</div>
          <div class="tiny muted" style="margin-top:8px">* ${esc(t.assumptions)}</div></div></div>`;
    document.querySelectorAll("[data-sub]").forEach((b) => (b.onclick = () => { S.sub = b.dataset.sub; renderValidation(); }));
  }
  function bars(rows, names, cols = ["#0f5c63", "#c89b5a"]) {
    const W = 520, rh = 46, H = rows.length * rh + 30, pl = 150, pr = 50;
    const X = (v) => pl + v * (W - pl - pr);
    let g = "";
    rows.forEach((r, i) => { const y = 10 + i * rh; g += `<text x="${pl - 8}" y="${y + 22}" font-size="12" text-anchor="end" fill="#1d2a2e">${esc(r[0])}</text>`;
      [r[1], r[2]].forEach((v, j) => { g += `<rect x="${pl}" y="${y + j * 17 + 4}" width="${Math.max(1, X(v) - pl)}" height="14" rx="3" fill="${cols[j]}"/><text x="${X(v) + 5}" y="${y + j * 17 + 15}" font-size="11" fill="#1d2a2e">${pct(v)}</text>`; }); });
    return `<svg viewBox="0 0 ${W} ${H}" width="100%">${g}</svg><div class="legend">${names.map((n, i) => `<span><i style="background:${cols[i]};border-radius:2px"></i>${n}</span>`).join("")}</div>`;
  }

  // ================================================================ HOW IT WORKS
  function renderHow() {
    const reqs = [
      ["Culturally valid and accessible assessment", "Original RUDAS-type voice tasks in Arabic dialects and English, 3 equated alternate forms, education- and age-stratified norms (raw scores always stored), hearing/vision/noise pre-check, large text, high contrast, slower speech, caregiver-assisted mode.", "participant"],
      ["Longitudinal change detection", `Personal baseline from ${C.BASELINE_SESSIONS}–${C.BASELINE_MAX_SESSIONS} sessions. Practice-adjusted reliable change index (RCI ≤ ${C.RCI_CHECK} → repeat; confirmed on repeat → review; ≤ ${C.RCI_LARGE} or rapid drop → urgent). Voice features are tracked on EWMA charts but stay exploratory.`, "clinician"],
      ["Integrated risk context", "Consent-scoped clinical record (BP, HbA1c, LDL), wearables (sleep, activity), mood scales, informant IQCODE, family history and optional genomics, mapped to FHIR R4 and shown with source. No black-box risk score.", "clinician"],
      ["Personalised prevention and timely care", "Clinician-authored, versioned prevention rules in Arabic and English (culturally adapted). Four triage levels with review targets, referral dossier, and suggested reversible-cause work-up.", "participant"],
      ["Safety and human oversight", "Every alert lists its drivers, the confounders checked and a 90% uncertainty range. Review-level results are held until a clinician acts. The system never writes a diagnosis (no Condition resources). Dismissals need a reason. Everything is audit-logged.", "clinician"],
      ["Validation and local population performance", "Completion, test–retest ICC, sensitivity, specificity, PPV, referrals per confirmed finding, change detection and time to assessment, by dialect, age and education. Pipeline runs now on synthetic data and later on Phase A/B data.", "validation"],
    ];
    $("#main").innerHTML = `<div class="two"><div class="panel pad"><h2>How MemBrain meets the six requirements</h2>${reqs.map((r, i) => `<div class="req"><div class="n">${i + 1}</div><div><b>${r[0]}</b><div class="small muted">${r[1]}</div><button class="btn small" style="margin-top:6px" data-go="${r[2]}">See it →</button></div></div>`).join("")}</div>
      <div class="grid"><div class="panel pad"><h2>Architecture</h2>${archSvg()}</div>
      <div class="panel pad"><h3>Design principles</h3><ul class="small">
        <li>Validated instruments and inspectable statistics first; machine learning second and exploratory.</li>
        <li>Explainable by construction: one engine, versioned (engine ${C.ENGINE_VERSION}, norms ${C.NORMS_VERSION}). Python and JavaScript produce identical results on ${"87"} golden test cases.</li>
        <li>Per-signal consent; identifiers held apart from assessment data; in-country hosting; voice reduced to features on the device.</li>
        <li>Built for low-end Android, WhatsApp/phone fallback channels (scores not pooled across channels until equivalence is shown).</li>
        <li>Design controls aligned to IEC 62304 / ISO 14971. Pilot runs as research under ethics approval until EDE classification advice is received.</li></ul></div></div></div>`;
    document.querySelectorAll("[data-go]").forEach((b) => (b.onclick = () => go(b.dataset.go)));
  }
  function archSvg() {
    const box = (x, y, w, h, t, s, f = "#e2efef", c = "#0f5c63") => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="10" fill="${f}" stroke="${c}" stroke-opacity=".35"/><text x="${x + w / 2}" y="${y + 20}" text-anchor="middle" font-size="12.5" font-weight="600" fill="${c}">${t}</text><text x="${x + w / 2}" y="${y + 37}" text-anchor="middle" font-size="10.5" fill="#5f6b6e">${s}</text>`;
    const ar = (x1, y1, x2, y2) => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#9aa6a8" stroke-width="1.4" marker-end="url(#a)"/>`;
    return `<svg viewBox="0 0 560 360" width="100%"><defs><marker id="a" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0L10 5L0 10z" fill="#9aa6a8"/></marker></defs>
      ${box(10, 10, 170, 50, "Participant app", "voice-first · AR/EN · offline")}${box(195, 10, 170, 50, "Caregiver mode", "assisted, flagged")}${box(380, 10, 170, 50, "Clinician dashboard", "queue · dossier · actions")}
      ${box(10, 95, 260, 50, "Assessment + speech", "item bank · quality gate · ASR · features")}${box(290, 95, 260, 50, "Analytics", "norms · RCI · confounders · fusion")}
      ${box(10, 180, 260, 50, "Clinical workflow", "tasks · referral · messages", "#f5ead9", "#8a6328")}${box(290, 180, 260, 50, "Prevention engine", "versioned rules · AR/EN", "#f5ead9", "#8a6328")}
      ${box(10, 265, 540, 60, "Data & trust layer (in-country)", "FHIR R4 store · consent service · identity vault · OAuth2/SMART · audit log · KMS", "#eef0f6", "#4d5f8a")}
      ${ar(95, 60, 120, 95)}${ar(465, 60, 420, 95)}${ar(270, 120, 290, 120)}${ar(420, 145, 420, 180)}${ar(140, 145, 140, 180)}${ar(140, 230, 140, 265)}${ar(420, 230, 420, 265)}
      <text x="280" y="350" text-anchor="middle" font-size="10.5" fill="#5f6b6e">Connectors: wearables · questionnaires · clinical record (via partner) · later: HIE, genomics</text></svg>`;
  }

  // ---------------------------------------------------------------- boot
  const h = (location.hash || "").replace("#", ""); if (["participant", "clinician", "validation", "how"].includes(h)) S.view = h;
  go(S.view);
})();

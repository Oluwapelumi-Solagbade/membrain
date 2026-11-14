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
  const PATH = { ...D.navigator.pathways };
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
    ({ enrol: renderEnrol, participant: renderParticipant, clinician: renderClinician, referrals: renderReferrals, validation: renderValidation, how: renderHow })[S.view]();
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
    const idx = person.sessions.filter((s) => s.type !== "intake").length;
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
          <div style="margin-top:8px">Session ${p.sessions.filter((s) => s.type !== "intake").length + 1}, alternate form <b>${pt.form}</b></div>
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
    if (p.pending_iqcode != null && !p.sessions.some((x) => x.type !== "intake")) { s.iqcode = p.pending_iqcode; p.pending_iqcode = null; }
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
      <div class="panel pad small" style="max-width:420px"><b>New participant?</b> Enrolment is done by a coordinator: identity vault, consent for each data type, informant, health context and session plan.
        <div style="margin-top:8px"><button class="btn primary" id="np-go">Go to enrolment →</button></div></div></div>
      <div class="grid" style="grid-template-columns:repeat(auto-fill,minmax(330px,1fr))">${cards}</div>`;
    document.querySelectorAll("[data-go]").forEach((b) => (b.onclick = () => { S.pt = newPt(person(b.dataset.go)); S.pt.lang = b.dataset.lang; render(); }));
    $("#np-go").onclick = () => { S.en = blankEnrol(); go("enrol"); };
  }

  // ================================================================ ENROLMENT (coordinator)
  const CONSENT_INFO = [
    ["voice_features", "Voice features", "Measurements of how you speak (speed, pauses). Calculated on your phone; the recording itself is not sent.", "قياسات لطريقة كلامك (السرعة والتوقفات). تُحسب على هاتفك ولا يُرسل التسجيل نفسه.", true],
    ["raw_audio", "Keep voice recordings", "Keep your recordings for a fixed time so scoring can be checked by a person.", "الاحتفاظ بتسجيلاتك لفترة محددة حتى يتمكن شخص من مراجعة التقييم.", false],
    ["wearables", "Watch or fitness band", "Daily sleep and activity summaries from your device.", "ملخصات يومية للنوم والنشاط من جهازك.", false],
    ["clinical_record", "Health record", "Blood pressure, sugar (HbA1c), cholesterol and relevant diagnoses from your clinic record.", "ضغط الدم والسكر التراكمي والكوليسترول والتشخيصات المهمة من ملفك في العيادة.", true],
    ["family_history", "Family history", "Whether close relatives had memory problems or dementia.", "هل عانى أحد الأقارب من مشاكل في الذاكرة أو الخرف.", true],
    ["caregiver_involvement", "Family member involvement", "A family member may help with sessions and answer a short questionnaire about daily life.", "يمكن لأحد أفراد العائلة المساعدة في الجلسات والإجابة على استبيان قصير عن الحياة اليومية.", true],
    ["genomics", "Genetic results", "Use existing genetic results (for example from a national programme). Results are only discussed with you by a clinician with counselling.", "استخدام نتائج جينية موجودة. لا تُناقش النتائج معك إلا من قبل طبيب مع الإرشاد.", false],
    ["model_training", "Help improve the tool", "Allow your anonymised data to be used to improve the tool. Separate from your care.", "السماح باستخدام بياناتك بعد إخفاء هويتك لتحسين الأداة. منفصل عن رعايتك.", false],
  ];
  const CONDITIONS = [["hypertension", "Hypertension"], ["diabetes", "Type 2 diabetes"], ["stroke_tia", "Stroke / TIA"], ["af", "Atrial fibrillation"], ["cvd", "Cardiovascular disease"],
    ["ckd", "Chronic kidney disease"], ["hypothyroid", "Hypothyroidism"], ["b12", "B12 / folate deficiency"], ["depression", "Depression"], ["anxiety", "Anxiety"],
    ["sleep_apnoea", "Sleep apnoea"], ["insomnia", "Chronic insomnia"], ["parkinsons", "Parkinson's disease"], ["tbi", "Head injury (TBI)"], ["hearing_loss", "Hearing loss"], ["vision", "Visual impairment"]];
  const DIALECTS = ["Emirati", "Other Gulf", "Levantine", "Egyptian", "Other Arabic", "English"];
  const eduBand = (y) => (y <= 0 ? "none" : y <= 6 ? "primary" : y <= 12 ? "secondary" : "tertiary");
  S.vault = {}; S.people.forEach((p) => (S.vault[p.id] = { identity: { full_name: p.display_name.en + " (synthetic)", national_id: "784-XXXX-XXXXXXX-X", phone: "+971 5X XXX XXXX", preferred_channel: p.language === "ar" ? "whatsapp" : "app" }, informant: p.id === "MB-1322" ? { name: "Daughter (synthetic)", relation: "daughter" } : null }));
  const blankEnrol = () => ({ step: 0, identity: { full_name: "", national_id: "", phone: "", preferred_channel: "whatsapp" },
    profile: { age: 64, sex: "F", years: 6, language: "ar", dialect: "Emirati", hearing_aid: false, glasses: false, digital: "some" },
    consent: Object.fromEntries(CONSENT_INFO.map((c) => [c[0], c[4]])), informant: { name: "", relation: "", phone: "", iqcode: "" },
    ctx: { sbp: "", dbp: "", hba1c: "", ldl: "", bmi: "", activity_min_week: "", smoker: false, family_history_dementia: false, social_isolation: false, district: "" }, cond: {}, done: null,
    concern: { route: "family", text: "", onset: "months" }, flags: {}, nav: { emirate: "Abu Dhabi", funding: "thiqa" },
    inf: { type: "family", language: "ar", helper_consent: false, timeline: [] } });
  S.en = blankEnrol();
  const ESTEPS = ["Concern & safety", "Identity", "Profile", "Consent", "Informant", "Health context", "Review & schedule"];
  const inp = (path, val, type = "text", ph = "") => `<input class="btn" style="width:100%;text-align:start" data-path="${path}" type="${type}" value="${esc(val)}" placeholder="${esc(ph)}">`;
  const fld = (label, html, help) => `<label style="display:grid;gap:4px;margin-bottom:12px"><span class="small" style="font-weight:600">${label}</span>${html}${help ? `<span class="tiny muted">${help}</span>` : ""}</label>`;
  const sel = (path, val, opts) => `<select class="btn" style="width:100%" data-path="${path}">${opts.map(([v, t]) => `<option value="${v}" ${String(v) === String(val) ? "selected" : ""}>${t}</option>`).join("")}</select>`;
  const chk = (path, val, label) => `<label class="check"><input type="checkbox" data-path="${path}" ${val ? "checked" : ""}> ${label}</label>`;

  function riskContextJS(ctx, edu) {
    const m = { hypertension: (ctx.sbp || 0) >= 140 || ctx.hypertension, diabetes: (ctx.hba1c || 0) >= 6.5 || ctx.diabetes, ldl: (ctx.ldl || 0) >= 3.0,
      physical_inactivity: ctx.activity_min_week != null && ctx.activity_min_week < 150, smoking: ctx.smoker, obesity: (ctx.bmi || 0) >= 30,
      hearing_loss: ctx.hearing_difficulty, vision_loss: ctx.vision_difficulty, depression: ctx.mood_positive, social_isolation: ctx.social_isolation,
      low_education: edu === "none" || edu === "primary", tbi: ctx.tbi };
    const present = Object.keys(m).filter((k) => m[k]);
    return { modifiable_factors_present: present, count: present.length, of: 14, family_history_dementia: ctx.family_history_dementia,
      reversible_cause_checks: ["TSH", "Vitamin B12", "Folate", "Full blood count", "HbA1c", "Renal function", "Medication review (anticholinergic burden)", "Depression (PHQ-9)", "Sleep apnoea screen (STOP-BANG)", "Hearing and vision"] };
  }
  const RULE_TEST = { bp: (c) => (c.sbp || 0) >= 130 || (c.dbp || 0) >= 80 || c.hypertension, glucose: (c) => (c.hba1c || 0) >= 6.5 || c.diabetes, ldl: (c) => (c.ldl || 0) >= 3.0,
    activity: (c) => c.activity_min_week != null && c.activity_min_week < 150, sleep: (c) => (c.sleep_hours || 7) < 6 || c.snoring, hearing: (c) => c.hearing_difficulty && !c.hearing_aid,
    vision: (c) => c.vision_difficulty, smoking: (c) => c.smoker, weight: (c) => (c.bmi || 0) >= 30, social: (c) => c.social_isolation, mood: (c) => c.mood_positive };
  function preventionJS(ctx, lang) {
    const items = D.prevention_rules.filter((r) => RULE_TEST[r.id] && RULE_TEST[r.id](ctx)).map((r) => ({ rule: r.id, text: r[lang], evidence: r.evidence }));
    items.push({ rule: "cognitive_engagement", text: D.prevention_always[lang] });
    return { items: items.slice(0, 5) };
  }


  const RF = D.config.RED_FLAGS;
  const urgentBanner = (flags) => `<div class="panel pad" style="background:var(--urgent-soft);border-color:#e8b9c6;margin-bottom:14px"><b style="color:var(--urgent)">Possible acute presentation.</b>
    Follow the partner's emergency protocol now (ambulance 998 if needed). Do not start cognitive testing and do not wait for repeat tests. Record minimal identity so the clinician can act; the rest can be completed later.
    <div class="small" style="margin-top:6px">${flags.map((f) => "• " + esc(RF[f])).join("<br>")}</div></div>`;
  function concernStep(e, flags) {
    return `<h3>Concern and safety</h3><div class="small muted" style="margin-bottom:10px">People can enter through a screening programme, a primary care clinician, a family member or a household helper. The red-flag screen comes first, before any testing.</div>
      ${fld("How did this person come to us?", sel("concern.route", e.concern.route, Object.entries(ENTRY)))}
      ${fld("What has been noticed?", inp("concern.text", e.concern.text, "text", "e.g. repeating questions, missed bills, got lost driving"), e.concern.route === "programme" ? "Optional for routine programme screening." : "")}
      ${fld("When did it start?", sel("concern.onset", e.concern.onset, [["days", "Within the last few days"], ["weeks", "Over the last few weeks"], ["months", "Over months"], ["years", "Over a year or more"], ["none", "No specific concern (routine screening)"]]))}
      <div class="small" style="font-weight:600;margin:6px 0">Red-flag screen (ask the person and the family member)</div>
      ${Object.entries(RF).map(([k, v]) => chk("flags." + k, e.flags[k], v)).join("")}
      ${flags.length ? urgentBanner(flags) : '<div class="tiny muted" style="margin-top:6px">No red flags: continue with routine enrolment.</div>'}`;
  }
  const ACTIVITIES = ["Managing money / bills", "Managing medicines", "Cooking", "Shopping", "Driving or getting around", "Using the phone", "Remembering appointments", "Prayer times / routines", "Household tasks"];
  const WHY = ["Memory or thinking problems", "Physical illness or mobility", "Personal preference", "Family arrangement", "Not sure"];
  function informantStep(e) {
    const helper = e.inf.type === "household_helper";
    return `<h3>Informant (family member or household helper)</h3><div class="small muted" style="margin-bottom:10px">Optional. Someone who knows the person well describes changes in everyday life. Household help can hide early changes, so what helpers see matters.</div>
      ${fld("Who is giving information?", sel("inf.type", e.inf.type, [["family", "Family member"], ["household_helper", "Household helper"], ["none", "No informant"]]))}
      ${e.inf.type === "none" ? "" : `
      ${helper ? `<div class="panel pad small" style="background:var(--base-soft);border-color:#c9d1e4;margin-bottom:10px">Household helpers take part voluntarily, under their own consent, in a language they understand. Their observations are <b>never</b> shared with an employer or used for employment decisions.</div>
        ${chk("inf.helper_consent", e.inf.helper_consent, "The helper agrees voluntarily and the participant consents to their involvement")}
        ${fld("Helper's preferred language", sel("inf.language", e.inf.language, Object.entries(ND.languages)), "Questionnaire translations beyond Arabic and English are planned for Phase A.")}` : (e.consent.caregiver_involvement ? "" : '<div class="panel pad small" style="background:var(--check-soft);border-color:#f0d4a8;margin-bottom:10px">Family member involvement was not consented on the Consent step.</div>')}
      <div class="two">${fld("Name", inp("informant.name", e.informant.name))}${fld("Relation", sel("informant.relation", e.informant.relation, [["", "—"], ["spouse", "Spouse"], ["son", "Son"], ["daughter", "Daughter"], ["sibling", "Sibling"], ["household_helper", "Household helper"], ["carer", "Paid carer"], ["other", "Other"]]))}</div>
      <div class="two">${fld("Mobile number", inp("informant.phone", e.informant.phone, "tel"))}${fld("IQCODE-16 average (1–5), if done today", inp("informant.iqcode", e.informant.iqcode, "number", "e.g. 3.1"), `Above ${C.IQCODE_CUTOFF} is flagged to the clinician.`)}</div>
      <div class="small" style="font-weight:600;margin:8px 0 4px">Functional change timeline</div><div class="tiny muted" style="margin-bottom:6px">What changed, roughly when, who took over and why. This is context for the clinician, not automatic evidence of decline.</div>
      ${e.inf.timeline.map((t, i) => `<div style="display:grid;grid-template-columns:1.2fr 1.4fr .9fr 1fr 1.2fr auto;gap:6px;margin-bottom:6px">
        <select class="btn small" data-tl="${i}" data-k="activity">${ACTIVITIES.map((a) => `<option ${a === t.activity ? "selected" : ""}>${a}</option>`).join("")}</select>
        <input class="btn small" data-tl="${i}" data-k="change" value="${esc(t.change)}" placeholder="What changed">
        <input class="btn small" data-tl="${i}" data-k="when" value="${esc(t.when)}" placeholder="When">
        <input class="btn small" data-tl="${i}" data-k="who_took_over" value="${esc(t.who_took_over)}" placeholder="Who took over">
        <select class="btn small" data-tl="${i}" data-k="why">${WHY.map((a) => `<option ${a === t.why ? "selected" : ""}>${a}</option>`).join("")}</select>
        <button class="btn small" data-tldel="${i}">✕</button></div>`).join("")}
      <button class="btn small" id="tl-add">+ Add a change</button>`}`;
  }
  function renderEnrol() {
    const e = S.en;
    if (e.done) return renderEnrolDone();
    const st = e.step; const nm = ESTEPS[st]; let body = "";
    const urgentFlags = Object.keys(e.flags).filter((k) => e.flags[k]);
    if (nm === "Concern & safety") body = concernStep(e, urgentFlags);
    if (nm === "Identity") body = (urgentFlags.length ? urgentBanner(urgentFlags) : "") + `<h3>Identity <span class="tiny muted">(identity vault)</span></h3>
      <div class="panel pad small" style="background:var(--base-soft);border-color:#c9d1e4;margin-bottom:14px">These details are stored only in the separate, encrypted identity vault so the clinic can contact the person for follow-up. The assessment record, analytics and dashboard use a pseudonymous ID. Showing them again is audited and needs a reason.</div>
      ${fld("Full name", inp("identity.full_name", e.identity.full_name, "text", "e.g. Mariam Al Hashemi"))}
      ${fld("Emirates ID or clinic MRN", inp("identity.national_id", e.identity.national_id, "text", "784-XXXX-XXXXXXX-X"))}
      ${fld("Mobile number", inp("identity.phone", e.identity.phone, "tel", "+971 5X XXX XXXX"))}
      ${fld("Preferred channel for reminders and check-ins", sel("identity.preferred_channel", e.identity.preferred_channel, [["whatsapp", "WhatsApp"], ["app", "MemBrain app"], ["phone", "Phone call (guided)"]]), "Phone and WhatsApp sessions keep their own baseline. Scores are not pooled across channels until equivalence is shown.")}`;
    if (nm === "Profile") { const band = eduBand(+e.profile.years);
      body = `<h3>Profile</h3><div class="two">${fld("Age", inp("profile.age", e.profile.age, "number"), "Eligible: 50–75")}${fld("Sex", sel("profile.sex", e.profile.sex, [["F", "Female"], ["M", "Male"]]))}</div>
      <div class="two">${fld("Years of schooling", inp("profile.years", e.profile.years, "number"), `Norm group: <b>${EDU[band]}</b>. Scores are compared with people of the same age and education.`)}
      ${fld("Language for sessions", sel("profile.language", e.profile.language, [["ar", "Arabic"], ["en", "English"]]))}</div>
      ${fld("Dialect", sel("profile.dialect", e.profile.dialect, DIALECTS.map((d) => [d, d])), "Used to report accuracy by dialect and to pick recorded prompts.")}
      <div class="two">${fld("Emirate of residence", sel("nav.emirate", e.nav.emirate, ["Abu Dhabi", "Dubai", "Sharjah", "Ajman", "Umm Al Quwain", "Ras Al Khaimah", "Fujairah"].map((x) => [x, x])), "Used to find services the person can reach.")}
      ${fld("Funding route", sel("nav.funding", e.nav.funding, Object.entries(ND.funding)), "Used only to find accessible services. Never used to withhold a clinically needed referral.")}</div>
      <div class="two"><div>${chk("profile.hearing_aid", e.profile.hearing_aid, "Uses a hearing aid")}${chk("profile.glasses", e.profile.glasses, "Uses reading glasses")}</div>
      ${fld("Comfort with smartphones", sel("profile.digital", e.profile.digital, [["none", "Not comfortable"], ["some", "Somewhat"], ["confident", "Confident"]]), e.profile.digital === "none" ? "Suggest caregiver-assisted mode or the guided phone channel." : "")}</div>`; }
    if (nm === "Consent") body = `<h3>Consent for each type of data</h3><div class="small muted" style="margin-bottom:10px">Each item is optional and can be withdrawn at any time. Withdrawal stops processing and removes that data from downstream stores. Read each one aloud in the person's language.</div>` +
      CONSENT_INFO.map(([k, en, , ar]) => `<div style="display:grid;grid-template-columns:auto 1fr auto;gap:10px;align-items:start;padding:10px 0;border-bottom:1px solid var(--line)">
        <input type="checkbox" data-path="consent.${k}" ${e.consent[k] ? "checked" : ""} style="margin-top:4px;width:18px;height:18px">
        <div><b>${en}</b><div class="small">${esc(CONSENT_INFO.find((c) => c[0] === k)[2])}</div><div class="small ar muted" dir="rtl">${esc(ar)}</div></div>
        <button class="btn small" data-read="${k}">🔊</button></div>`).join("") + `<div class="tiny muted" style="margin-top:8px">Consent text version consent-ar-en-0.1 · recorded by the coordinator · stored as FHIR Consent resources.</div>`;
    if (nm === "Informant") body = informantStep(e);
    if (nm === "Health context") body = `<h3>Health context</h3>${e.consent.clinical_record ? "" : '<div class="panel pad small" style="background:var(--check-soft);border-color:#f0d4a8;margin-bottom:10px">Health record use was not consented. Only what the person tells you directly is recorded.</div>'}
      <div class="small muted" style="margin-bottom:10px">In the pilot these come from the clinic record through the partner's integration. Here they are entered by hand.</div>
      <div class="two">${fld("Blood pressure (systolic / diastolic)", `<div style="display:flex;gap:6px">${inp("ctx.sbp", e.ctx.sbp, "number", "130")}${inp("ctx.dbp", e.ctx.dbp, "number", "80")}</div>`)}${fld("HbA1c (%)", inp("ctx.hba1c", e.ctx.hba1c, "number", "6.1"))}</div>
      <div class="two">${fld("LDL cholesterol (mmol/L)", inp("ctx.ldl", e.ctx.ldl, "number", "3.0"))}${fld("BMI", inp("ctx.bmi", e.ctx.bmi, "number", "28"))}</div>
      <div class="two">${fld("Physical activity (minutes per week)", inp("ctx.activity_min_week", e.ctx.activity_min_week, "number", "90"))}${fld("Home district (optional)", inp("ctx.district", e.ctx.district, "text", "e.g. Al Ain, Khalifa City"), "For later environmental exposure (air quality) and service planning, at district level only.")}</div>
      <div class="small" style="font-weight:600;margin:6px 0">Known conditions</div><div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr))">${CONDITIONS.map(([k, v]) => chk("cond." + k, e.cond[k], v)).join("")}</div>
      <div class="small" style="font-weight:600;margin:10px 0 6px">Lifestyle and family</div>${chk("ctx.smoker", e.ctx.smoker, "Smokes (cigarettes, shisha or medwakh)")}${chk("ctx.social_isolation", e.ctx.social_isolation, "Lives alone or rarely sees family and friends")}${e.consent.family_history ? chk("ctx.family_history_dementia", e.ctx.family_history_dementia, "Parent or sibling with memory problems or dementia") : ""}`;
    if (nm === "Review & schedule") { const band = eduBand(+e.profile.years); const today = new Date("2026-11-14");
      const add = (d) => new Date(today.getTime() + d * 86400000).toISOString().slice(0, 10);
      body = `<h3>Review and schedule</h3><table>
        <tr><td>Person</td><td>${esc(e.identity.full_name || "—")} · ${e.profile.age} y · ${e.profile.sex === "F" ? "female" : "male"} · ${EDU[band]} · ${esc(e.profile.dialect)}</td></tr>
        <tr><td>Channel</td><td>${esc(e.identity.preferred_channel)}${e.profile.digital === "none" ? " · caregiver-assisted mode suggested" : ""}</td></tr>
        <tr><td>Consent</td><td>${CONSENT_INFO.map(([k, l]) => `<span class="chip ${e.consent[k] ? "on" : "off"}">${l}</span>`).join("")}</td></tr>
        <tr><td>Informant</td><td>${e.informant.name ? esc(e.informant.name + " (" + (e.informant.relation || "relation not set") + ")") : "None"}</td></tr>
        <tr><td>Conditions</td><td>${CONDITIONS.filter(([k]) => e.cond[k]).map(([, v]) => v).join(", ") || "None recorded"}</td></tr></table>
        <h3 style="margin-top:14px">Session plan</h3><table>
        <tr><td>Baseline 1</td><td>${add(0)} (today, with the coordinator)</td><td class="small muted">Form ${E.formForSession(0, 0)}</td></tr>
        <tr><td>Baseline 2</td><td>${add(14)}</td><td class="small muted">alternate form</td></tr>
        <tr><td>Follow-up</td><td>${add(84)}</td><td class="small muted">first change check</td></tr>
        <tr><td>Routine</td><td>every 6 months</td><td class="small muted">or 2–4 weeks after a "check again" result</td></tr></table>
        <div class="tiny muted" style="margin-top:8px">Reminders are sent through ${esc(e.identity.preferred_channel)} one day before and on the day.</div>`; }
    $("#main").innerHTML = `<div style="display:grid;grid-template-columns:240px minmax(0,1fr);gap:18px;align-items:start" class="enrol">
      <div class="panel pad"><h3>Enrol a participant</h3><div class="small muted" style="margin-bottom:10px">Done by a programme coordinator or clinician.</div>
        ${ESTEPS.map((t, i) => `<div class="check" style="cursor:pointer;${i === st ? "font-weight:700;color:var(--teal)" : ""}" data-step="${i}"><b>${i < st ? "✓" : i + 1}</b>${t}</div>`).join("")}</div>
      <div class="panel pad">${body}<div style="display:flex;justify-content:space-between;margin-top:16px;border-top:1px solid var(--line);padding-top:14px">
        <button class="btn" id="e-back" ${st === 0 ? "disabled" : ""}>Back</button>
        <button class="btn primary big" id="e-next" ${urgentFlags.length ? 'style="background:var(--urgent);border-color:var(--urgent)"' : ""}>${st === ESTEPS.length - 1 ? "Enrol and create pseudonymous ID" : urgentFlags.length && nm === "Concern & safety" ? "Record identity and escalate now" : urgentFlags.length && nm === "Identity" ? "Create URGENT review now" : "Next"}</button></div></div></div>`;
    document.querySelectorAll("[data-path]").forEach((el) => {
      const store = () => { const [a, b] = el.dataset.path.split("."); e[a][b] = el.type === "checkbox" ? el.checked : el.value; };
      el.oninput = store;
      el.onchange = () => { store(); if (el.tagName === "SELECT" || el.type === "checkbox" || el.dataset.path === "profile.years") renderEnrol(); };
    });
    document.querySelectorAll("[data-step]").forEach((el) => (el.onclick = () => { e.step = +el.dataset.step; renderEnrol(); }));
    document.querySelectorAll("[data-tl]").forEach((el) => (el.oninput = el.onchange = () => { e.inf.timeline[+el.dataset.tl][el.dataset.k] = el.value; }));
    document.querySelectorAll("[data-tldel]").forEach((el) => (el.onclick = () => { e.inf.timeline.splice(+el.dataset.tldel, 1); renderEnrol(); }));
    const ta = $("#tl-add"); if (ta) ta.onclick = () => { e.inf.timeline.push({ activity: ACTIVITIES[0], change: "", when: "", who_took_over: "", why: WHY[0] }); renderEnrol(); };
    document.querySelectorAll("[data-read]").forEach((b) => (b.onclick = () => { const c = CONSENT_INFO.find((x) => x[0] === b.dataset.read); speak(e.profile.language === "ar" ? c[3] : c[2], e.profile.language); }));
    $("#e-back").onclick = () => { e.step--; renderEnrol(); };
    $("#e-next").onclick = () => {
      if (nm === "Concern & safety" && !e.concern.text.trim() && e.concern.route !== "programme") { toast("Describe the concern in a few words"); return; }
      if (nm === "Identity" && !e.identity.full_name.trim()) { toast("Enter a name (it stays in the identity vault)"); return; }
      if (nm === "Identity" && urgentFlags.length) { finishEnrol(); return; }
      if (nm === "Profile" && (+e.profile.age < 50 || +e.profile.age > 75)) { toast("MemBrain is for ages 50–75"); return; }
      if (st < ESTEPS.length - 1) { e.step++; renderEnrol(); return; }
      finishEnrol();
    };
  }
  function finishEnrol() {
    const e = S.en; const id = "MB-" + (2000 + S.people.length + Math.floor(Math.random() * 7000));
    const num = (x) => (x === "" || x == null ? null : +x);
    const ctx = { sbp: num(e.ctx.sbp), dbp: num(e.ctx.dbp), hba1c: num(e.ctx.hba1c), ldl: num(e.ctx.ldl), bmi: num(e.ctx.bmi), activity_min_week: num(e.ctx.activity_min_week),
      smoker: e.ctx.smoker, social_isolation: e.ctx.social_isolation, family_history_dementia: e.consent.family_history ? e.ctx.family_history_dementia : null, district: e.ctx.district || null,
      hypertension: !!e.cond.hypertension, diabetes: !!e.cond.diabetes, hearing_difficulty: !!e.cond.hearing_loss, hearing_aid: e.profile.hearing_aid, vision_difficulty: !!e.cond.vision,
      mood_positive: !!e.cond.depression, tbi: !!e.cond.tbi, conditions: Object.keys(e.cond).filter((k) => e.cond[k]) };
    if (!e.consent.clinical_record) ["sbp", "dbp", "hba1c", "ldl", "bmi"].forEach((k) => (ctx[k] = null));
    const band = eduBand(+e.profile.years); const lang = e.profile.language;
    const p = { id, display_name: { en: "Enrolled participant", ar: "مشارك مسجّل" }, age: +e.profile.age, age_band: +e.profile.age < 60 ? "50-59" : +e.profile.age < 70 ? "60-69" : "70-75",
      sex: e.profile.sex, education: band, dialect: e.profile.dialect, language: lang, story: "Enrolled during this demo through the enrolment flow.", context: ctx,
      consent: { ...e.consent }, sessions: [], prevention: { en: preventionJS(ctx, "en"), ar: preventionJS(ctx, "ar") }, risk_context: riskContextJS(ctx, band),
      pending_iqcode: e.informant.iqcode ? +e.informant.iqcode : null, preferred_channel: e.identity.preferred_channel,
      funding: e.nav.funding, emirate: e.nav.emirate, languages: [lang], entry_route: e.concern.route, referrals: [],
      informant: e.inf.type === "none" || (e.inf.type === "household_helper" && !e.inf.helper_consent) ? null
        : { type: e.inf.type, relation: e.informant.relation, language: e.inf.language, consented: true, timeline: e.inf.timeline.filter((t) => t.change || t.when) } };
    const flags = Object.keys(e.flags).filter((k) => e.flags[k]);
    p.sessions.push({ session_id: id + "-intake", date: TODAY, type: "intake", channel: "app", concern: e.concern.text || "routine programme screening", onset: e.concern.onset, red_flags: flags });
    S.people.push(p);
    S.vault[id] = { identity: { ...e.identity }, informant: e.informant.name ? { name: e.informant.name, relation: e.informant.relation, phone: e.informant.phone } : null };
    S.audit.unshift({ ts: new Date().toISOString().slice(0, 19).replace("T", " "), actor: "coordinator", action: "enrol", target: id, detail: "consent: " + Object.keys(e.consent).filter((k) => e.consent[k]).join(", ") });
    e.done = id; renderEnrol();
  }
  function renderEnrolDone() {
    const id = S.en.done; const p = person(id);
    $("#main").innerHTML = `<div class="panel pad" style="max-width:640px;margin:0 auto;text-align:center">
      ${p.sessions[0] && (p.sessions[0].red_flags || []).length ? '<div class="panel pad" style="background:var(--urgent-soft);border-color:#e8b9c6;margin-bottom:12px;text-align:left"><b style="color:var(--urgent)">URGENT review created.</b> The clinician queue shows this person at the top. Follow the emergency protocol; no cognitive testing today.</div>' : ""}
      <div style="font-size:40px">✓</div><h2>Enrolled</h2><div class="muted">Pseudonymous ID</div><div style="font-size:30px;font-weight:700;color:var(--teal);letter-spacing:.04em">${id}</div>
      <div class="small muted" style="margin:8px 0 16px">Name and contact details are in the identity vault only. Clinicians see ${id}, and can re-identify for follow-up with a reason (audited).</div>
      <div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap"><button class="btn primary big" id="d-start">Start baseline session 1 now</button><button class="btn big" id="d-new">Enrol another person</button><button class="btn big" id="d-clin">Open in clinician dashboard</button></div></div>`;
    $("#d-start").onclick = () => { S.pt = newPt(p); S.pt.lang = p.language; go("participant"); };
    $("#d-new").onclick = () => { S.en = blankEnrol(); renderEnrol(); };
    $("#d-clin").onclick = () => { S.selected = id; go("clinician"); };
  }
  function reidentify(p) {
    modal(`<h2>Contact details (identity vault)</h2><div class="small muted">Re-identification is restricted to the assigned clinician or coordinator, needs a reason, and is written to the audit log.</div>
      ${fld("Reason", `<select class="btn" id="ri-r" style="width:100%"><option value="">Choose a reason…</option><option>Arrange clinician review call</option><option>Urgent safety contact</option><option>Schedule repeat session</option><option>Send referral</option></select>`)}
      <div id="ri-out"></div><div style="margin-top:10px"><button class="btn primary" id="ri-go">Show contact details</button> <button class="btn" id="ri-cl">Close</button></div>`);
    $("#ri-cl").onclick = closeModal;
    $("#ri-go").onclick = () => { const r = $("#ri-r").value; if (!r) { toast("A reason is required"); return; }
      const v = S.vault[p.id] || {}; log("reidentify", p.id, r);
      $("#ri-out").innerHTML = `<table><tr><td>Name</td><td><b>${esc(v.identity?.full_name || "—")}</b></td></tr><tr><td>ID / MRN</td><td>${esc(v.identity?.national_id || "—")}</td></tr>
        <tr><td>Mobile</td><td>${esc(v.identity?.phone || "—")}</td></tr><tr><td>Preferred channel</td><td>${esc(v.identity?.preferred_channel || "—")}</td></tr>
        <tr><td>Informant</td><td>${v.informant ? esc(v.informant.name + " · " + v.informant.relation + (v.informant.phone ? " · " + v.informant.phone : "")) : "None"}</td></tr></table>`; };
  }

  // ================================================================ NAVIGATOR (referrals & care navigation)
  const NV = window.makeNavigator(D.navigator); const ND = D.navigator;
  const TODAY = "2026-11-14";
  const STATE_LABEL = { recommended: "Recommended", sent: "Sent", accepted: "Accepted", declined: "Declined", appointment_offered: "Appointment offered", attended: "Attended",
    missed: "Missed", assessment_completed: "Assessment completed", follow_up_documented: "Follow-up documented", lost_to_follow_up: "Lost to follow-up",
    no_accessible_service: "No accessible service", cancelled: "Cancelled" };
  const STATE_COL = (s) => (["declined", "missed", "lost_to_follow_up", "no_accessible_service"].includes(s) ? "lv-CLINICIAN_REVIEW" : ["assessment_completed", "follow_up_documented"].includes(s) ? "lv-STABLE" : s === "cancelled" ? "lv-INVALID" : "lv-BASELINE");
  const svcById = (id) => ND.directory.find((s) => s.id === id);
  const ENTRY = { programme: "Programme screening", primary_care: "Primary care clinician", family: "Family member", household_helper: "Household helper" };
  const allLiveRefs = () => S.people.flatMap((p) => (p.referrals || []).map((r) => ({ ...r, _p: p })));

  function referralPanel(p) {
    const refs = p.referrals || [];
    const rows = refs.map((r) => {
      const svc = svcById(r.service_id); const nexts = ND.transitions[r.state] || [];
      const tl = r.history.map((h) => `<span class="pill ${STATE_COL(h.state)}" title="${esc(h.reason || "")}">${h.date.slice(5)} ${STATE_LABEL[h.state]}</span>`).join(" → ");
      return `<div style="border:1px solid var(--line);border-radius:12px;padding:12px;margin-bottom:10px">
        <div style="display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap"><div><b>${esc(PATH[r.pathway] || r.pathway)}</b> ${r.urgency === "urgent" ? '<span class="pill lv-URGENT">urgent</span>' : ""}
          <div class="small muted">${svc ? esc(svc.name) + " · " + esc(svc.area) : "No service assigned"} · ${NV.isUnresolved(r) ? "<b>open</b>" : "closed"}</div></div>
          <button class="btn small" data-pack="${r.id}">Next-steps pack</button></div>
        <div style="margin:8px 0;line-height:2">${tl}</div>
        ${nexts.length ? `<div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center"><span class="tiny muted">Update:</span>${nexts.map((n) => `<button class="btn small" data-adv="${r.id}" data-st="${n}">${STATE_LABEL[n]}</button>`).join("")}
          <input class="btn small" style="flex:1;min-width:140px;text-align:start" id="rs-${r.id}" placeholder="reason (needed for declined / missed / lost)"></div>` : ""}</div>`;
    }).join("");
    return `<div class="panel pad"><div style="display:flex;justify-content:space-between;align-items:center"><h3 style="margin:0">Referrals and care navigation</h3><button class="btn primary" id="b-ref">New referral</button></div>
      <div class="tiny muted" style="margin:4px 0 10px">Closed loop: a referral counts as done only when the assessment is completed and follow-up is documented. Unresolved referrals stay visible.</div>
      ${rows || '<div class="small muted">No referrals yet.</div>'}</div>`;
  }
  function timelinePanel(p) {
    const inf = p.informant; if (!inf || !(inf.timeline || []).length) return "";
    return `<div class="panel pad"><h3>Functional change timeline <span class="tiny muted">(${inf.type === "household_helper" ? "household helper, separate consent" : esc(inf.relation || "family")})</span></h3>
      <table><tr><th>Activity</th><th>What changed</th><th>When</th><th>Who took over</th><th>Why (as reported)</th></tr>
      ${inf.timeline.map((t) => `<tr><td>${esc(t.activity)}</td><td>${esc(t.change)}</td><td>${esc(t.when)}</td><td>${esc(t.who_took_over)}</td><td>${esc(t.why)}</td></tr>`).join("")}</table>
      <div class="tiny muted" style="margin-top:6px">Context for clinical review, not automatic evidence of decline: changes can reflect preference, physical illness or family arrangements.${inf.type === "household_helper" ? " Helper observations are never shared with an employer." : ""}</div></div>`;
  }
  function bindReferralPanel(p) {
    const b = $("#b-ref"); if (b) b.onclick = () => referralModal(p);
    document.querySelectorAll("[data-adv]").forEach((el) => (el.onclick = () => {
      const r = p.referrals.find((x) => x.id === el.dataset.adv); const reason = ($("#rs-" + r.id) || {}).value || "";
      try { NV.advance(r, el.dataset.st, TODAY, reason.trim(), "dr.demo"); log("referral_" + el.dataset.st, p.id, reason); toast(STATE_LABEL[el.dataset.st]); renderClinician(); }
      catch (e) { toast(e.message.includes("reason") ? "Add a reason first" : e.message); }
    }));
    document.querySelectorAll("[data-pack]").forEach((el) => (el.onclick = () => showPack(p, p.referrals.find((x) => x.id === el.dataset.pack))));
  }
  function showPack(p, r, lang) {
    lang = lang || (p.language === "ar" ? "ar" : "en"); const pk = NV.pack(r, svcById(r.service_id), lang); const txt = pk.title + "\n\n" + pk.sections.map((s) => "• " + s).join("\n\n");
    modal(`<div style="display:flex;justify-content:space-between;align-items:center"><h2 style="margin:0">Next-steps pack</h2><div class="seg"><button data-pl="en" class="${lang === "en" ? "on" : ""}">English</button><button data-pl="ar" class="${lang === "ar" ? "on" : ""}">عربي</button></div></div>
      <div class="small muted">Clinician-approved template given to the participant and their chosen care partner after a confirmed referral.</div>
      <div class="panel pad" dir="${lang === "ar" ? "rtl" : "ltr"}" style="margin:10px 0;${lang === "ar" ? "font-family:'IBM Plex Sans Arabic'" : ""}"><h3>${esc(pk.title)}</h3><ul>${pk.sections.map((s) => `<li style="margin-bottom:8px">${esc(s)}</li>`).join("")}</ul></div>
      <button class="btn primary" id="cp">Copy text</button> <button class="btn" id="cl">Close</button>`);
    document.querySelectorAll("[data-pl]").forEach((b) => (b.onclick = () => showPack(p, r, b.dataset.pl)));
    $("#cp").onclick = () => navigator.clipboard.writeText(txt).then(() => toast("Copied"), () => toast("Copy blocked here")); $("#cl").onclick = closeModal;
  }
  function referralModal(p, pathway) {
    const ev = p.sessions.length ? E.evaluate(p, p.sessions).latest : null;
    pathway = pathway || (ev && ev.pathways[0]) || "memory_clinic";
    const m = NV.match(pathway, p); const urgent = ev && ev.level === "URGENT";
    const rows = m.services.map((s, i) => `<tr><td><input type="radio" name="svc" value="${s.id}" ${i === 0 && s.accessible ? "checked" : ""}></td><td><b>${esc(s.name)}</b><div class="tiny muted">${esc(s.area)}, ${esc(s.emirate)} · ${esc(s.notes || "")}</div></td>
      <td class="small">${s.languages.map((l) => ND.languages[l] || l).join(", ")}</td><td class="small">${s.funding.map((f) => ND.funding[f]).join("; ")}</td><td class="num">${s.wait_weeks} wk</td>
      <td>${s.accessible ? '<span class="pill lv-STABLE">accessible</span>' : `<span class="pill lv-CHECK_AGAIN">barrier: ${s.barriers.join(", ")}</span>`}${s.stale ? ' <span class="pill lv-INVALID">info not verified recently</span>' : ""}</td></tr>`).join("");
    modal(`<h2>New referral · ${esc(p.id)}</h2>
      <div class="small muted">Step 1: choose the clinically appropriate pathway. Step 2: choose a service the person can actually reach. Funding or eligibility never removes a clinically needed pathway.</div>
      <div class="two" style="margin:12px 0"><label class="small"><b>Pathway</b><select class="btn" id="rf-path" style="width:100%">${Object.entries(PATH).map(([k, v]) => `<option value="${k}" ${k === pathway ? "selected" : ""}>${v}</option>`).join("")}</select></label>
        <label class="small"><b>Urgency</b><select class="btn" id="rf-urg" style="width:100%"><option value="routine">Routine</option><option value="urgent" ${urgent || pathway === "urgent_clinical_assessment" ? "selected" : ""}>Urgent</option></select></label></div>
      <div class="small">Person: ${(p.languages || [p.language]).map((l) => ND.languages[l] || l).join(", ")} · ${ND.funding[p.funding] || "funding not recorded"} · ${esc(p.emirate || "emirate not recorded")}</div>
      ${m.gap ? `<div class="panel pad small" style="background:var(--review-soft);border-color:#efc2b6;margin:8px 0"><b>Pathway gap:</b> no listed service matches this person's language and funding route. Services are still shown. If none can be arranged, record "no accessible service" so the gap is escalated and counted.</div>` : ""}
      <table style="margin-top:8px"><tr><th></th><th>Service</th><th>Languages</th><th>Funding</th><th class="num">Wait</th><th>Access</th></tr>${rows || '<tr><td colspan="6" class="muted">No service in the directory for this pathway.</td></tr>'}</table>
      <label class="small" style="display:block;margin-top:10px"><b>Reason for referral</b><input class="btn" id="rf-reason" style="width:100%;text-align:start" value="${esc(ev ? ev.reasons[0] || "" : "")}"></label>
      <div style="margin-top:12px;display:flex;gap:8px;flex-wrap:wrap"><button class="btn primary" id="rf-send">Recommend and send</button><button class="btn" id="rf-gap">Record: no accessible service</button><button class="btn" id="rf-cl">Cancel</button></div>
      <div class="tiny muted" style="margin-top:6px">All directory entries are synthetic placeholders. In the pilot the partner maintains them, and anything not verified in ${ND.stale_after_days} days is flagged.</div>`);
    $("#rf-path").onchange = (e) => referralModal(p, e.target.value);
    $("#rf-cl").onclick = closeModal;
    const create = () => { p.referrals = p.referrals || []; const r = NV.newReferral(`REF-${p.id}-${p.referrals.length}`, p.id, $("#rf-path").value, null, $("#rf-urg").value, TODAY, $("#rf-reason").value || "Clinician confirmed concern", "dr.demo", p.entry_route || "programme");
      r.concern_date = (p.sessions[0] || {}).date || TODAY; p.referrals.push(r); return r; };
    $("#rf-send").onclick = () => { const sel = document.querySelector('input[name="svc"]:checked'); if (!sel) { toast("Choose a service, or record that none is accessible"); return; }
      const r = create(); r.service_id = sel.value; NV.advance(r, "sent", TODAY, "", "dr.demo");
      (S.actions[p.id] = S.actions[p.id] || []).push({ action: "refer", note: PATH[r.pathway], ts: TODAY, session: ev && ev.session_id });
      log("referral_sent", p.id, PATH[r.pathway] + " → " + sel.value); closeModal(); toast("Referral sent"); renderClinician(); };
    $("#rf-gap").onclick = () => { const r = create(); NV.advance(r, "no_accessible_service", TODAY, "No service in language or funding route; escalated to clinical lead", "dr.demo");
      log("pathway_gap", p.id, PATH[r.pathway]); closeModal(); toast("Pathway gap recorded and escalated"); renderClinician(); };
  }

  function renderReferrals() {
    const live = allLiveRefs(); const syn = S.withSyn !== false; const log_ = ND.synthetic_log;
    const refs = [...live.map(({ _p, ...r }) => r), ...(syn ? log_.referrals : [])];
    const people = { ...(syn ? log_.people : {}) }; S.people.forEach((p) => (people[p.id] = { language: p.language, funding: p.funding, sex: p.sex, age_band: p.age_band }));
    const m = NV.metrics(refs, people);
    const kpi = (v, l, c) => `<div class="panel kpi"><div class="v">${v}</div><div class="l">${l}</div><div class="ci">${c || ""}</div></div>`;
    const work = [...live.filter((r) => NV.isUnresolved(r)).map((r) => ({ r, p: r._p, syn: false })), ...(syn ? log_.referrals.filter(NV.isUnresolved).map((r) => ({ r, p: null, syn: true })) : [])]
      .map((x) => ({ ...x, age: NV.days(x.r.history[x.r.history.length - 1].date, TODAY) })).sort((a, b) => (["no_accessible_service", "declined", "lost_to_follow_up", "missed"].includes(b.r.state) - ["no_accessible_service", "declined", "lost_to_follow_up", "missed"].includes(a.r.state)) || (b.p ? 1 : 0) - (a.p ? 1 : 0) || b.age - a.age);
    const bars = (obj, lab) => Object.entries(obj).map(([k, v]) => [lab ? lab[k] || k : k, v.completion, v.sent]);
    const barSvg = (rows) => { const W = 480, rh = 30, pl = 200, H = rows.length * rh + 8; return `<svg viewBox="0 0 ${W} ${H}" width="100%">${rows.map(([k, v, n], i) => `<text x="${pl - 8}" y="${i * rh + 19}" font-size="12" text-anchor="end">${esc(k)}</text><rect x="${pl}" y="${i * rh + 7}" width="${(v || 0) * (W - pl - 70)}" height="16" rx="3" fill="#0f5c63"/><text x="${pl + (v || 0) * (W - pl - 70) + 5}" y="${i * rh + 19}" font-size="11">${pct(v)} of ${n}</text>`).join("")}</svg>`; };
    const stale = ND.directory.filter((s) => NV.days(s.last_verified, TODAY) > ND.stale_after_days);
    $("#main").innerHTML = `<div style="display:flex;justify-content:space-between;align-items:flex-end;flex-wrap:wrap;gap:10px;margin-bottom:12px"><div><h2 style="margin:0">Referrals and care navigation</h2>
      <div class="muted small">From alert to completed assessment: every referral is tracked until follow-up is documented.</div></div>
      <label class="check small"><input type="checkbox" id="syn" ${syn ? "checked" : ""}> Include synthetic programme log (${log_.referrals.length} journeys)</label></div>
      <div class="kpis">${kpi(pct(m.completion_rate), "Referrals completed to assessment", `${m.sent} sent`)}${kpi(pct(m.accepted_rate), "Accepted by receiving service")}
        ${kpi((m.median_days_concern_to_review ?? "–") + " d", "First concern → clinician review", "median")}${kpi((m.median_days_referral_to_assessment ?? "–") + " d", "Referral → completed assessment", "median")}
        ${kpi(m.unresolved, "Open referrals", `${Object.values(m.non_completion_reasons).reduce((a, b) => a + b, 0)} need action`)}${kpi(m.pathway_gaps, "Pathway gaps recorded", "no accessible service")}</div>
      <div class="two" style="margin-top:16px">
        <div class="panel pad"><h3>Open referrals worklist</h3><div class="tiny muted" style="margin-bottom:6px">Problems first (declined, missed, lost, no accessible service), then oldest.</div>
          <div style="max-height:420px;overflow:auto"><table><tr><th>Person</th><th>Pathway</th><th>State</th><th class="num">Days</th></tr>
          ${work.slice(0, 60).map((x) => `<tr ${x.p ? `data-open="${x.p.id}" style="cursor:pointer"` : ""}><td>${x.p ? `<b>${esc(x.p.id)}</b>` : `<span class="muted">${esc(x.r.participant_id)}</span>`}</td><td class="small">${esc(PATH[x.r.pathway] || x.r.pathway)}</td>
            <td><span class="pill ${STATE_COL(x.r.state)}">${STATE_LABEL[x.r.state]}</span>${x.r.history[x.r.history.length - 1].reason ? `<div class="tiny muted">${esc(x.r.history[x.r.history.length - 1].reason)}</div>` : ""}</td><td class="num">${x.age}</td></tr>`).join("")}</table></div></div>
        <div class="grid"><div class="panel pad"><h3>Completion by entry route</h3>${barSvg(bars(m.by_entry_route, ENTRY))}</div>
          <div class="panel pad"><h3>Completion by funding route</h3>${barSvg(bars(m.by_funding, { thiqa: "Thiqa (government)", enhanced: "Enhanced / employer", basic: "Basic insurance", self_pay: "Self-pay" }))}</div>
          <div class="panel pad"><h3>Completion by language</h3>${barSvg(bars(m.by_language, ND.languages))}<div class="tiny muted">Gaps by language or funding point to directory or access problems, not to the person.</div></div></div></div>
      <div class="panel pad" style="margin-top:16px"><div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:8px"><h3 style="margin:0">Service directory</h3><span class="small muted">${stale.length} of ${ND.directory.length} entries not verified in the last ${ND.stale_after_days} days</span></div>
        <table style="margin-top:8px"><tr><th>Service</th><th>Pathways</th><th>Languages</th><th>Funding</th><th class="num">Wait</th><th>Last verified</th></tr>
        ${ND.directory.map((s) => `<tr><td><b>${esc(s.name)}</b><div class="tiny muted">${esc(s.area)} · ${esc(s.referral_process)}</div></td><td class="small">${s.pathways.map((x) => PATH[x] || x).join("; ")}</td>
          <td class="small">${s.languages.map((l) => ND.languages[l] || l).join(", ")}</td><td class="small">${s.funding.map((f) => ND.funding[f]).join("; ")}</td><td class="num">${s.wait_weeks} wk</td>
          <td class="small">${s.last_verified}${NV.days(s.last_verified, TODAY) > ND.stale_after_days ? ' <span class="pill lv-CHECK_AGAIN">re-verify</span>' : ""}</td></tr>`).join("")}</table>
        <div class="tiny muted" style="margin-top:6px">All entries are synthetic placeholders. In the pilot the partner maintains the directory with providers.</div></div>
      <div class="panel pad small" style="margin-top:16px;background:var(--sand-soft);border-color:#ecdcc0"><b>Synthetic programme log.</b> ${esc(ND.assumptions.notes)} Assumptions: acceptance ${pct(ND.assumptions.acceptance)}, attendance ${pct(ND.assumptions.appointment_attended)}, rebooking after a missed appointment ${pct(ND.assumptions.rebook_after_missed)}. Real baselines come from Phase 0 with the partner.</div>`;
    $("#syn").onchange = (e) => { S.withSyn = e.target.checked; renderReferrals(); };
    document.querySelectorAll("[data-open]").forEach((el) => (el.onclick = () => { S.selected = el.dataset.open; go("clinician"); }));
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
        ${C.REVIEW_TARGET_DAYS[x.lv] ? `<div class="tiny muted">Review target: ${due}${x.closed ? " · closed" : ""}</div>` : ""}
        ${(x.p.referrals || []).filter(NV.isUnresolved).map((r) => `<div class="tiny">↳ Referral: <span class="pill ${STATE_COL(r.state)}" style="padding:1px 7px">${STATE_LABEL[r.state]}</span></div>`).join("")}</div>`;
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
    if (!ev) { el.innerHTML = `<div class="panel pad"><h2 style="margin:0">${esc(p.id)}</h2><div class="small muted">${p.age} y · ${EDU[p.education]} · ${esc(p.dialect)}</div>
      <div style="margin:8px 0">${Object.entries(p.consent || {}).map(([k, v]) => `<span class="chip ${v ? "on" : "off"}">${k.replace(/_/g, " ")}</span>`).join("")}</div>
      <p>Enrolled. No sessions yet: the first baseline session is due today.</p><button class="btn" id="b-reid">Contact details 🔒</button></div>`; $("#b-reid").onclick = () => reidentify(p); return; }
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
        <div class="noprint" style="display:flex;gap:6px;flex-wrap:wrap"><button class="btn" id="b-reid">Contact details 🔒</button><button class="btn" id="b-dos">Referral dossier</button><button class="btn" id="b-fhir">FHIR R4 bundle</button></div></div>
        <div class="alertbox lv-${L_.level}" style="margin-top:14px"><div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">${pill(L_.level)}<span class="small muted">${L_.intake ? `Intake ${L_.date}` : `Latest session ${L_.date} · form ${L_.form} · ${L_.channel}`}</span>
          ${L_.held_for_clinician ? '<span class="small"><b>Held:</b> participant was told only that the clinic will contact them.</span>' : ""}</div>
          <ul style="margin:8px 0 4px">${L_.reasons.map((r) => `<li>${esc(r)}</li>`).join("")}</ul>
          ${L_.pathways.length ? `<div class="small"><b>Suggested pathway:</b> ${L_.pathways.map((x) => PATH[x] || x).join(" · ")}</div>` : ""}</div></div>
      <div class="panel pad"><h3>Trend against personal baseline</h3>${ev.history.some((h) => h.z) ? trendChart(ev.history) : '<div class="small muted">No scored sessions yet.</div>'}
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
      ${referralPanel(p)}${timelinePanel(p)}
      <div class="panel pad"><h3>Audit log</h3>${S.audit.slice(0, 8).map((a) => `<div class="tiny">${a.ts} · ${esc(a.actor)} · <b>${esc(a.action)}</b> · ${esc(a.target)} ${esc(a.detail)}</div>`).join("") || '<div class="tiny muted">Empty.</div>'}</div>`;
    if (!S.audit[0] || S.audit[0].target !== p.id || S.audit[0].action !== "view_evaluation") log("view_evaluation", p.id);
    document.querySelectorAll("[data-act]").forEach((b) => (b.onclick = () => {
      const note = $("#act-note").value.trim(); const a = b.dataset.act;
      if (a === "refer") { referralModal(p); return; }
      if (a === "dismiss" && !note) { toast("A reason is required to dismiss an alert"); $("#act-note").focus(); return; }
      (S.actions[p.id] = S.actions[p.id] || []).push({ action: a, note, ts: new Date().toISOString().slice(0, 16).replace("T", " "), session: L_.session_id });
      log("task_" + a, p.id, note); toast("Recorded: " + a.replace(/_/g, " ")); renderClinician();
    }));
    $("#b-dos").onclick = () => showDossier(p, ev);
    $("#b-reid").onclick = () => reidentify(p);
    bindReferralPanel(p);
    $("#b-fhir").onclick = () => { const b = fhirBundle(p, ev); log("export_fhir", p.id); modal(`<h2>FHIR R4 bundle</h2><div class="small muted">Patient (pseudonymous), Consent per signal, Observation, RiskAssessment, Task, ServiceRequest (referral with state). The system never writes Condition (clinician-only).</div>
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
    const FS = { recommended: "draft", sent: "active", accepted: "active", appointment_offered: "active", attended: "active", missed: "on-hold", declined: "revoked",
      assessment_completed: "completed", follow_up_documented: "completed", lost_to_follow_up: "on-hold", no_accessible_service: "on-hold", cancelled: "revoked" };
    (p.referrals || []).forEach((r) => ent.push({ resourceType: "ServiceRequest", id: id("ref"), status: FS[r.state], intent: "order", priority: r.urgency === "urgent" ? "urgent" : "routine",
      code: cc(CS + "/pathway", r.pathway, PATH[r.pathway] || r.pathway), subject: { reference: "Patient/" + p.id }, authoredOn: r.history[0].date, performer: [{ display: r.service_id || "to be assigned" }],
      extension: [{ url: CS + "/ext/referral-state", valueCode: r.state }], note: r.history.map((h) => ({ text: `${h.date} ${h.state} ${h.reason || ""}`.trim() })) }));
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
        <li>Explainable by construction: one engine, versioned (engine ${C.ENGINE_VERSION}, norms ${C.NORMS_VERSION}). Python and JavaScript produce identical results on 90 golden test cases.</li>
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
  const h = (location.hash || "").replace("#", ""); if (["enrol", "participant", "clinician", "referrals", "validation", "how"].includes(h)) S.view = h;
  window.addEventListener("hashchange", () => { const v = (location.hash || "").replace("#", ""); if (v !== S.view && ["enrol", "participant", "clinician", "referrals", "validation", "how"].includes(v)) go(v); });
  go(S.view);
})();

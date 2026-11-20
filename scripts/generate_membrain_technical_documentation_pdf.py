#!/usr/bin/env python3
"""Generate publication-grade Comprehensive Technical Documentation PDF for MemBrain.
Synthesizes the complete essay, clinical intent, core product modules, and user flows
from MEMBRAIN.pdf together with the active repository's system architecture, 3 unified
workflows, psychometrics, dataset assumptions, clinical boundaries, and limitations.
"""
from __future__ import annotations

import os
import sys
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.pdfgen import canvas
from reportlab.platypus import (
    HRFlowable,
    KeepTogether,
    PageBreak,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)


class NumberedCanvas(canvas.Canvas):
    """Two-pass canvas for dynamic total page count and professional running headers/footers."""

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._saved_page_states = []

    def showPage(self):
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        num_pages = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            self.draw_page_decorations(num_pages)
            super().showPage()
        super().save()

    def draw_page_decorations(self, total_pages: int):
        self.saveState()
        self.setFont("Helvetica", 7.5)
        self.setFillColor(colors.HexColor("#64748b"))

        # Running Header (pages > 1)
        if self._pageNumber > 1:
            self.drawString(
                45,
                11 * 72 - 28,
                "MemBrain — Comprehensive Technical Documentation & Clinical Essay",
            )
            self.drawRightString(
                8.5 * 72 - 45,
                11 * 72 - 28,
                "Future Health Digital Innovation Challenge · Abu Dhabi, UAE",
            )
            self.setStrokeColor(colors.HexColor("#cbd5e1"))
            self.setLineWidth(0.5)
            self.line(45, 11 * 72 - 32, 8.5 * 72 - 45, 11 * 72 - 32)

        # Running Footer (all pages)
        footer_text = f"Page {self._pageNumber} of {total_pages}"
        self.drawRightString(8.5 * 72 - 45, 24, footer_text)
        self.drawString(
            45,
            24,
            "Confidential · Clinical Boundaries, System Architecture, Dataset Assumptions & Governance · MemBrain v0.5.0",
        )
        self.setStrokeColor(colors.HexColor("#cbd5e1"))
        self.setLineWidth(0.5)
        self.line(45, 32, 8.5 * 72 - 45, 32)
        self.restoreState()


def build_technical_documentation_pdf(output_path: str):
    doc = SimpleDocTemplate(
        output_path,
        pagesize=letter,
        leftMargin=45,
        rightMargin=45,
        topMargin=42,
        bottomMargin=42,
    )

    styles = getSampleStyleSheet()

    # Base & Custom Typography Styles
    title_style = ParagraphStyle(
        "DocTitle",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=17,
        leading=21,
        textColor=colors.HexColor("#0f3f2c"),
        spaceAfter=3,
    )

    subtitle_style = ParagraphStyle(
        "DocSubtitle",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=9.5,
        leading=13.5,
        textColor=colors.HexColor("#334155"),
        spaceAfter=8,
    )

    h1_style = ParagraphStyle(
        "Heading1_Custom",
        parent=styles["Heading1"],
        fontName="Helvetica-Bold",
        fontSize=10.8,
        leading=13.8,
        textColor=colors.HexColor("#0f3f2c"),
        spaceBefore=10,
        spaceAfter=4,
        keepWithNext=True,
    )

    h2_style = ParagraphStyle(
        "Heading2_Custom",
        parent=styles["Heading2"],
        fontName="Helvetica-Bold",
        fontSize=8.6,
        leading=11.2,
        textColor=colors.HexColor("#1e293b"),
        spaceBefore=6,
        spaceAfter=3,
        keepWithNext=True,
    )

    body_style = ParagraphStyle(
        "Body_Custom",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=7.4,
        leading=10.3,
        textColor=colors.HexColor("#1e293b"),
        spaceAfter=4,
    )

    body_bold = ParagraphStyle(
        "Body_Bold",
        parent=body_style,
        fontName="Helvetica-Bold",
    )

    bullet_style = ParagraphStyle(
        "Bullet_Custom",
        parent=body_style,
        leftIndent=10,
        bulletIndent=3,
        spaceAfter=2,
    )

    code_style = ParagraphStyle(
        "Code_Custom",
        parent=body_style,
        fontName="Courier",
        fontSize=6.8,
        leading=9.0,
        textColor=colors.HexColor("#0f172a"),
    )

    # Table Typography
    tbl_hdr = ParagraphStyle(
        "TblHdr",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=7.0,
        leading=8.8,
        textColor=colors.HexColor("#ffffff"),
    )

    tbl_cell = ParagraphStyle(
        "TblCell",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=6.7,
        leading=8.7,
        textColor=colors.HexColor("#1e293b"),
    )

    tbl_cell_bold = ParagraphStyle(
        "TblCellBold",
        parent=tbl_cell,
        fontName="Helvetica-Bold",
    )

    def make_callout(text: str, title: str | None = None, kind: str = "info", width: float = 522) -> Table:
        palette = {
            "info": ("#eff6ff", "#bfdbfe", "#1d4ed8"),
            "warning": ("#fffbeb", "#fde68a", "#b45309"),
            "caution": ("#fef2f2", "#fca5a5", "#b91c1c"),
            "success": ("#f0fdf4", "#86efac", "#166534"),
            "primary": ("#f0f7f4", "#a7d3c0", "#0f3f2c"),
        }
        bg_col, border_col, title_col = palette.get(kind, palette["info"])
        
        callout_body = ParagraphStyle(
            f"Callout_{kind}",
            parent=body_style,
            fontSize=7.2,
            leading=9.8,
            textColor=colors.HexColor("#1e293b"),
            spaceAfter=0,
        )
        content_parts = []
        if title:
            content_parts.append(f"<font color='{title_col}'><b>{title}</b></font><br/>")
        content_parts.append(text)
        full_html = "".join(content_parts)
        
        t = Table([[Paragraph(full_html, callout_body)]], colWidths=[width])
        t.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor(bg_col)),
            ("BOX", (0, 0), (-1, -1), 0.75, colors.HexColor(border_col)),
            ("TOPPADDING", (0, 0), (-1, -1), 4),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ("LEFTPADDING", (0, 0), (-1, -1), 6),
            ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ]))
        return t

    story = []

    # =========================================================================
    # HEADER & METADATA BLOCK
    # =========================================================================
    story.append(Paragraph("MEMBRAIN: Comprehensive Technical Documentation", title_style))
    story.append(
        Paragraph(
            "<b>A Concern-First, AI-Enabled Platform for Identifying Cognitive and Functional Change, Understanding Brain-Health Risks, and Connecting People to Timely, Personalised Care</b>",
            subtitle_style,
        )
    )

    meta_data = [
        [
            Paragraph("<b>Challenge & Track:</b>", tbl_cell_bold),
            Paragraph("Future Health Digital Innovation Challenge · Protecting Brain Health Earlier", tbl_cell),
            Paragraph("<b>Target Jurisdiction:</b>", tbl_cell_bold),
            Paragraph("Abu Dhabi & UAE (UAE ICT Health Law / ADHICS)", tbl_cell),
        ],
        [
            Paragraph("<b>Target Population:</b>", tbl_cell_bold),
            Paragraph("Adults aged 50–75 (Stratified by 4 Education Bands)", tbl_cell),
            Paragraph("<b>Cloud Residency:</b>", tbl_cell_bold),
            Paragraph("Microsoft Azure UAE North (Dubai / In-Country Sovereign)", tbl_cell),
        ],
        [
            Paragraph("<b>Product Category:</b>", tbl_cell_bold),
            Paragraph("Digital brain-health assessment, longitudinal monitoring & care navigation", tbl_cell),
            Paragraph("<b>Regulatory Class:</b>", tbl_cell_bold),
            Paragraph("SaMD Class B Roadmap (Clinical Decision Support, Non-Diagnostic)", tbl_cell),
        ],
        [
            Paragraph("<b>Core Psychometric Engine:</b>", tbl_cell_bold),
            Paragraph("v0.5.0 (Latin-Square Forms A, B, C; Practice-Adjusted RCI)", tbl_cell),
            Paragraph("<b>Care Navigator AI:</b>", tbl_cell_bold),
            Paragraph("nav-0.2.0 (Dual Extractor, Grounding Verifier & 7-Stage State Machine)", tbl_cell),
        ],
    ]
    meta_table = Table(meta_data, colWidths=[100, 161, 100, 161])
    meta_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#f8fafc")),
        ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
        ("INNERGRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#e2e8f0")),
        ("TOPPADDING", (0, 0), (-1, -1), 2.5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 2.5),
        ("LEFTPADDING", (0, 0), (-1, -1), 5),
        ("RIGHTPADDING", (0, 0), (-1, -1), 5),
    ]))
    story.append(meta_table)
    story.append(Spacer(1, 4))

    # Definitive Clinical Boundary Callout
    story.append(make_callout(
        "<b>DEFINITIVE CLINICAL BOUNDARY:</b> MemBrain is strictly a concern-led longitudinal risk identification, "
        "reliable change detection, and clinical navigation platform. <b>MemBrain NEVER diagnoses dementia, "
        "Mild Cognitive Impairment (MCI), or any neurological disease.</b> It does not replace a physician consultation. "
        "A single assessment score never establishes impairment; acute confounders suspend cognitive interpretation; "
        "and all diagnostic determinations and referral approvals rest exclusively with qualified medical professionals.",
        title="CRITICAL CLINICAL & REGULATORY MANDATE",
        kind="caution",
        width=522,
    ))
    story.append(Spacer(1, 4))

    # =========================================================================
    # PART I: PROJECT PROPOSAL & CONCEPTUAL ESSAY (FROM MEMBRAIN.PDF)
    # =========================================================================
    story.append(Paragraph("PART I: PROJECT PROPOSAL & THE CONCERN-FIRST ESSAY", h1_style))
    story.append(Paragraph(
        "<i>Core Proposition:</i> When someone notices a change in memory, thinking or everyday functioning, MemBrain helps "
        "understand what has changed, why it may matter, what should happen next, and whether the person actually receives the appropriate care. "
        "Changes in cognitive and functional health are often gradual: a person repeatedly forgets appointments, asks repetitive questions, "
        "struggles with complex financial or medication tasks, or withdraws socially. Family members and household helpers frequently observe "
        "these subtle shifts months or years before clinical consultation. However, recognizing a change is only the beginning—families rarely "
        "know whether a change is clinically significant, which reversible factors contribute, or how to navigate specialized care pathways.",
        body_style,
    ))

    story.append(Paragraph("1.1 The Five Structural Failures of Conventional Screening", h2_style))
    story.append(Paragraph(
        "Conventional healthcare approaches to cognitive impairment suffer from five structural bottlenecks detailed in the MemBrain proposal:",
        body_style,
    ))
    story.append(Paragraph("• <b>Concerns Recognised Before Clinically Understood:</b> Early symptoms are first observed in daily routines (managing medications, navigating familiar souqs, financial transactions). These observations remain informal, unrecorded, and fragmented across disparate providers.", bullet_style))
    story.append(Paragraph("• <b>Multiple Potentially Reversible Contributors:</b> Cognitive symptoms frequently coexist with treatable systemic contributors—hypertension, diabetes, dyslipidaemia, sleep apnoea, B12/TSH deficiency, depression, sensory deficit, or polypharmacy. Identifying one contributor must not prematurely explain away cognitive change.", bullet_style))
    story.append(Paragraph("• <b>One-Off Screening Inadequacy:</b> A single cross-sectional test score cannot capture an individual's trajectory. Scores are contaminated by education, language, culture, test anxiety, and digital familiarity. Without a personal reference baseline, normal variation is easily misclassified as pathology.", bullet_style))
    story.append(Paragraph("• <b>Fragmented Risk Context:</b> Cognitive test scores, metabolic laboratory panels, sleep logs, and family history reside in isolated silos, preventing clinicians from synthesizing the complete pathophysiological picture.", bullet_style))
    story.append(Paragraph("• <b>Recognition Does Not Guarantee Care:</b> Up to 70% of individuals flagged during routine screening experience referral drop-off—referrals are delayed, declined, missed, or never completed. Caregivers receive no actionable guidance while waiting.", bullet_style))

    story.append(Paragraph("1.2 The Six Connected Capabilities", h2_style))
    story.append(Paragraph(
        "MemBrain operationalizes a unified ecosystem designed around six interconnected capabilities: "
        "<b>(1) Concern Identification & Structured Intake:</b> Multilingual capture of observed changes, timeline, severity, and functional impact across 10 daily activities. "
        "<b>(2) Accessible Cognitive & Functional Assessment:</b> Spoken and written batteries adjusted for language, literacy, and sensory needs. "
        "<b>(3) Integrated Brain-Health Profile:</b> Synthesizing cognitive scores with cardiometabolic labs, sleep, mental wellbeing, lifestyle, and optional ApoE genomics. "
        "<b>(4) Longitudinal Change Monitoring:</b> Intra-individual benchmarking using Practice-Adjusted Reliable Change Indices. "
        "<b>(5) Personalised Prevention & Care Navigation:</b> Generating evidence-informed educational guidance and matching individuals to primary care, memory clinics, geriatrics, or neurology. "
        "<b>(6) Closed-Loop Follow-Up & Programme Intelligence:</b> Tracking referral milestones to documented consultation and delivering population-level brain health analytics.",
        body_style,
    ))

    # =========================================================================
    # PART II: SYSTEM ARCHITECTURE & CODEBASE REPOSITORY IMPLEMENTATION
    # =========================================================================
    story.append(Paragraph("PART II: SYSTEM ARCHITECTURE & CODEBASE IMPLEMENTATION", h1_style))
    story.append(Paragraph(
        "The MemBrain codebase is architected as a high-performance, modular full-stack application engineered for sovereign deployment "
        "in compliance with <b>UAE Federal Law No. 2 of 2019</b> and Abu Dhabi Health Information and Cyber Security (ADHICS) standards. "
        "The implementation spans a modern reactive client frontend, a high-throughput Python FastAPI backend, deterministic psychometric modules, "
        "and sovereign speech processing services.",
        body_style,
    ))

    arch_data = [
        [
            Paragraph("System Tier", tbl_hdr),
            Paragraph("Repository Subsystem", tbl_hdr),
            Paragraph("Technology Stack", tbl_hdr),
            Paragraph("Clinical & Architectural Role", tbl_hdr),
        ],
        [
            Paragraph("<b>Frontend Web & PWA Layer</b>", tbl_cell_bold),
            Paragraph("App Router (`site/app/`)<br/>UI Components (`site/components/`)<br/>State & Sync (`site/lib/workspace/`)", tbl_cell),
            Paragraph("Next.js 16.4 (React 19)<br/>Tailwind CSS v4<br/>TypeScript 5.x", tbl_cell),
            Paragraph("Implements responsive LTR/RTL layouts (Arabic/English), Web Speech API & Azure Speech hooks, client-side caching, and offline-resilient optimistic synchronization.", tbl_cell),
        ],
        [
            Paragraph("<b>Backend API Layer</b>", tbl_cell_bold),
            Paragraph("FastAPI Engine (`api/main.py`)<br/>Auth & Vault (`api/auth.py`)<br/>Persistence (`api/store.py`)", tbl_cell),
            Paragraph("Python 3.13 / Uvicorn<br/>Pydantic v2 Models<br/>SQLite / WAL Mode", tbl_cell),
            Paragraph("Provides RESTful endpoints for concern intake, participant enrolment, session scoring, clinician queue management, audit logging, and FHIR R4 ServiceRequest export.", tbl_cell),
        ],
        [
            Paragraph("<b>Identity Vault & Privacy</b>", tbl_cell_bold),
            Paragraph("PII Vault (`api/auth.py:VAULT`)<br/>De-Identification Engine<br/>Audit Ledger (`DB['audit']`)", tbl_cell),
            Paragraph("AES-256-GCM Encryption<br/>HMAC-SHA256 Sessions<br/>PBKDF2 Password Hashing", tbl_cell),
            Paragraph("Physically isolates civil identifiers (names, phone numbers, Emirates IDs) from clinical assessment records. Every patient operates under a pseudonymous pseudonym (`MB-P...`).", tbl_cell),
        ],
        [
            Paragraph("<b>Speech & ASR Tier</b>", tbl_cell_bold),
            Paragraph("Speech Router (`api/tts.py`)<br/>Local Whisper (`api/asr_local.py`)<br/>Voice Features (`site/lib/voice.ts`)", tbl_cell),
            Paragraph("Azure Cognitive Speech<br/>faster-whisper (CT2)<br/>Web Audio API (SNR)", tbl_cell),
            Paragraph("Dual-mode speech architecture: high-accuracy Azure Speech in UAE North with automatic fallback to local Whisper. Computes SNR and speech-to-pause ratios in real time.", tbl_cell),
        ],
        [
            Paragraph("<b>Psychometric Core</b>", tbl_cell_bold),
            Paragraph("Item Bank (`membrain/items.py`)<br/>Norms & Scoring (`membrain/scoring.py`)<br/>Triage Engine (`membrain/triage.py`)", tbl_cell),
            Paragraph("Deterministic Python &<br/>Byte-Identical JS<br/>(`site/lib/mb/`)", tbl_cell),
            Paragraph("Administers 5-domain cognitive batteries across Latin-square Forms A, B, C. Normalizes Arabic text, applies education-stratified z-scores, and evaluates Reliable Change.", tbl_cell),
        ],
        [
            Paragraph("<b>Care Navigator AI</b>", tbl_cell_bold),
            Paragraph("Navigator Engine (`membrain/navigator.py`)<br/>Intake NLU (`api/navai.py`)<br/>Care Services Directory", tbl_cell),
            Paragraph("Regex Rule-Engine +<br/>LLM Grounding Verifier<br/>JSON Service Directory", tbl_cell),
            Paragraph("Extracts 9 concern domains and 10 functional activities from conversational speech. Verifier guards against hallucination. Executes 7-stage closed-loop referral tracking.", tbl_cell),
        ],
    ]
    arch_table = Table(arch_data, colWidths=[80, 115, 90, 237])
    arch_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#0f3f2c")),
        ("ALIGN", (0, 0), (-1, -1), "LEFT"),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#94a3b8")),
        ("INNERGRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.HexColor("#ffffff"), colors.HexColor("#f8fafc")]),
        ("TOPPADDING", (0, 0), (-1, -1), 2),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
        ("LEFTPADDING", (0, 0), (-1, -1), 4),
        ("RIGHTPADDING", (0, 0), (-1, -1), 4),
    ]))
    story.append(arch_table)
    story.append(Spacer(1, 4))

    # =========================================================================
    # SECTION 2.1: THE THREE UNIFIED APPLICATION WORKFLOWS
    # =========================================================================
    story.append(Paragraph("2.1 The Three Unified Application Workflows", h2_style))
    story.append(Paragraph(
        "To satisfy rigorous clinical boundary separation and patient dignity, the codebase establishes three strictly isolated workflows:",
        body_style,
    ))

    flow_data = [
        [
            Paragraph("Workflow", tbl_hdr),
            Paragraph("Entry Route & Auth", tbl_hdr),
            Paragraph("User Progression & Screens", tbl_hdr),
            Paragraph("Terminal Action & Clinical Logging", tbl_hdr),
        ],
        [
            Paragraph("<b>1. Public Concern Intake</b>", tbl_cell_bold),
            Paragraph("Public `/concern/`<br/>No login required<br/>Optional claim token", tbl_cell),
            Paragraph("Conversational interview captures concern, onset, timeline, and functional impact. User picks nearest registered hospital with verified active doctors and provides contact info.", tbl_cell),
            Paragraph("<b>Strict Process Termination:</b> Shows hospital commitment (e.g. 24-hour target). Offers only 'Return Home' and 'Start Again'. Triage task automatically logged to hospital queue.", tbl_cell),
        ],
        [
            Paragraph("<b>2. Self-Service Check-in</b>", tbl_cell_bold),
            Paragraph("Public `/checkin/`<br/>SMS OTP sign-in<br/>(`/signin/patient/`)", tbl_cell),
            Paragraph("Patient signs in with mobile OTP. New patients complete 'A little about you' onboarding profile (`EnrolForm embedded`) covering age, schooling, language, dialect, and hospital. Runs 5-domain cognitive battery.", tbl_cell),
            Paragraph("Confidential outcome screen reveals reassuring support and lifestyle prevention plan. Raw scores are held for clinician review. Behind-the-scenes clinician data is strictly hidden.", tbl_cell),
        ],
        [
            Paragraph("<b>3. In-Clinic Check-in</b>", tbl_cell_bold),
            Paragraph("Clinician Workspace<br/>(`/clinician/`)<br/>Role-gated auth", tbl_cell),
            Paragraph("Doctors access assigned hospital queue. From patient case view (`CaseView`), doctor clicks 'Start in-clinic check-in' (`/checkin/?id=MB-P...`). Evaluates alternate-form check-in.", tbl_cell),
            Paragraph("Displays full psychometric breakdown, domain sub-scores, audio SNR, RCI trajectories, and 'Return to Case' action button. Exports FHIR R4 ServiceRequest bundles.", tbl_cell),
        ],
    ]
    flow_table = Table(flow_data, colWidths=[85, 110, 140, 187])
    flow_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#0f3f2c")),
        ("ALIGN", (0, 0), (-1, -1), "LEFT"),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#94a3b8")),
        ("INNERGRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.HexColor("#ffffff"), colors.HexColor("#f8fafc")]),
        ("TOPPADDING", (0, 0), (-1, -1), 2),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
        ("LEFTPADDING", (0, 0), (-1, -1), 4),
        ("RIGHTPADDING", (0, 0), (-1, -1), 4),
    ]))
    story.append(flow_table)
    story.append(Spacer(1, 4))

    # =========================================================================
    # PART III: CORE PRODUCT MODULES (MODULES A THROUGH H + MYLIFE)
    # =========================================================================
    story.append(Paragraph("PART III: CORE PRODUCT MODULES & CAPABILITY MATRIX", h1_style))
    story.append(Paragraph(
        "MemBrain organizes its functional capabilities into eight core modules and one person-centred add-on (MyLife Profile), "
        "as defined in the foundational proposal and implemented in the repository:",
        body_style,
    ))

    mod_data = [
        [
            Paragraph("Module", tbl_hdr),
            Paragraph("Functional Name", tbl_hdr),
            Paragraph("Dimensions & Clinical Data Captured", tbl_hdr),
            Paragraph("System Implementation", tbl_hdr),
        ],
        [
            Paragraph("<b>Module A</b>", tbl_cell_bold),
            Paragraph("Concern Capture & Structured Intake", tbl_cell),
            Paragraph("5 dimensions: Nature of change (9 domains), Timeline (onset/progression), Frequency & severity, Functional impact (10 activities), Source attribution (self/supporter).", tbl_cell),
            Paragraph("`ConcernChat.tsx`, `api/navai.py`, `intake-0.2.0` NLU pipeline.", tbl_cell),
        ],
        [
            Paragraph("<b>Module B</b>", tbl_cell_bold),
            Paragraph("Initial Safety & Triage", tbl_cell),
            Paragraph("Identifies acute neurological red flags (sudden confusion, unilateral weakness, facial drooping, acute speech loss, rapid deterioration) and immediate safety concerns.", tbl_cell),
            Paragraph("Halts standard testing immediately; triggers 998 emergency protocol in `ConcernChat.tsx` and `api/main.py`.", tbl_cell),
        ],
        [
            Paragraph("<b>Module C</b>", tbl_cell_bold),
            Paragraph("Accessible Cognitive & Functional Assessment", tbl_cell),
            Paragraph("5 cognitive domains (Memory, Delayed Recall, Fluency, Story, Judgement) + Functional history across IADLs (medication, finance, shopping, navigation, cooking).", tbl_cell),
            Paragraph("`Checkin.tsx`, `membrain/items.py`, Latin-square Forms A, B, C.", tbl_cell),
        ],
        [
            Paragraph("<b>Module D</b>", tbl_cell_bold),
            Paragraph("Personal Brain-Health Profile & Risk Context", tbl_cell),
            Paragraph("Cardiometabolic factors (BP, SBP/DBP, HbA1c, lipids, BMI), sleep duration/quality, mental wellbeing (PHQ-2, GAD-2), smoking, physical activity, family history, and optional ApoE genomics.", tbl_cell),
            Paragraph("`EnrolView.tsx`, `api/main.py:Profile`, `membrain/genomics.py`.", tbl_cell),
        ],
        [
            Paragraph("<b>Module E</b>", tbl_cell_bold),
            Paragraph("Personal Baseline & Longitudinal Monitoring", tbl_cell),
            Paragraph("Establishes intra-individual baseline across repeated sessions. Evaluates trajectory using Practice-Adjusted Reliable Change Index (RCI). Classifies into 4 operational workflow states.", tbl_cell),
            Paragraph("`membrain/triage.py`, `membrain/scoring.py`.", tbl_cell),
        ],
        [
            Paragraph("<b>Module F</b>", tbl_cell_bold),
            Paragraph("Clinical Review & Personalised Care Navigation", tbl_cell),
            Paragraph("Compiles structured Clinical Review Packet (CRP) containing concern narrative, functional changes, risk context, confounders, and cognitive sub-scores for clinician decision support.", tbl_cell),
            Paragraph("`CaseView.tsx`, `ReviewPacket.tsx`, `FHIR.ts`.", tbl_cell),
        ],
        [
            Paragraph("<b>Module G</b>", tbl_cell_bold),
            Paragraph("Personalised Brain-Health Prevention", tbl_cell),
            Paragraph("Delivers evidence-informed educational recommendations (vascular risk management, Mediterranean-DASH dietary patterns, physical exercise, sleep hygiene, hearing aids) from clinician-curated library.", tbl_cell),
            Paragraph("`membrain/prevention.py`, `Checkin.tsx:Done`.", tbl_cell),
        ],
        [
            Paragraph("<b>Module H</b>", tbl_cell_bold),
            Paragraph("Referral Tracking & Caregiver Support", tbl_cell),
            Paragraph("Tracks referrals across 7 deterministic lifecycle milestones. Unresolved referrals remain highlighted in clinician queues to prevent drop-off. Provides caregiver guidance.", tbl_cell),
            Paragraph("`membrain/navigator.py`, `QueueView.tsx`, `ReferralsView.tsx`.", tbl_cell),
        ],
        [
            Paragraph("<b>MyLife Add-on</b>", tbl_cell_bold),
            Paragraph("Person-Centred Life Story & Care Profile", tbl_cell),
            Paragraph("Captures personal background, preferred language, important relationships, daily routines, comfort activities, and distress triggers for individuals with functional impairment.", tbl_cell),
            Paragraph("`api/family.py`, generates My Life Story, My Care Profile, and Quick Care Card.", tbl_cell),
        ],
    ]
    mod_table = Table(mod_data, colWidths=[90, 130, 170, 132])
    mod_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#0f3f2c")),
        ("ALIGN", (0, 0), (-1, -1), "LEFT"),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#94a3b8")),
        ("INNERGRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.HexColor("#ffffff"), colors.HexColor("#f8fafc")]),
        ("TOPPADDING", (0, 0), (-1, -1), 2),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
        ("LEFTPADDING", (0, 0), (-1, -1), 4),
        ("RIGHTPADDING", (0, 0), (-1, -1), 4),
    ]))
    story.append(mod_table)
    story.append(Spacer(1, 4))

    # =========================================================================
    # PART IV: THE COMPLETE 11-STEP CLINICAL USER JOURNEY
    # =========================================================================
    story.append(Paragraph("PART IV: THE COMPLETE 11-STEP CLINICAL USER JOURNEY", h1_style))
    story.append(Paragraph(
        "The end-to-end user journey embodies the central operating logic of MemBrain: "
        "<b>NOTICE → REPORT → CAPTURE → TRIAGE → ASSESS → CONTEXTUALISE → REVIEW → PREVENT/REFER → FOLLOW UP → MONITOR</b>.",
        body_style,
    ))

    journey_data = [
        [
            Paragraph("Step #", tbl_hdr),
            Paragraph("Stage Name", tbl_hdr),
            Paragraph("Clinical & Technical Operating Procedure", tbl_hdr),
            Paragraph("Actor & Interaction Channel", tbl_hdr),
        ],
        [
            Paragraph("<b>Step 1</b>", tbl_cell_bold),
            Paragraph("Notice a Change", tbl_cell),
            Paragraph("Individual or supporter observes memory lapses, functional struggles, or behavioural changes in everyday life.", tbl_cell),
            Paragraph("Patient, Family Member, or Helper", tbl_cell),
        ],
        [
            Paragraph("<b>Step 2</b>", tbl_cell_bold),
            Paragraph("Enter MemBrain", tbl_cell),
            Paragraph("User accesses MemBrain directly via web/PWA or is introduced by a community primary care coordinator.", tbl_cell),
            Paragraph("Self or Clinic-Assisted Entry", tbl_cell),
        ],
        [
            Paragraph("<b>Step 3</b>", tbl_cell_bold),
            Paragraph("Structured Concern Capture", tbl_cell),
            Paragraph("Guided conversational interview extracts what changed, onset timing, trajectory, frequency, and functional disruption.", tbl_cell),
            Paragraph("Voice or Text (`ConcernChat.tsx`)", tbl_cell),
        ],
        [
            Paragraph("<b>Step 4</b>", tbl_cell_bold),
            Paragraph("Initial Safety Triage", tbl_cell),
            Paragraph("Algorithmic screening for acute delirium, stroke signs, or severe head injury. Red flags divert to emergency care.", tbl_cell),
            Paragraph("System Rule-Check (`api/main.py`)", tbl_cell),
        ],
        [
            Paragraph("<b>Step 5</b>", tbl_cell_bold),
            Paragraph("Consent & Assessment", tbl_cell),
            Paragraph("Participant reviews granular data-use consent (audio, clinical records, genomics) and completes 5-domain cognitive battery.", tbl_cell),
            Paragraph("Participant (`Checkin.tsx`)", tbl_cell),
        ],
        [
            Paragraph("<b>Step 6</b>", tbl_cell_bold),
            Paragraph("Build Brain-Health Profile", tbl_cell),
            Paragraph("Combines concern narrative, cognitive results, functional IADL/BADL impact, and cardiometabolic risk context.", tbl_cell),
            Paragraph("Data Engine Integration (`api/main.py`)", tbl_cell),
        ],
        [
            Paragraph("<b>Step 7</b>", tbl_cell_bold),
            Paragraph("Contextualise & Interpret", tbl_cell),
            Paragraph("Filters acute confounders (sleep debt, depression, sensory deficit) and benchmarks scores against personal baseline using RCI.", tbl_cell),
            Paragraph("Psychometric Engine (`membrain/`)", tbl_cell),
        ],
        [
            Paragraph("<b>Step 8</b>", tbl_cell_bold),
            Paragraph("Clinical Review", tbl_cell),
            Paragraph("Concerning, uncertain, or rapid changes populate the clinician task queue. Doctor evaluates comprehensive diagnostic dossier.", tbl_cell),
            Paragraph("Licensed Clinician (`CaseView.tsx`)", tbl_cell),
        ],
        [
            Paragraph("<b>Step 9</b>", tbl_cell_bold),
            Paragraph("Personalised Action Plan", tbl_cell),
            Paragraph("Clinician approves tailored pathway: reversible cause workup, lifestyle prevention, or specialist referral.", tbl_cell),
            Paragraph("Clinician-Approved Guidance", tbl_cell),
        ],
        [
            Paragraph("<b>Step 10</b>", tbl_cell_bold),
            Paragraph("Referral & Follow-Through", tbl_cell),
            Paragraph("Care Navigator connects patient to local services (SEHA, Cleveland Clinic, Tawam, Rashid) and tracks milestone completion.", tbl_cell),
            Paragraph("Navigator Engine (`membrain/navigator.py`)", tbl_cell),
        ],
        [
            Paragraph("<b>Step 11</b>", tbl_cell_bold),
            Paragraph("Longitudinal Monitoring", tbl_cell),
            Paragraph("Scheduled re-assessments (6 or 12 months) monitor intra-individual trajectories. New concerns can be lodged anytime.", tbl_cell),
            Paragraph("Automated Recall / Longitudinal Loop", tbl_cell),
        ],
    ]
    journey_table = Table(journey_data, colWidths=[50, 110, 192, 170])
    journey_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#0f3f2c")),
        ("ALIGN", (0, 0), (-1, -1), "LEFT"),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#94a3b8")),
        ("INNERGRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.HexColor("#ffffff"), colors.HexColor("#f8fafc")]),
        ("TOPPADDING", (0, 0), (-1, -1), 2),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
        ("LEFTPADDING", (0, 0), (-1, -1), 4),
        ("RIGHTPADDING", (0, 0), (-1, -1), 4),
    ]))
    story.append(journey_table)
    story.append(Spacer(1, 4))

    # =========================================================================
    # PART V: COGNITIVE BATTERY, ARABIC NLP & PSYCHOMETRICS
    # =========================================================================
    story.append(Paragraph("PART V: COGNITIVE BATTERY & PSYCHOMETRIC SPECIFICATION", h1_style))
    story.append(Paragraph(
        "MemBrain administers a culturally adapted 5-domain cognitive battery designed for colloquial Arabic (Gulf/Emirati, Levantine, Egyptian) "
        "and English. To prevent re-test memorization, the battery deploys three Latin-Square counterbalanced alternate forms (<b>Forms A, B, C</b>):",
        body_style,
    ))

    battery_data = [
        [
            Paragraph("Domain", tbl_hdr),
            Paragraph("Operational Task", tbl_hdr),
            Paragraph("Metric", tbl_hdr),
            Paragraph("Dialect Normalization & Scoring Logic", tbl_hdr),
        ],
        [
            Paragraph("<b>Immediate Memory</b>", tbl_cell_bold),
            Paragraph("10 culturally high-frequency nouns (Dates, Coffee, Falcon, Incense, etc.)", tbl_cell),
            Paragraph("0–10 raw", tbl_cell),
            Paragraph("Free spoken recall. Text normalized via diacritic stripping, alef/teh marbuta unification, and dialect synonym expansion.", tbl_cell),
        ],
        [
            Paragraph("<b>Delayed Recall</b>", tbl_cell_bold),
            Paragraph("Spontaneous recall of the 10 target words after ~5-minute distractor interval", tbl_cell),
            Paragraph("0–10 raw", tbl_cell),
            Paragraph("Probes hippocampal consolidation. Strongest single psychometric marker of early amnestic neurodegeneration.", tbl_cell),
        ],
        [
            Paragraph("<b>Verbal Fluency</b>", tbl_cell_bold),
            Paragraph("60-second semantic category generation (Market items, Animals, Kitchen utensils)", tbl_cell),
            Paragraph("0–30 raw", tbl_cell),
            Paragraph("Stemmed against verified dialect lexicons. Evaluates executive search efficiency and semantic clustering.", tbl_cell),
        ],
        [
            Paragraph("<b>Story Recall</b>", tbl_cell_bold),
            Paragraph("Narrative recall of 12 predefined idea units in a culturally resonant vignette", tbl_cell),
            Paragraph("0–12 raw", tbl_cell),
            Paragraph("Bipartite equivalence matching on normalized keyword sets (e.g., <i>[الجمعه, جمعه], [حفيدها, حفيد]</i>).", tbl_cell),
        ],
        [
            Paragraph("<b>Practical Judgement</b>", tbl_cell_bold),
            Paragraph("Real-world safety scenarios (kitchen oil fire, lost grandchild in mall, bank phone scam)", tbl_cell),
            Paragraph("0–4 raw", tbl_cell),
            Paragraph("Rubric-scored against essential action units (call civil defense, alert mall security, refuse banking credentials).", tbl_cell),
        ],
    ]
    battery_table = Table(battery_data, colWidths=[75, 140, 50, 257])
    battery_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#0f3f2c")),
        ("ALIGN", (0, 0), (-1, -1), "LEFT"),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#94a3b8")),
        ("INNERGRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.HexColor("#ffffff"), colors.HexColor("#f8fafc")]),
        ("TOPPADDING", (0, 0), (-1, -1), 2),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
        ("LEFTPADDING", (0, 0), (-1, -1), 4),
        ("RIGHTPADDING", (0, 0), (-1, -1), 4),
    ]))
    story.append(battery_table)
    story.append(Spacer(1, 4))

    # Stratified Normative Table
    story.append(Paragraph("5.1 Stratified Normative Demographics (Education & Age Attenuation)", h2_style))
    story.append(Paragraph(
        "Applying Western population cut-offs creates egregious diagnostic misclassifications: literate individuals are under-detected, "
        "while individuals without formal schooling suffer high false-positive rates. MemBrain stratifies normative means and standard deviations "
        "across four educational tiers:",
        body_style,
    ))

    edu_data = [
        [
            Paragraph("Educational Tier", tbl_hdr),
            Paragraph("Schooling", tbl_hdr),
            Paragraph("Word Learning (μ ± σ)", tbl_hdr),
            Paragraph("Delayed Recall (μ ± σ)", tbl_hdr),
            Paragraph("Story Recall (μ ± σ)", tbl_hdr),
            Paragraph("Judgement (μ ± σ)", tbl_hdr),
        ],
        [
            Paragraph("<b>None / Experiential</b>", tbl_cell_bold),
            Paragraph("0 years", tbl_cell),
            Paragraph("5.2 ± 1.6", tbl_cell),
            Paragraph("4.8 ± 1.7", tbl_cell),
            Paragraph("6.1 ± 2.1", tbl_cell),
            Paragraph("2.4 ± 1.0", tbl_cell),
        ],
        [
            Paragraph("<b>Primary Education</b>", tbl_cell_bold),
            Paragraph("1–6 years", tbl_cell),
            Paragraph("6.1 ± 1.5", tbl_cell),
            Paragraph("5.7 ± 1.6", tbl_cell),
            Paragraph("7.4 ± 1.9", tbl_cell),
            Paragraph("2.9 ± 0.9", tbl_cell),
        ],
        [
            Paragraph("<b>Secondary Education</b>", tbl_cell_bold),
            Paragraph("7–12 years", tbl_cell),
            Paragraph("6.9 ± 1.4", tbl_cell),
            Paragraph("6.5 ± 1.5", tbl_cell),
            Paragraph("8.6 ± 1.7", tbl_cell),
            Paragraph("3.3 ± 0.8", tbl_cell),
        ],
        [
            Paragraph("<b>Higher / University</b>", tbl_cell_bold),
            Paragraph(">12 years", tbl_cell),
            Paragraph("7.6 ± 1.3", tbl_cell),
            Paragraph("7.3 ± 1.4", tbl_cell),
            Paragraph("9.5 ± 1.5", tbl_cell),
            Paragraph("3.6 ± 0.6", tbl_cell),
        ],
    ]
    edu_table = Table(edu_data, colWidths=[120, 62, 85, 85, 85, 85])
    edu_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#0f3f2c")),
        ("ALIGN", (0, 0), (-1, -1), "LEFT"),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#94a3b8")),
        ("INNERGRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.HexColor("#ffffff"), colors.HexColor("#f8fafc")]),
        ("TOPPADDING", (0, 0), (-1, -1), 2),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
        ("LEFTPADDING", (0, 0), (-1, -1), 4),
        ("RIGHTPADDING", (0, 0), (-1, -1), 4),
    ]))
    story.append(edu_table)
    story.append(Spacer(1, 4))

    # Formula Box
    formula_html = (
        "<b>Mathematical Formulation: Practice-Adjusted Reliable Change Index (Jacobson-Truax):</b><br/>"
        "&nbsp;&nbsp;&nbsp;&nbsp;<b>RCI</b> = [ (X<sub>n</sub> - X̄<sub>baseline</sub>) - (g(n) - ḡ<sub>baseline</sub>) ] / SE<sub>diff</sub><br/>"
        "&nbsp;&nbsp;&nbsp;&nbsp;<b>SE<sub>diff</sub></b> = SD · √(1 - r<sub>xx</sub>) · √(1 + 1/k)<br/>"
        "&nbsp;&nbsp;&nbsp;&nbsp;<b>g(n)</b> = Expected Practice Gain Per Session · min(n, 3) &nbsp;&nbsp;&nbsp;&nbsp;<i>(where k = 2 baseline sessions, r<sub>xx</sub> = test-retest reliability)</i>"
    )
    story.append(make_callout(formula_html, title="MATHEMATICAL SPECIFICATION: PRACTICE-ADJUSTED RCI", kind="info", width=522))
    story.append(Spacer(1, 4))

    # Triage Operational States Table
    story.append(Paragraph("5.2 Four Triage Operational Workflow States", h2_style))
    triage_data = [
        [
            Paragraph("Triage State", tbl_hdr),
            Paragraph("Trigger Criteria", tbl_hdr),
            Paragraph("Action & Feedback Protocol", tbl_hdr),
            Paragraph("Clinical SLA", tbl_hdr),
        ],
        [
            Paragraph("<b>1. STABLE</b>", tbl_cell_bold),
            Paragraph("Composite RCI &gt; -1.645 AND<br/>Delayed Recall RCI &gt; -1.96", tbl_cell),
            Paragraph("Reassuring feedback; educational brain-health guidance; schedule routine re-check in 6–12 months.", tbl_cell),
            Paragraph("Routine<br/>(6–12 mos)", tbl_cell),
        ],
        [
            Paragraph("<b>2. REPEAT / CLARIFY</b>", tbl_cell_bold),
            Paragraph("Single domain drop, transient confounder (sleep &lt; 5h, PHQ-2 ≥ 3), or poor audio SNR (&lt; 15 dB)", tbl_cell),
            Paragraph("Withhold alarming notice; explain potential confounders; automatically schedule alternate-form repeat in 2–4 weeks.", tbl_cell),
            Paragraph("Repeat Window<br/>(2–4 weeks)", tbl_cell),
        ],
        [
            Paragraph("<b>3. CLINICIAN REVIEW</b>", tbl_cell_bold),
            Paragraph("Confirmed drop on repeat (RCI ≤ -1.645); first-visit z ≤ -2.0; baseline z ≤ -1.5; or functional dependency", tbl_cell),
            Paragraph("Route to clinician workspace queue; compile Clinical Review Packet; patient receives notification of clinician review.", tbl_cell),
            Paragraph("Target Target<br/><b>24 Hours</b>", tbl_cell),
        ],
        [
            Paragraph("<b>4. URGENT ASSESSMENT</b>", tbl_cell_bold),
            Paragraph("Sudden confusion, unilateral motor weakness, facial droop, acute speech loss, rapid acute drop", tbl_cell),
            Paragraph("Immediate emergency redirection; display 998 hotline; urgent clinical task notification flagged in red.", tbl_cell),
            Paragraph("Emergency<br/><b>Immediate / 24h</b>", tbl_cell),
        ],
    ]
    triage_table = Table(triage_data, colWidths=[80, 140, 212, 90])
    triage_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#0f3f2c")),
        ("ALIGN", (0, 0), (-1, -1), "LEFT"),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#94a3b8")),
        ("INNERGRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.HexColor("#ffffff"), colors.HexColor("#f8fafc")]),
        ("TOPPADDING", (0, 0), (-1, -1), 2),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
        ("LEFTPADDING", (0, 0), (-1, -1), 4),
        ("RIGHTPADDING", (0, 0), (-1, -1), 4),
    ]))
    story.append(triage_table)
    story.append(Spacer(1, 4))

    # =========================================================================
    # PART VI: CARE NAVIGATOR & 7-STAGE CLOSED-LOOP REFERRALS
    # =========================================================================
    story.append(Paragraph("PART VI: CARE NAVIGATOR & 7-STAGE CLOSED-LOOP REFERRALS", h1_style))
    story.append(Paragraph(
        "Referral failure is the primary cause of diagnostic delays. The MemBrain Navigator executes an automated, 7-stage "
        "deterministic state machine (`membrain/navigator.py`) that tracks each participant until clinical resolution:",
        body_style,
    ))

    nav_data = [
        [
            Paragraph("Stage # & State", tbl_hdr),
            Paragraph("Milestone Description", tbl_hdr),
            Paragraph("Required Verification & Metadata", tbl_hdr),
            Paragraph("Operational SLA & Escalation", tbl_hdr),
        ],
        [
            Paragraph("<b>1. Recommended</b>", tbl_cell_bold),
            Paragraph("Algorithmic Triage Flag", tbl_cell),
            Paragraph("System generates proposed pathway based on cognitive RCI, functional history, and geographic location.", tbl_cell),
            Paragraph("Automatic<br/>(Immediate on check-in)", tbl_cell),
        ],
        [
            Paragraph("<b>2. Clinician Approved</b>", tbl_cell_bold),
            Paragraph("Physician Review & Sign-Off", tbl_cell),
            Paragraph("Attending doctor reviews Clinical Review Packet, confirms indication, and authorizes referral.", tbl_cell),
            Paragraph("Target: 21 calendar days<br/>(Escalates at day 14)", tbl_cell),
        ],
        [
            Paragraph("<b>3. Referral Sent</b>", tbl_cell_bold),
            Paragraph("Transmission to Receiving Service", tbl_cell),
            Paragraph("FHIR ServiceRequest bundle transmitted to Malaffi / Nabidh or facility referral office.", tbl_cell),
            Paragraph("Within 48 hours of approval", tbl_cell),
        ],
        [
            Paragraph("<b>4. Accepted / Declined</b>", tbl_cell_bold),
            Paragraph("Receiving Facility Triage", tbl_cell),
            Paragraph("Target clinic accepts or provides formal decline reason (e.g. out of catchment, capacity full).", tbl_cell),
            Paragraph("Target: 5 business days<br/>(Alerts coordinator if declined)", tbl_cell),
        ],
        [
            Paragraph("<b>5. Appt Offered</b>", tbl_cell_bold),
            Paragraph("Consultation Scheduled", tbl_cell),
            Paragraph("Appointment date, facility location, and attending specialist logged in patient dossier.", tbl_cell),
            Paragraph("Within 14 calendar days", tbl_cell),
        ],
        [
            Paragraph("<b>6. Attended / Missed</b>", tbl_cell_bold),
            Paragraph("Encounter Verification", tbl_cell),
            Paragraph("Attendance confirmed via clinic encounter feed or patient check-in. If missed, re-booking triggers.", tbl_cell),
            Paragraph("Encounter Date<br/>(Re-engagement within 48h)", tbl_cell),
        ],
        [
            Paragraph("<b>7. Completed & Plan</b>", tbl_cell_bold),
            Paragraph("Clinical Encounter Documented", tbl_cell),
            Paragraph("Consultant notes, definitive diagnosis, care plan, or repeat monitoring interval uploaded.", tbl_cell),
            Paragraph("Loop Closure<br/>(Archived to longitudinal loop)", tbl_cell),
        ],
    ]
    nav_table = Table(nav_data, colWidths=[70, 110, 172, 170])
    nav_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#0f3f2c")),
        ("ALIGN", (0, 0), (-1, -1), "LEFT"),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#94a3b8")),
        ("INNERGRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.HexColor("#ffffff"), colors.HexColor("#f8fafc")]),
        ("TOPPADDING", (0, 0), (-1, -1), 2),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
        ("LEFTPADDING", (0, 0), (-1, -1), 4),
        ("RIGHTPADDING", (0, 0), (-1, -1), 4),
    ]))
    story.append(nav_table)
    story.append(Spacer(1, 4))

    # =========================================================================
    # PART VII: DATASET ASSUMPTIONS & EPIDEMIOLOGICAL MODELLING
    # =========================================================================
    story.append(Paragraph("PART VII: DATASET ASSUMPTIONS & EPIDEMIOLOGICAL MODELLING", h1_style))
    story.append(Paragraph(
        "MemBrain's simulation pipelines and normative architectures are parameterized against published UAE epidemiological data, "
        "Statistics Centre Abu Dhabi (SCAD) demographic surveys, and peer-reviewed regional dementia literature:",
        body_style,
    ))

    data_assump = [
        [
            Paragraph("Parameter & Domain", tbl_hdr),
            Paragraph("Assumed Value", tbl_hdr),
            Paragraph("Clinical & Empirical Evidence Base", tbl_hdr),
            Paragraph("Engine Sensitivity & Impact", tbl_hdr),
        ],
        [
            Paragraph("<b>Target Population Age</b>", tbl_cell_bold),
            Paragraph("50–75 years", tbl_cell),
            Paragraph("Optimal window for secondary prevention prior to irreversible neurodegeneration (Lancet Commission).", tbl_cell),
            Paragraph("Calibrates normative z-score regression slopes and age attenuation.", tbl_cell),
        ],
        [
            Paragraph("<b>Dementia Prevalence (60+)</b>", tbl_cell_bold),
            Paragraph("6.2% base rate", tbl_cell),
            Paragraph("Epidemiological estimates for Gulf Cooperation Council (GCC) elder population.", tbl_cell),
            Paragraph("Determines Bayesian prior probabilities for composite triage thresholds.", tbl_cell),
        ],
        [
            Paragraph("<b>MCI Annual Progression</b>", tbl_cell_bold),
            Paragraph("12% per annum", tbl_cell),
            Paragraph("Transition probability from Mild Cognitive Impairment to clinical dementia without intervention.", tbl_cell),
            Paragraph("Parameters Markov transition matrices in Monte Carlo simulation models.", tbl_cell),
        ],
        [
            Paragraph("<b>ApoE ε4 Allele Frequency</b>", tbl_cell_bold),
            Paragraph("11.4% prevalence", tbl_cell),
            Paragraph("UAE National Genome Project and regional MENA genetic diversity cohorts.", tbl_cell),
            Paragraph("Used exclusively for clinical review context when consented; never used autonomously.", tbl_cell),
        ],
        [
            Paragraph("<b>Cardiovascular Co-morbidity</b>", tbl_cell_bold),
            Paragraph("HTN: 48%, T2D: 32%", tbl_cell),
            Paragraph("Published UAE Ministry of Health and Prevention national health surveys.", tbl_cell),
            Paragraph("Triggers priority vascular prevention education in Module G.", tbl_cell),
        ],
        [
            Paragraph("<b>Healthcare Insurance Mix</b>", tbl_cell_bold),
            Paragraph("Thiqa: 35%, Basic: 65%", tbl_cell),
            Paragraph("Abu Dhabi Department of Health regulatory coverage strata.", tbl_cell),
            Paragraph("Filters accessible services in Navigator service directory (`NAV.funding`).", tbl_cell),
        ],
    ]
    data_table = Table(data_assump, colWidths=[110, 100, 150, 162])
    data_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#0f3f2c")),
        ("ALIGN", (0, 0), (-1, -1), "LEFT"),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#94a3b8")),
        ("INNERGRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.HexColor("#ffffff"), colors.HexColor("#f8fafc")]),
        ("TOPPADDING", (0, 0), (-1, -1), 2),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
        ("LEFTPADDING", (0, 0), (-1, -1), 4),
        ("RIGHTPADDING", (0, 0), (-1, -1), 4),
    ]))
    story.append(data_table)
    story.append(Spacer(1, 4))

    # =========================================================================
    # PART VIII: CLINICAL BOUNDARIES & CONFOUNDER WORKUP
    # =========================================================================
    story.append(Paragraph("PART VIII: CLINICAL BOUNDARIES & CONFOUNDER WORKUP", h1_style))
    story.append(Paragraph(
        "A cornerstone of MemBrain's clinical safety is the systematic differentiation between irreversible neurodegeneration and "
        "reversible, treatable cognitive confounders. Cognitive triage is suspended whenever active confounders are present:",
        body_style,
    ))

    confounder_data = [
        [
            Paragraph("Confounder", tbl_hdr),
            Paragraph("Screening Threshold", tbl_hdr),
            Paragraph("Mechanism of Cognitive Disruption", tbl_hdr),
            Paragraph("Mandated Workup & Mitigation", tbl_hdr),
        ],
        [
            Paragraph("<b>Sleep Deprivation</b>", tbl_cell_bold),
            Paragraph("&lt; 5.0 hours sleep<br/>or poor quality", tbl_cell),
            Paragraph("Impaired glymphatic clearance, severe prefrontal executive lapse, slow processing.", tbl_cell),
            Paragraph("Invalidates session for baseline establishment; auto-schedule re-check after restorative sleep.", tbl_cell),
        ],
        [
            Paragraph("<b>Depressive Pseudodementia</b>", tbl_cell_bold),
            Paragraph("PHQ-2 score ≥ 3", tbl_cell),
            Paragraph("Psychomotor slowing, motivational deficit, poor effort mimic amnestic decline.", tbl_cell),
            Paragraph("Primary care referral for mood management; cognitive triage marked 'Confounded by Mood'.", tbl_cell),
        ],
        [
            Paragraph("<b>Metabolic Deficiency</b>", tbl_cell_bold),
            Paragraph("Unchecked labs in &gt;12 mos", tbl_cell),
            Paragraph("Vitamin B12 deficiency (&lt; 148 pmol/L) and hypothyroidism (elevated TSH) cause reversible impairment.", tbl_cell),
            Paragraph("Navigator orders standard laboratory panel before memory clinic specialist referral.", tbl_cell),
        ],
        [
            Paragraph("<b>Sensory Impairment</b>", tbl_cell_bold),
            Paragraph("Pre-check failure (hearing/vision)", tbl_cell),
            Paragraph("Inaudible stimuli or uncorrected vision produce artifactually depressed test scores.", tbl_cell),
            Paragraph("Enforces headphone use; checks reading glasses; offers non-voice alternative protocols.", tbl_cell),
        ],
        [
            Paragraph("<b>Acute Delirium / Red Flag</b>", tbl_cell_bold),
            Paragraph("Sudden onset (&lt;48h), fever, neurological signs", tbl_cell),
            Paragraph("Medical emergency (stroke, sepsis, acute intracranial hemorrhage, toxic encephalopathy).", tbl_cell),
            Paragraph("<b>IMMEDIATE 998 REDIRECTION</b>; halts all cognitive testing; alerts attending clinical queue.", tbl_cell),
        ],
    ]
    conf_table = Table(confounder_data, colWidths=[100, 120, 160, 142])
    conf_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#0f3f2c")),
        ("ALIGN", (0, 0), (-1, -1), "LEFT"),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#94a3b8")),
        ("INNERGRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.HexColor("#ffffff"), colors.HexColor("#f8fafc")]),
        ("TOPPADDING", (0, 0), (-1, -1), 2),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
        ("LEFTPADDING", (0, 0), (-1, -1), 4),
        ("RIGHTPADDING", (0, 0), (-1, -1), 4),
    ]))
    story.append(conf_table)
    story.append(Spacer(1, 4))

    # =========================================================================
    # PART IX: KNOWN LIMITATIONS & RISK MITIGATION
    # =========================================================================
    story.append(Paragraph("PART IX: KNOWN TECHNICAL & CLINICAL LIMITATIONS", h1_style))
    story.append(Paragraph(
        "Responsible deployment requires explicit articulation of current engineering and clinical limitations alongside active mitigations:",
        body_style,
    ))

    limit_data = [
        [
            Paragraph("Limitation Area", tbl_hdr),
            Paragraph("Technical Nature of Constraint", tbl_hdr),
            Paragraph("Potential Clinical Risk", tbl_hdr),
            Paragraph("Active Architectural Mitigation", tbl_hdr),
        ],
        [
            Paragraph("<b>Dialectal ASR Error Rate</b>", tbl_cell_bold),
            Paragraph("Colloquial Gulf/Emirati phonology can yield Word Error Rate (WER) &gt; 12% in low SNR.", tbl_cell),
            Paragraph("Mis-transcribed recall items could lead to false low cognitive scores.", tbl_cell),
            Paragraph("Pre-check enforces SNR ≥ 15 dB; fuzzy matching expands common dialect phonemes; fallback to typed/caregiver.", tbl_cell),
        ],
        [
            Paragraph("<b>Digital Literacy Barriers</b>", tbl_cell_bold),
            Paragraph("Older adults with limited smartphone familiarity may experience test anxiety.", tbl_cell),
            Paragraph("Digital friction creates artificial latency, misclassified as cognitive slowing.", tbl_cell),
            Paragraph("Guided conversational voice interface; caregiver-assisted protocol; large touch targets; audio read-back.", tbl_cell),
        ],
        [
            Paragraph("<b>Informant Reporting Bias</b>", tbl_cell_bold),
            Paragraph("Family member accounts may be influenced by caregiver burnout or denial.", tbl_cell),
            Paragraph("Over-reporting or under-reporting of functional IADL decline.", tbl_cell),
            Paragraph("Attribution tagging: source of concern (self vs. family vs. helper) is tracked distinctly; never merged silently.", tbl_cell),
        ],
        [
            Paragraph("<b>Practice Effect Ceiling</b>", tbl_cell_bold),
            Paragraph("Highly educated participants learn test formats over repeated exposures.", tbl_cell),
            Paragraph("Masking subtle early neurodegeneration behind learned test performance.", tbl_cell),
            Paragraph("3 Latin-Square counterbalanced forms (A, B, C); Jacobson-Truax RCI mathematical practice gain adjustment.", tbl_cell),
        ],
        [
            Paragraph("<b>Referral Network Capacity</b>", tbl_cell_bold),
            Paragraph("Specialized memory clinic appointment wait times exceed 90 days in certain areas.", tbl_cell),
            Paragraph("Patient anxiety and delayed specialist workup.", tbl_cell),
            Paragraph("Care Navigator prioritizes primary care workup and vascular optimization while patient awaits specialist review.", tbl_cell),
        ],
    ]
    limit_table = Table(limit_data, colWidths=[115, 135, 145, 127])
    limit_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#0f3f2c")),
        ("ALIGN", (0, 0), (-1, -1), "LEFT"),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#94a3b8")),
        ("INNERGRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.HexColor("#ffffff"), colors.HexColor("#f8fafc")]),
        ("TOPPADDING", (0, 0), (-1, -1), 2),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
        ("LEFTPADDING", (0, 0), (-1, -1), 4),
        ("RIGHTPADDING", (0, 0), (-1, -1), 4),
    ]))
    story.append(limit_table)
    story.append(Spacer(1, 4))

    # =========================================================================
    # PART X: DATA GOVERNANCE & REGULATORY STRATEGY
    # =========================================================================
    story.append(Paragraph("PART X: DATA PRIVACY, GOVERNANCE & REGULATORY STRATEGY", h1_style))
    story.append(Paragraph(
        "MemBrain is engineered in strict compliance with the United Arab Emirates healthcare data protection framework:",
        body_style,
    ))
    story.append(Paragraph("• <b>UAE Federal Law No. 2 of 2019 (Health ICT Law):</b> Mandates that all health data originated in the UAE must be stored, processed, and retained within UAE borders. MemBrain deploys exclusively to sovereign Microsoft Azure UAE North (Dubai / Abu Dhabi). Zero cross-border health data transfers occur.", bullet_style))
    story.append(Paragraph("• <b>ADHICS Compliance:</b> Implements Department of Health Abu Dhabi Information and Cyber Security Standards. Dual-key encryption isolates the civil identity vault from clinical records. Pseudonymous identifier tokens (`MB-P...`) prevent unconsented re-identification.", bullet_style))
    story.append(Paragraph("• <b>Cryptographic Hash-Chained Audit Ledger:</b> Every clinician action, case assignment, referral status update, and data access is immutably recorded in a SHA-256 hash-chained audit log (`DB['audit']`), ensuring complete traceability.", bullet_style))
    story.append(Paragraph("• <b>SaMD Class B Regulatory Pathway:</b> Positioned as Software as a Medical Device (SaMD) Class B under UAE Ministry of Health and Prevention (MOHAP) and Emirates Drug Establishment (EDE) guidelines. As a clinical decision support tool with a licensed physician always in the loop, MemBrain does not autonomously diagnose or prescribe.", bullet_style))

    # =========================================================================
    # PART XI: PHASED CLINICAL IMPLEMENTATION ROADMAP (2026–2028)
    # =========================================================================
    story.append(Paragraph("PART XI: PHASED CLINICAL IMPLEMENTATION ROADMAP (2026–2028)", h1_style))
    story.append(Paragraph(
        "The phased evaluation strategy transitions MemBrain from community prototype feasibility to rigorous population-level impact:",
        body_style,
    ))

    roadmap_data = [
        [
            Paragraph("Phase & Period", tbl_hdr),
            Paragraph("Milestone Focus", tbl_hdr),
            Paragraph("Target Population & Cohort", tbl_hdr),
            Paragraph("Primary Evaluation Outcomes", tbl_hdr),
        ],
        [
            Paragraph("<b>Phase 0</b><br/>Q1–Q2 2026", tbl_cell_bold),
            Paragraph("Discovery & Co-Design", tbl_cell),
            Paragraph("Abu Dhabi elder cohorts, SEHA primary care teams, caregiver focus groups.", tbl_cell),
            Paragraph("Dialect adaptation, workflow acceptability, community referral pathway mapping, governance approval.", tbl_cell),
        ],
        [
            Paragraph("<b>Phase 1</b><br/>Q3–Q4 2026", tbl_cell_bold),
            Paragraph("Prototype Feasibility", tbl_cell),
            Paragraph("N = 500 community participants across Abu Dhabi, Al Ain, and Dubai.", tbl_cell),
            Paragraph("ASR word error rate (&lt;10%), concern capture completion (&gt;90%), usability score (&gt;85 SUS), zero emergency missed.", tbl_cell),
        ],
        [
            Paragraph("<b>Phase 2</b><br/>Q1–Q4 2027", tbl_cell_bold),
            Paragraph("Psychometric Validation", tbl_cell),
            Paragraph("N = 2,500 longitudinal cohort with expert clinician clinical reference standard.", tbl_cell),
            Paragraph("Test-retest reliability (r ≥ 0.85), sensitivity (&gt;85%) & specificity (&gt;88%) for MCI, RCI practice gain calibration.", tbl_cell),
        ],
        [
            Paragraph("<b>Phase 3</b><br/>2028+", tbl_cell_bold),
            Paragraph("Population Care-Pathway", tbl_cell),
            Paragraph("N = 10,000+ national rollout integrated with Malaffi / Nabidh HIE.", tbl_cell),
            Paragraph("Referral drop-off reduction (from 70% to &lt;20%), time-to-consultation reduction (from 18 mos to &lt;21 days), health economics.", tbl_cell),
        ],
    ]
    roadmap_table = Table(roadmap_data, colWidths=[55, 95, 160, 212])
    roadmap_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#0f3f2c")),
        ("ALIGN", (0, 0), (-1, -1), "LEFT"),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#94a3b8")),
        ("INNERGRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.HexColor("#ffffff"), colors.HexColor("#f8fafc")]),
        ("TOPPADDING", (0, 0), (-1, -1), 2),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
        ("LEFTPADDING", (0, 0), (-1, -1), 4),
        ("RIGHTPADDING", (0, 0), (-1, -1), 4),
    ]))
    story.append(roadmap_table)
    story.append(Spacer(1, 6))

    story.append(HRFlowable(width="100%", thickness=0.5, color=colors.HexColor("#cbd5e1"), spaceBefore=4, spaceAfter=4))
    story.append(Paragraph(
        "<i>Document compiled in strict accordance with MemBrain Clinical Governance, UAE Federal Health ICT Law, "
        "and Team Cerebro Spark Engineering Standards · Future Health Digital Innovation Challenge.</i>",
        code_style,
    ))

    # Build PDF with two-pass canvas
    doc.build(story, canvasmaker=NumberedCanvas)
    print(f"Successfully generated technical documentation PDF at: {output_path}")


if __name__ == "__main__":
    output_pdf = sys.argv[1] if len(sys.argv) > 1 else "MemBrain_Technical_Documentation_Comprehensive.pdf"
    build_technical_documentation_pdf(output_pdf)

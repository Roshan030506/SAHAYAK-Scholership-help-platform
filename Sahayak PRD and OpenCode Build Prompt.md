# Sahayak: PRD and OpenCode Build Prompt

*Find what you deserve, and we apply for you.* Prepared for IDEA//FORGE Online Hackathon, Track 1 (Civic Pulse), Problems 1 + 3.

**How to use this doc:** Save Part A as `PRD.md` in an empty project folder. Open the folder in opencode, switch to plan mode, paste the prompt in Part B, review the plan, then switch to build mode. Build in the phases listed; do not let the agent do everything in one shot.

## Part A: Product Requirements Document

### 1. Vision

A voice-first AI copilot that takes a citizen from 'I don't know what I qualify for' to 'application submitted, here is my receipt'. It listens in the user's language, reads their documents, matches them to schemes, explains rights, fills the application form through a browser agent, and submits only after explicit user consent.

### 2. Problem

Many eligible people miss scholarships and subsidies because notices are in complex language, eligibility rules are scattered, documents are confusing, and portals are hard to use, especially for people not comfortable with English or typing. Many give up at the form.

### 3. Target users

- **Primary: Riya, 19, rural Maharashtra student.** Speaks Marathi, uses a mid-range Android phone, does not know which scholarships she qualifies for, and has a deadline.
- **Secondary: Helper or CSC operator** who assists many applicants and needs speed and an audit trail.
- **Judge persona:** needs to see the full journey in 3 minutes.

### 4. Goals and non-goals

**Goals**

- G1: Discovery to submission in under 5 minutes in the demo.
- G2: Voice input and output in English, Hindi and Marathi.
- G3: Every eligibility result is explained in plain language with the exact rule that passed or failed.
- G4: Consent before every submission, with a full audit log.

**Non-goals (MVP)**

- No automation of real government portals (CAPTCHA, OTP and Aadhaar rules make this fragile and legally sensitive). The MVP targets a built-in mock portal and documents how production would use official APIs or assisted mode.
- No payment, no Aadhaar storage, no native mobile app.

### 5. MVP scope

- Domain: **student scholarships**.
- A curated scholarship catalogue (see section 10), stored as editable JSON. The demo now ships 14 verified central, Maharashtra, tribal, AICTE and CSR schemes, plus a separate directory of 10 official application portals.
- Documents: income certificate, marksheet, caste certificate, ration card (synthetic samples included for demo).
- Languages: English, Hindi, Marathi.

### 6. Core user journey

1. **Talk or type:** user selects a language and speaks about themselves ('I am a 12th pass girl from Pune, family income about 6 lakh').
2. **Snap:** user uploads document photos; the system extracts fields and shows them for correction.
3. **Match:** profile is checked against all schemes; results ranked by benefit with pass/fail reasons.
4. **Explain:** missing documents, deadlines and where to obtain documents are shown; user can ask follow-up questions by voice.
5. **Apply:** user picks a scheme; the agent opens the mock portal, fills the form live (screenshots streamed), handles validation errors and retries.
6. **Consent:** agent pauses on the review screen; user confirms by tap or voice ('yes, submit').
7. **Track:** receipt PDF, application ID, status timeline with simulated updates.

### 7. Functional requirements

**Profile and voice**

- FR-1: Capture user profile through guided conversation and form; fields: name, age, gender, state, district, category (General/OBC/SC/ST/EWS), annual family income, education level, last exam percentage, course, institution type, disability status, bank account present (yes/no).
- FR-2: Speech-to-text and text-to-speech in en, hi, mr using the browser Web Speech API by default, with a pluggable server-side provider interface.
- FR-3: LLM extracts structured profile updates from free-form speech or text and returns them for confirmation.

**Documents**

- FR-4: Upload image or PDF; vision LLM extracts typed fields with a per-field confidence score.
- FR-5: User can review and edit extracted values; low-confidence fields highlighted.
- FR-6: Demo mode works with no API key by using pre-baked extraction results for the bundled sample documents.

**Eligibility**

- FR-7: Deterministic rules engine evaluates each scheme's JSON rules (operators: eq, in, lt, lte, gt, gte, between, exists). The LLM never decides eligibility; it only explains.
- FR-8: Each result returns status (eligible, likely, not\_eligible), list of passed and failed rules with human-readable reasons, missing documents and benefit amount.
- FR-9: Results ranked by annual benefit value, then by deadline urgency.
- FR-10: Reasons are translated into the selected language.

**Explain and rights**

- FR-11: Chat assistant answers questions about a scheme, grounded only on the scheme JSON and notice text (RAG over a small local vector or keyword index), with citations to the scheme source.
- FR-12: 'Your rights' card per scheme: what the applicant can demand, grievance contact, appeal steps (as data in the scheme JSON).

**Application agent**

- FR-13: Playwright agent logs into the mock portal with a demo account, fills the multi-step form from the profile, uploads documents, and handles validation errors by reading the error text and correcting the value or asking the user.
- FR-14: Live progress stream (SSE) with step names, screenshots and agent messages.
- FR-15: Hard consent gate: the agent cannot click Final Submit until the backend records a consent token tied to the application draft; consent supports tap and voice.
- FR-16: Retry with backoff on transient failures (mock portal has a toggle that injects random timeouts and a validation error to prove resilience).
- FR-17: On success, store the receipt, application ID and screenshot; generate a receipt PDF.

**Tracking and audit**

- FR-18: Status timeline (Submitted, Under Review, Verified, Approved or Rejected) advanced by a simulated worker; visible on the dashboard.
- FR-19: Immutable audit log for each application: every agent action, timestamp, field values filled (sensitive values masked), consent event.

**Privacy and admin**

- FR-20: 'Delete my data' button wipes profile, documents and applications.
- FR-21: Uploaded files are stored locally, auto-deleted after 24 hours by default.
- FR-22: Admin page lists schemes and lets the operator edit the scheme JSON with validation.

### 8. Non-functional requirements

- Time to first result under 3 seconds in demo mode; agent run under 90 seconds.
- Works on a 360px wide mobile browser and desktop.
- 3D scene holds 60 fps on a mid-range laptop; automatic fallback to a 2D version when WebGL is unavailable or the user has reduced motion enabled.
- Accessibility: keyboard navigation, ARIA labels, high-contrast mode, large-text mode.
- No secrets in the frontend; all LLM calls go through the backend.

### 9. Architecture

- **Frontend:** Vite, React, TypeScript, Tailwind, react-three-fiber, drei, framer-motion, i18next, Zustand.
- **Backend:** Python 3.11, FastAPI, SQLAlchemy with SQLite, Pydantic v2, Server-Sent Events for progress.
- **Agent:** Playwright (Python, Chromium) driven by a step-planner module; LLM used only for error interpretation and field mapping fallbacks.
- **LLM layer:** provider interface with implementations for Anthropic, OpenAI and a `MockProvider`; selected by env var.
- **Mock portal:** separate FastAPI sub-app serving a realistic multi-step scholarship application site at `/mock-portal`.
- **Data:** `schemes/*.json`, `locales/{en,hi,mr}.json`, `samples/` synthetic documents.

### 10. Scheme catalogue (illustrative, editable JSON)

The rules below are **sample thresholds for demo purposes**. Before any real use, verify each against the official notification.

The original five demo schemes remain in the catalogue. The shipped demo expands this to **14 schemes** and keeps official portals in a separate directory so they never appear as eligibility matches.

1. Post-Matric Scholarship for SC students (central): category SC, income cap, post-10th course.
2. Central Sector Scholarship Scheme: marks above a percentile cutoff in 12th, income cap, undergraduate course.
3. National Means-cum-Merit Scholarship: class 8 level, income cap, state school (included to show a not\_eligible example).
4. Maharashtra fee-reimbursement scheme for economically weaker or OBC students: category in list, income cap, state domicile.
5. A disability-focused education scholarship: disability true, any income below cap.

Added after verifying official sources:

6. AICTE Pragati Scholarship for Girls (technical degree or diploma).
7. AICTE Saksham Scholarship for Students with Disabilities.
8. Rajarshi Chhatrapati Shahu Maharaj EBC Fee Scholarship (Maharashtra).
9. Maharashtra OBC Post-Matric Scholarship.
10. Post-Matric Scholarship for ST students.
11. SBI Asha Scholarship (CSR).
12. HDFC Bank Parivartan ECSS Scholarship (CSR).
13. Reliance Foundation Undergraduate Scholarship (CSR).
14. NorthSouth Foundation Scholarship (foundation).

Official portals live in `backend/app/data/portals.json` and are served from `GET /api/portals`. The directory covers the National Scholarship Portal, MahaDBT 2.0, MyScheme, Ministry of Tribal Affairs DBT, AICTE fellowships, Social Justice SAMAVESH, DWBDNC, Buddy4Study, Vidyasaarathi and ScholarsBox.

Each scheme JSON: id, name (en/hi/mr), authority, benefit\_amount\_per\_year, deadline, rules\[\], required\_documents\[\], rights\[\], grievance\_contact, source\_url, apply\_url.

### 11. Data model

- `User(id, language, created_at)`
- `Profile(user_id, fields JSON, updated_at)`
- `Document(id, user_id, type, path, extracted JSON, confidence JSON, expires_at)`
- `Application(id, user_id, scheme_id, status, draft JSON, consent_token, portal_application_id, receipt_path, created_at)`
- `AuditEvent(id, application_id, ts, actor [user|agent|system], action, detail JSON)`
- `StatusEvent(id, application_id, status, ts)`

### 12. API surface

- `POST /api/session`: create anonymous session.
- `GET/PUT /api/profile`
- `POST /api/profile/from-text`: LLM extracts profile fields from speech text.
- `POST /api/documents`: upload and extract.
- `PUT /api/documents/{id}`: user corrections.
- `POST /api/match`: returns ranked eligibility results.
- `GET /api/schemes`, `GET /api/schemes/{id}`
- `POST /api/chat`: grounded Q&A (streamed).
- `POST /api/applications`: create draft for a scheme.
- `POST /api/applications/{id}/run`: start agent.
- `GET /api/applications/{id}/events`: SSE stream of progress and screenshots.
- `POST /api/applications/{id}/consent`: records consent; releases the agent.
- `GET /api/applications/{id}`, `GET /api/applications/{id}/receipt`, `GET /api/applications/{id}/audit`
- `DELETE /api/me`: delete all user data.
- Mock portal: `/mock-portal/login`, `/step/1..4`, `/review`, `/submit`, `/receipt/{id}`.

### 13. 3D UI specification

Visual concept: **'The Scheme Garden'**, a calm, luminous 3D world.

- **Landing hero:** a floating 3D glass orb (the 'voice orb') at center that pulses with microphone amplitude; around it, scheme cards drift as translucent 3D tiles on a slow orbit. Soft gradient sky (saffron to teal), subtle particles.
- **Voice interaction:** orb states: idle (breathing), listening (ripples responding to volume), thinking (swirling particles), speaking (waveform ring).
- **Documents step:** uploaded document appears as a 3D card that flips and scans with a light beam; extracted fields fly out as floating chips and snap into the profile panel.
- **Results:** eligible schemes rise as 3D pillars or glowing cards on a shallow stage, height proportional to annual benefit, green for eligible, amber for likely, grey for not eligible. Hover tilts the card with parallax; click zooms the camera to the scheme detail.
- **Agent run:** a 3D browser window floats in space showing the live screenshot stream, with a progress path of glowing nodes (Login, Personal, Education, Documents, Review, Consent, Submit).
- **Consent moment:** a large glowing 'Confirm and submit' button with a hold-to-confirm ring and voice option.
- **Success:** confetti burst and the receipt card floating forward.
- **UX rules:** 3D enhances, never blocks; every 3D element has a 2D accessible equivalent in the DOM; `prefers-reduced-motion` and low-power detection switch to a flat layout; lazy-load the 3D bundle; mobile uses a simplified scene.
- **Design tokens:** colors saffron #F59E0B, teal #0F766E, deep navy #0B1B3A, soft white #F8FAFC; fonts Poppins for headings, Noto Sans with Devanagari support for body.

### 14. Responsible AI and privacy

- Eligibility decided by deterministic rules, not by the LLM; LLM output is explanation only.
- Consent gate and audit log on every submission.
- No Aadhaar numbers stored; mask any ID-like numbers in logs.
- Clear banner: 'Demo uses a mock portal and sample scheme data. Always verify on the official source.'
- Confidence scores shown; the user confirms extracted data before it is used.

### 15. Success metrics

- Extraction accuracy on sample documents above 90 percent of fields.
- Eligibility engine passes all unit tests (at least 25 cases).
- End-to-end agent run succeeds in 9 of 10 runs, including the injected-failure mode.
- Full demo completes in under 3 minutes.

### 16. Demo script (3 minutes)

1. 0:00 Problem in one sentence; show the orb.
2. 0:20 Speak in Marathi: profile is built live.
3. 0:50 Upload income certificate and marksheet: the scan animation and field chips.
4. 1:20 Ranked 3D results with plain-language reasons; ask 'what documents am I missing?' by voice.
5. 1:50 Click Apply: watch the agent fill the form, trigger the injected error and see it recover.
6. 2:30 Consent by voice; receipt and status timeline.
7. 2:50 Show the audit log and 'delete my data'.

## Part B: OpenCode build prompt

Copy everything below into opencode (plan mode first).

---

You are a senior full-stack engineer. Build the complete, working project **Sahayak** end to end, following `PRD.md` in this folder as the source of truth. Read it fully before writing code. Produce a runnable app, not stubs: every feature in the PRD (FR-1 to FR-22) must work in the UI and API.

**Working rules**

- Work in phases below. After each phase: run the tests or start the app, fix errors, and give me a short summary before continuing. Do not skip ahead.
- Prefer simple, well-known libraries. No placeholder TODOs in delivered code. Every file must be complete.
- Everything must run locally with no paid keys: `LLM_PROVIDER=mock` must give a full working demo using canned but realistic responses and the bundled sample documents. Real providers (`anthropic`, `openai`) are optional via env vars.
- Never put secrets in the frontend. Provide `.env.example`.
- Commit-ready quality: typed code, docstrings on public functions, clear error handling, logging.

**Target structure**

- `backend/` FastAPI app (`app/main.py`, `routers/`, `services/`, `models/`, `agent/`, `llm/`, `mock_portal/`, `data/schemes/*.json`, `tests/`)
- `frontend/` Vite + React + TypeScript + Tailwind + @react-three/fiber + @react-three/drei + framer-motion + i18next + Zustand
- `samples/` synthetic documents (generate with a Python script using Pillow: income certificate, marksheet, caste certificate, ration card; clearly fake names and watermark 'SAMPLE')
- `README.md`, `Makefile` or `run.sh`, `.env.example`, `docker-compose.yml` (optional)

**Phase 1: Backend foundation**

1. Set up FastAPI, SQLAlchemy + SQLite, Pydantic v2 models matching the PRD data model, CORS for the frontend, anonymous session via signed cookie.
2. Implement the LLM provider interface (`extract_profile`, `extract_document`, `explain`, `chat`, `interpret_error`) with `MockProvider`, `AnthropicProvider`, `OpenAIProvider`.
3. Create the scheme JSON files from section 10 in en/hi/mr, with required documents, rights, grievance contacts and a source\_url field. The original five samples have since expanded to the 14-scheme catalogue.
4. Implement the deterministic rules engine (`services/eligibility.py`) with operators eq, in, lt, lte, gt, gte, between, exists; returns passed and failed rules with reason text keys, status, ranking by benefit then deadline. Write at least 25 pytest cases including edge cases (boundary income, missing fields producing 'likely').
5. Implement profile, schemes, match and delete-my-data endpoints.

**Phase 2: Documents and chat**

1. Upload endpoint with type detection, local storage, 24-hour expiry cleanup task.
2. Extraction via vision LLM with per-field confidence; mock mode returns pre-baked values for the sample documents (match by filename or image hash).
3. Correction endpoint.
4. Grounded chat endpoint with a small keyword/embedding-free retriever over scheme JSON; answers must cite scheme ids; refuse to answer outside the corpus. Stream tokens via SSE.
5. Translation of reason strings through locale files, and LLM translation fallback for free text.

**Phase 3: Mock government portal** Build `/mock-portal` as server-rendered pages that look like a real state scholarship portal: login with demo credentials, 4-step form (personal, education, income and category, documents upload), validation with realistic error messages (for example income format, percentage over 100, missing file), review page, final submit, receipt page with application number. Add a query/header toggle `?chaos=1` that injects a random timeout and one validation error to test agent resilience. Use stable `data-testid` attributes on all fields.

**Phase 4: Application agent**

1. Playwright (Python async, Chromium headless) agent in `agent/` with a planner that maps profile and documents to portal fields, executes steps, takes a screenshot after each step, and emits events.
2. Error handling: on validation error, read the error text, call `interpret_error`, correct the field or emit a 'needs user input' event; retry with exponential backoff on timeouts (max 3).
3. Consent gate: the agent stops at the review page and waits (asyncio event) until `POST /consent` records a valid consent token; refuse to click Final Submit without it. Write a test proving this.
4. SSE endpoint streaming JSON events (step, message, screenshot as base64 or URL, status).
5. On success: store portal application id, save a receipt screenshot, generate a receipt PDF (reportlab), start the simulated status worker (Submitted to Under Review to Verified to Approved on timers of a few seconds for demo).
6. Write every action to the audit log with masking for sensitive values; expose the audit endpoint.

**Phase 5: Frontend app shell and 3D UI** Implement the 'Scheme Garden' design from PRD section 13.

1. Routes: Landing, Profile and Voice, Documents, Results, Scheme Detail with chat, Apply (agent run), Receipt and Tracking, Audit, Admin schemes, Privacy.
2. Voice orb component (react-three-fiber): shader or MeshDistortMaterial sphere reacting to real microphone amplitude via Web Audio API analyser; four states (idle, listening, thinking, speaking). Use Web Speech API for STT and speechSynthesis for TTS with language codes en-IN, hi-IN, mr-IN; graceful fallback to typed input if unsupported.
3. Floating 3D scheme tiles on the landing page, slow orbit, parallax on pointer move.
4. Document scan animation: 3D card flip, scanning beam, extracted fields fly into the profile panel as chips; editable fields with confidence highlighting.
5. Results stage: 3D cards or pillars scaled by benefit, colored by status, hover tilt, click camera zoom to detail; beside it, an accessible 2D list with identical content.
6. Apply screen: floating 3D browser frame showing live screenshots from SSE, glowing node path for the steps, an activity log, and a consent panel with hold-to-confirm and voice confirmation ('yes', 'submit', 'haan', 'ho').
7. Success screen with confetti, receipt PDF download, status timeline updating live.
8. i18n for en, hi, mr covering all UI strings; language switcher persisted.
9. Accessibility and performance: DOM equivalents for all 3D content, `prefers-reduced-motion` and WebGL-unavailable fallback to flat 2D, lazy-loaded 3D chunks, mobile simplified scene, 360px responsive layout, keyboard navigation, high-contrast and large-text toggles.
10. Use the design tokens in the PRD; polished, consistent, no default-looking UI.

**Phase 6: Integration, polish, docs**

1. Wire all screens to the API with loading, error and empty states; toasts for failures.
2. Add a one-click 'Run demo' button on the landing page that fills a sample profile, loads sample documents and walks through the flow.
3. Playwright end-to-end test of the full journey in mock mode including `?chaos=1`.
4. README: setup in under 5 commands, env variables, architecture diagram (mermaid), how to switch LLM providers, how to add a scheme, demo script from the PRD, known limitations, and the responsible-AI notes.
5. Add the 'demo uses mock portal and sample data, verify on official source' banner in the UI footer and on the apply screen.

**Acceptance criteria (verify and report each)**

- `./run.sh` starts backend and frontend; the app loads without keys using the mock provider.
- A user can speak or type a profile, upload sample documents, see ranked eligibility with reasons in all three languages, chat about a scheme, run the agent against the mock portal (including chaos mode), give consent by tap and by voice, receive a receipt PDF and watch status updates.
- Final Submit is impossible without consent (test passes).
- All backend tests pass; the end-to-end test passes.
- Delete-my-data removes profile, documents and applications.
- The 3D UI runs smoothly and falls back to 2D correctly.

Start now with Phase 1. Before coding, print a short plan listing the files you will create in this phase.

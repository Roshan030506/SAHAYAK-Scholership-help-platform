# Sahayak

Sahayak is a voice-first scholarship copilot for India. It helps a student
describe their situation in English, Hindi or Marathi, see which schemes they
qualify for and exactly why, understand the documents to collect, and — in later
phases — apply with explicit consent and a full audit trail.

This repository currently contains the profile flow, deterministic eligibility
matching, weighted recommendation scores, enriched scheme metadata, trilingual
scheme data, a 14-scheme central/state/tribal/AICTE/CSR catalogue, an official
portal directory, mock/Anthropic/OpenAI providers and a complete React UI for
those features.

## Quick start

No paid API key is required. The default `LLM_PROVIDER=mock` mode uses bundled
schemes and deterministic extraction.

```powershell
# Terminal 1 — backend
cd backend
.\.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000

# Terminal 2 — frontend
cd frontend
npm.cmd install
npm.cmd run dev
```

Then open <http://127.0.0.1:5173>. API docs live at
<http://127.0.0.1:8000/docs> and health at
<http://127.0.0.1:8000/api/health>.

> On Windows PowerShell, `npm.ps1` may be blocked by execution policy. Use
> `npm.cmd` as shown. The backend virtual environment is already present in this
> workspace; if it is missing, create it with `python -m venv .venv` and install
> `backend/requirements.txt`.

## Demo flow

1. Press **Try sample profile** on the landing page. The UI fills a fictional
   student profile and navigates to ranked matches.
2. Open any scheme to see every rule marked met, not met, or needing
   information, plus missing documents, rights, grievance contacts and the
   official source.
3. Use the **Profile** page to speak/type a description or edit the 13 fields.
   Saving re-runs matching immediately.
4. Switch between English, Hindi and Marathi in the header. Scheme content,
   match explanations and results re-localize.
5. Use the floating **Ask Sahayak** orb for hands-free voice or typed answers
   about matches, documents, deadlines, rules and page navigation.
6. Browse the official portal directory on the landing page to open NSP,
   MahaDBT 2.0, MyScheme, Tribal Affairs, AICTE, Social Justice and CSR portals.
7. Visit **Privacy & data** to delete the anonymous session and every record
   associated with it.

## Scheme catalogue

The bundled catalogue contains 14 editable schemes:

- **NSP / central:** Post-Matric SC, PM-USP Central Sector (CSSS), NMMS,
  Post-Matric ST, AICTE Pragati, AICTE Saksham, Disability Education Scholarship.
- **Maharashtra:** Fee Reimbursement, Rajarshi Shahu Maharaj EBC, OBC Post-Matric.
- **CSR / foundations:** SBI Asha, HDFC Parivartan, Reliance Foundation UG,
  NorthSouth Foundation.

Rules use deterministic operators only, including a `contains_any` course match
for technical and professional programmes. The landing page also links to ten
official/CSR portals kept in `backend/app/data/portals.json`.

## Implemented APIs

| Method | Path | Purpose |
| --- | --- | --- |
| `POST` | `/api/session` | Create or refresh a signed-cookie anonymous session |
| `GET` | `/api/session` | Read the current session |
| `GET` | `/api/profile` | Read the saved profile and completeness |
| `PUT` | `/api/profile` | Save profile fields and UI language |
| `POST` | `/api/profile/from-text` | Extract structured fields from typed/spoken text |
| `GET` | `/api/schemes` | List localized scheme summaries |
| `GET` | `/api/schemes/{id}` | Read one scheme with rules and documents |
| `GET` | `/api/portals` | List official central, state and CSR portals |
| `POST` | `/api/match` | Evaluate all schemes against the saved profile |
| `POST` | `/api/documents/check?scheme_id=` | Check stored document readiness and consistency |
| `DELETE` | `/api/me` | Delete the current anonymous session and its data |
| `GET` | `/api/health` | Health and provider status |

Each match result includes a deterministic `match_score` (0-100), status, and
translated factors that raised or lowered the score. Scheme JSON rules support
`weight` and `mandatory`; document entries support `validity_days` and
`required_fields`, and deadlines include `deadline_timezone`.

## Voice assistant

The floating assistant works without a paid speech service. Browser Web Speech
API provides speech-to-text and text-to-speech in English, Hindi and Marathi;
every prompt also has a typed fallback. It answers deterministically from the
saved profile, match results and scheme JSON, can read any page aloud, navigates
on request, switches language, repeats the last reply, and closes on “goodbye”.
Hands-free mode re-arms the mic after each spoken reply, with barge-in supported.

## Layout

```
backend/
  app/            FastAPI app, models, routers, services, LLM providers
  app/data/schemes/   fourteen trilingual scheme definitions
  app/data/portals.json  official central, state and CSR portal directory
  tests/          101 backend tests
frontend/
  src/pages/      Landing, Profile, Results, Scheme detail, Privacy, 404
  src/components/ UI primitives, profile/voice flow, 3D scenes and 2D fallbacks
  src/i18n/       en / hi / mr translations
  public/         favicon and robots.txt
```

## Configuration

Copy the root `.env.example` to `.env` to change providers, database or session
settings. Copy `frontend/.env.example` to `frontend/.env.local` only if the API
is not reachable through the default `/api` dev proxy.

## Verification

```powershell
# Backend
cd backend
.\.venv\Scripts\python.exe -m pytest -q

# Frontend type-check + production build
cd ..\frontend
npm.cmd run build
```

The frontend build is type-checked and the checked UI passes Lighthouse
accessibility and best-practices audits at 100 (on the audited pages).

## Roadmap

Later phases add document upload and OCR, grounded scheme chat, the mock portal
application agent with a consent gate, receipts, tracking and audit views, and
the admin dashboard. The current UI deliberately links only to APIs that exist
today.

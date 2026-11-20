# Sahayak frontend

React + TypeScript + Vite UI for the Sahayak scholarship copilot. It supports
English, Hindi and Marathi, a voice-first profile flow, a 14-scheme catalogue,
an official portal directory, a global voice assistant, a 3D scheme garden with
2D fallbacks, and the privacy controls exposed by the backend.

## Requirements

- Node.js 18+ (Node 20+ recommended)
- The backend running at `http://127.0.0.1:8000` in mock mode (no paid keys)

## Run locally

```powershell
# 1. Start the backend from the repository root
cd backend
.\.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000

# 2. In a second terminal, start the frontend
cd frontend
npm.cmd install
npm.cmd run dev
```

Open <http://127.0.0.1:5173>. Vite proxies `/api` to the backend, so session
cookies stay first-party.

> PowerShell blocks `npm.ps1` on some machines; use `npm.cmd`, as shown.

## Scripts

| Command | Purpose |
| --- | --- |
| `npm.cmd run dev` | Start the Vite dev server on port 5173 |
| `npm.cmd run build` | Type-check and produce an optimized build in `dist/` |
| `npm.cmd run preview` | Serve the production build on port 4173 |
| `npm.cmd run typecheck` | Run TypeScript only |

## Configuration

Copy `.env.example` to `.env.local` only if the API is not reachable through the
default `/api` proxy. `VITE_API_BASE_URL` must be empty or an absolute URL; the
backend `CORS_ORIGINS` must include the frontend origin when you use an absolute
URL.

## Accessibility and fallbacks

- 3D scenes lazy-load and fall back to interactive 2D artwork on small screens,
  when WebGL is unavailable, and when the renderer throws.
- The accessibility menu toggles high contrast, larger text and reduced motion;
  the OS `prefers-reduced-motion` setting is respected independently.
- The app is keyboard navigable with a skip link, visible focus rings, labelled
  controls and live regions for voice and toast updates.
- Voice input uses the browser Web Speech API where available; users can always
  type into the transcript instead.
- The floating **Ask Sahayak** assistant supports hands-free turns, barge-in,
  read-aloud, spoken navigation, repeat and close commands in all three languages.

## Demo flow

1. On the landing page, press **Try the demo profile**.
2. Review the matched garden on **Results** and open a scheme for rule-level
   reasoning.
3. Switch languages in the header; results re-localize.
4. Open **Ask Sahayak** and try “What am I eligible for?”, “Which documents are
   missing?”, “Repeat” or “Goodbye”.
5. Browse the official portal directory below the scheme garden.
6. Visit **Privacy** to delete the anonymous session and all stored data.

The guided application, document upload and chat features arrive in later
backend phases; the UI intentionally only links to APIs that already exist.

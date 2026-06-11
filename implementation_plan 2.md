# Implementation Plan - AI Music Recommendation Platform (Phase 1)

This plan covers the implementation of a minimal working full-stack application displaying a list of songs retrieved from a FastAPI backend to a React + Vite + TailwindCSS frontend.

---

## User Review Required

> [!NOTE]
> **Scope Reductions:**
> - No PostgreSQL (using in-memory list in FastAPI).
> - No Authentication (open endpoints, no login/register).
> - No Docker (ran directly using Python and Node.js).
> - No Recommendation Engine (simple static song list).

---

## Proposed Changes

We will organize the code into `backend` and `frontend` directories.

### Component 1: Backend (FastAPI)

#### [NEW] [main.py](file:///c:/Users/Aashrith/OneDrive/Aashrith/Webs/music-recommendation-system/backend/main.py)
A single-file FastAPI server featuring:
- A `Song` model using Pydantic.
- An in-memory list of 15 popular songs (covering Bollywood/Pop/Romantic/Lo-Fi).
- CORS Middleware enabled to allow requests from the React frontend port (5173).
- Endpoint: `GET /songs` returning the list of songs.

#### [NEW] [requirements.txt](file:///c:/Users/Aashrith/OneDrive/Aashrith/Webs/music-recommendation-system/backend/requirements.txt)
Python dependencies: `fastapi`, `uvicorn`, `pydantic`.

---

### Component 2: Frontend (React + Vite + TailwindCSS)

#### [NEW] [package.json](file:///c:/Users/Aashrith/OneDrive/Aashrith/Webs/music-recommendation-system/frontend/package.json)
NPM package configuration defining React, Vite, TailwindCSS, PostCSS, and Autoprefixer dependencies.

#### [NEW] [vite.config.js](file:///c:/Users/Aashrith/OneDrive/Aashrith/Webs/music-recommendation-system/frontend/vite.config.js)
Vite setup with server port 5173.

#### [NEW] [tailwind.config.js](file:///c:/Users/Aashrith/OneDrive/Aashrith/Webs/music-recommendation-system/frontend/tailwind.config.js)
Tailwind styling settings configuring content paths and standard color palette.

#### [NEW] [postcss.config.js](file:///c:/Users/Aashrith/OneDrive/Aashrith/Webs/music-recommendation-system/frontend/postcss.config.js)
PostCSS configurations for Tailwind compiling.

#### [NEW] [index.html](file:///c:/Users/Aashrith/OneDrive/Aashrith/Webs/music-recommendation-system/frontend/index.html)
Root HTML shell mounting the React entry file.

#### [NEW] [src/index.css](file:///c:/Users/Aashrith/OneDrive/Aashrith/Webs/music-recommendation-system/frontend/src/index.css)
Inject Tailwind directives and custom gradients/aesthetics.

#### [NEW] [src/main.jsx](file:///c:/Users/Aashrith/OneDrive/Aashrith/Webs/music-recommendation-system/frontend/src/main.jsx)
React entry point.

#### [NEW] [src/App.jsx](file:///c:/Users/Aashrith/OneDrive/Aashrith/Webs/music-recommendation-system/frontend/src/App.jsx)
React Main Component featuring:
- State management (`songs`, `loading`, `error`, `searchQuery`, `selectedGenre`).
- `useEffect` hook to fetch songs from `http://localhost:8000/songs`.
- Filtering capability by search input or genre selection chips.
- Grid list of songs using cards with high-fidelity glassmorphism themes (dark mode, glowing gradients, smooth hovers).

---

## Verification Plan

### Automated/Local Execution Tests
- **Backend Setup:**
  1. Navigate to `/backend`
  2. Install dependencies: `pip install -r requirements.txt`
  3. Start server: `uvicorn main:app --reload`
  4. Verify endpoint: `curl http://localhost:8000/songs`
- **Frontend Setup:**
  1. Navigate to `/frontend`
  2. Install dependencies: `npm install`
  3. Start server: `npm run dev`
  4. Verify rendering: Open `http://localhost:5173` in browser.

### Manual Verification
- Verify responsive grid layout of the cards (mobile, tablet, desktop).
- Verify filters correctly refine the visible list of 15 songs.

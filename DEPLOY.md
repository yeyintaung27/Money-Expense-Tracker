# Deploying — Vercel (frontend) + Render (backend)

Your app is a React frontend + an Express API. In production they live on two
hosts, so the frontend is told where the API is with `VITE_API_BASE`, and the
API is told which frontend may call it with `ALLOWED_ORIGINS`.

```
browser ──> https://your-app.vercel.app   (React, static files)
                 │  fetch("https://your-api.onrender.com/api/...")
                 ▼
           https://your-api.onrender.com (Express + Google Sheets)
```

> `.env` and `credentials.json` are git-ignored, so they are **never** pushed to
> GitHub. In production their values live in the hosts' dashboards instead.

---

## Step 1 — Push to GitHub

```bash
git init
git add .
git commit -m "Money Expense Tracker"
git remote add origin https://github.com/<you>/money-expense-tracker.git
git push -u origin main
```

Double-check `credentials.json` and `.env` are **not** in the push (`.gitignore`
already covers them).

## Step 2 — Backend on Render

1. https://dashboard.render.com → **New → Web Service** → connect your repo
2. Settings:
   - **Runtime:** Node
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Instance Type:** Free
3. **Environment → Add Environment Variable** for each of:

   | Key | Value |
   |---|---|
   | `SHEET_ID` | the value of `SHEET_ID` from your local `.env` |
   | `GOOGLE_CREDENTIALS` | the **entire contents** of `credentials.json` (select all, copy, paste) |
   | `AUTH_SECRET` | the same value as in your local `.env` |
   | `GOOGLE_CLIENT_ID` | `935893903274-2fcm22mrl97d374ndc46blejlogqph91.apps.googleusercontent.com` |
   | `ALLOWED_ORIGINS` | `https://your-app.vercel.app` **and** `http://localhost:5173` (comma-separated — set this after Step 3) |

   Do **not** set `PORT` — Render provides it and `server.js` reads it.
4. **Settings → Health Check Path:** `/health`
5. Deploy. Note the URL, e.g. `https://money-expense-tracker-xxxx.onrender.com`
   — verify `https://<that-url>/health` returns `{"ok":true}`.

> ⚠️ The Render free instance **sleeps** after ~15 min idle, so the first request
> after a quiet period takes 30–50 seconds. That's normal.

## Step 3 — Frontend on Vercel

1. https://vercel.com/new → import the same repo (Vite is auto-detected:
   build `npm run build`, output `dist`)
2. **Settings → Environment Variables** (set them for **Production**, then redeploy):

   | Key | Value |
   |---|---|
   | `VITE_GOOGLE_CLIENT_ID` | your Google OAuth Client ID |
   | `VITE_API_BASE` | `https://your-api.onrender.com` (no trailing slash) |

   Vite reads these **at build time** — after changing one you must redeploy.
3. Deploy → note the URL, e.g. `https://money-expense-tracker.vercel.app`
4. Go back to Render and set `ALLOWED_ORIGINS` to include that exact URL, then
   restart the Render service.

## Step 4 — Google Cloud Console (required for sign-in to work)

1. **APIs & Services → OAuth consent screen → Audience → Publish app**
   — until you publish, *only* the emails listed under "Test users" can sign in.
2. **APIs & Services → Credentials → your Web client → Authorized JavaScript
   origins → + Add URI:** `https://your-app.vercel.app`
   (keep `http://localhost:5173` for local work)
3. No redirect URI is needed — the button uses Google's popup flow.

---

## Go-live checklist

- [ ] Repo pushed **without** `credentials.json` / `.env`
- [ ] Render: 5 env vars set, health check `/health` returns `{"ok":true}`
- [ ] Vercel: `VITE_GOOGLE_CLIENT_ID` + `VITE_API_BASE` set **before** the build
- [ ] `VITE_API_BASE` has **no** trailing slash
- [ ] `ALLOWED_ORIGINS` on Render contains the exact Vercel URL (no trailing slash)
- [ ] OAuth consent screen **published**
- [ ] Vercel domain added to **Authorized JavaScript origins**
- [ ] **Sign in yourself first** — the first Google account to sign in claims
      every row that has no Owner yet, so do this before sharing the link
- [ ] Tested: browse as a guest → add → Google popup → row appears

## Local development (unchanged)

```bash
npm install
npm run server     # API on :3001
npm run dev        # Vite on :5173 (proxies /api to :3001)
```

## Limits worth knowing

- **Google Sheets is a spreadsheet, not a database.** ~300 API reads/minute per
  project and one shared sheet — great for you + friends, not for hundreds of
  simultaneous users.
- Every user's rows are filtered by the `Owner` column, so users never see each
  other's data.
- Data lives in **your** Google account; deleting the sheet deletes everyone's data.

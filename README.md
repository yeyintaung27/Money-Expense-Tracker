# Money Expense Tracker

A full-stack expense tracker: React (Vite) front end, Express API, and **Google
Sheets as the database** — with Google Sign-In and per-user data isolation.

You can **browse the dashboard and transactions without logging in** (everything
is empty). The moment you try to add something, a Google sign-in popup appears
and your pending action completes automatically after you sign in.

## Features

- **📊 Dashboard** — summary boxes (total spent, transaction count, average/day,
  top category) plus three charts: daily spending, monthly comparison, yearly comparison
- **🧾 Transactions** — filterable list with delete, an add form, and month navigation
- **💬 Chat Add** — type `food 12.50 lunch` or paste a whole month's list
  (`September cost 2026` + one item per line); it parses, previews, and waits for
  `YES` / `NO` before saving anything
- **🔐 Google Sign-In** — no passwords; each account only ever sees its own rows
  (an `Owner` column on every sheet row)
- **🌐 Public browsing** — pages render for guests; writes require signing in
- **📱 Responsive** — sidebar collapses into a top bar on small screens

## Tech stack

| Layer | |
|---|---|
| Frontend | React 19 + Vite, Recharts, `@react-oauth/google` |
| Backend | Express 5, `googleapis`, `google-auth-library` |
| Database | Google Sheets (service account) |
| Auth | Google OAuth 2.0 ID tokens → 30-day HMAC session tokens |

## Getting started

**Prerequisites:** Node 18+, a Google account, a Google Cloud project.

1. **Install dependencies**

   ```bash
   npm install
   ```

2. **Configure your environment**

   ```bash
   cp .env.example .env
   ```

   Then fill in `.env`:

   - `SHEET_ID` — the ID of a Google Sheet you share with your service account
   - `AUTH_SECRET` — any long random string (e.g. `openssl rand -hex 32`)
   - `GOOGLE_CLIENT_ID` / `VITE_GOOGLE_CLIENT_ID` — your OAuth Web client ID
   - `GOOGLE_CREDENTIALS` — leave empty locally

3. **Service account** — in Google Cloud, create a service account, download its
   JSON key as `credentials.json` in the project root (git-ignored), and share the
   spreadsheet with the service account's email as an editor.

4. **Run it**

   ```bash
   npm run server    # Express API on http://localhost:3001
   npm run dev       # Vite on http://localhost:5173 (proxies /api)
   ```

The API creates the `Users` tab and the `Owner` column automatically on first
start. The first Google account to sign in claims any rows that have no owner.

## Project structure

```
server.js               Express API + Google Sheets + auth
src/
  App.jsx               layout, page switching, login popup
  api.js                fetch wrapper, token storage, API base URL
  components/           Sidebar, Dashboard pieces, ChatBox, forms, charts
  parseMessage.js       single-line expense parser
  parseBatch.js         bulk month-list parser
public/privacy.html     privacy policy (required for Google OAuth publishing)
DEPLOY.md               deploying to Vercel (front end) + Render (API)
```

## Deployment

See **[DEPLOY.md](./DEPLOY.md)** — Vercel for the React app, Render for the API,
plus the Google Cloud settings needed for sign-in to work on a live domain.

## Privacy

Your expenses are stored in a Google Sheet owned by the operator, tagged with
your email so nobody else can read them. See [public/privacy.html](./public/privacy.html).

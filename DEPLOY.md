# Deploying to Vercel

The app is production-ready. You need three things: a hosted database (Turso, free),
a Vercel project, and the environment variables. ~15 minutes, no coding.

> Why a hosted DB? Vercel runs on serverless functions with a temporary filesystem,
> so the local SQLite file can't live there. Turso is SQLite in the cloud — same
> database, just hosted. The schema creates itself automatically on first run.

---

## 1) Create the database (Turso — free)

1. Go to **https://turso.tech** and sign up (GitHub login works).
2. Create a database — name it e.g. `holafly-negotiator`, pick the nearest region.
3. On the database page, grab two values (keep them for step 3):
   - **URL** — looks like `libsql://holafly-negotiator-xxxx.turso.io`
   - **Token** — click *Create Token* / *Generate token* and copy the long string.

## 2) Put the code on Vercel

**Option A — GitHub (recommended):**
1. Create a new **private** GitHub repo.
2. Push this project to it (from the `holafly-negotiator` folder):
   ```bash
   git add -A && git commit -m "Deploy Holafly Negotiation Helper"
   git remote add origin https://github.com/<your-username>/holafly-negotiator.git
   git push -u origin main
   ```
3. Go to **https://vercel.com → Add New… → Project**, import that repo.
   Framework auto-detects as **Next.js** — leave build settings as default.

**Option B — Vercel CLI (no GitHub):**
```bash
npm i -g vercel
cd holafly-negotiator
vercel            # follow the prompts (it will open your browser to log in)
```

## 3) Set environment variables in Vercel

Project → **Settings → Environment Variables** → add these for **Production**
(and Preview if you want preview deploys to work):

| Name | Value |
|---|---|
| `ANTHROPIC_API_KEY` | your Claude key (`sk-ant-…`) |
| `DATABASE_URL` | the Turso `libsql://…` URL |
| `DATABASE_AUTH_TOKEN` | the Turso token |
| `APP_PASSWORD` | a password to share with your AE team |
| `ANTHROPIC_MODEL` | *(optional)* `claude-opus-4-8` for top quality |

Then **Deploy** (or Redeploy if the first deploy ran before the vars were set).

## 4) Open it

Visit the Vercel URL. The browser asks for a password — leave the username blank
(or type anything) and enter your **`APP_PASSWORD`**. Share the URL + password with
the team. To change the password later, update `APP_PASSWORD` in Vercel and redeploy.

---

## Notes
- **Uploaded PDFs aren't stored** — we read the metrics on upload, so there's nothing
  to persist. (The original files aren't kept.)
- **Costs:** Vercel Hobby + Turso free tiers cover a small team; the Claude API is
  pay-per-use on your key.
- **Local dev still works unchanged:** with no `DATABASE_URL`/`APP_PASSWORD` set, it
  uses the local SQLite file and no password — just `npm run dev`.

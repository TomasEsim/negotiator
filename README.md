# Holafly Negotiation Helper

An internal web app that helps Holafly's account executives negotiate influencer & affiliate
deals. Upload a creator's HypeAuditor report(s), and the app reads the data, scores the audience
against Holafly's rules, and uses Claude to recommend a deal and draft the reply you send — with
the reasoning shown so you stay in control.

---

## What it does

- **Reads HypeAuditor PDFs automatically.** Drop in the Instagram / TikTok / YouTube export(s).
  The app uses Claude's vision to extract every metric (engagement, AQS, audience quality,
  geography, interests, age, etc.) — no manual data entry, no guessing.
- **Scores the creator against your rules.** A transparent, auditable layer computes the
  follower tier, *effective reach* (real, in-target audience — not raw followers), an
  audience-fit score, a fair-price range, rule pass/fail checks, and red/green flags.
- **Recommends the deal and drafts the message.** Claude proposes a deal structure
  (free eSIM + affiliate code + content bundle, flat fee, etc.), a ready-to-send reply, the
  rationale, watch-outs, a concession plan, and a walk-away point.
- **Keeps the full history.** Every negotiation, report, and message is saved. Come back days
  later, paste the creator's follow-up, and continue where you left off.
- **Editable rules.** Every guardrail (CPM caps, content minimums, commission ranges, target
  markets, deal templates…) is editable on the **Rules & Settings** page — no code needed.

---

## Setup (one time)

You need [Node.js](https://nodejs.org) 20+ (already installed) and an Anthropic API key.

1. **Add your Anthropic API key.** Open the file `.env.local` in this folder and paste your key
   after `ANTHROPIC_API_KEY=`. Get a key at <https://console.anthropic.com/>.

   ```
   ANTHROPIC_API_KEY=sk-ant-your-key-here
   ```

   The app works without a key for everything except reading PDFs and generating
   recommendations (those need Claude).

2. **(Optional) Choose the model.** Also in `.env.local`:
   - `ANTHROPIC_MODEL` — the assistant. Default `claude-sonnet-4-6`. For maximum quality set
     `claude-opus-4-8`.
   - `ANTHROPIC_EXTRACTION_MODEL` — reads the PDFs. Default `claude-sonnet-4-6`.

## Running it

```bash
npm run dev
```

Then open <http://localhost:3000> in your browser. To stop it, press `Ctrl+C` in the terminal.

(If you ever move this to a server for the whole team, run `npm run build` then `npm start`.)

---

## How to use it

1. **New negotiation** → enter the creator's name/handle and any campaign context.
2. **Upload HypeAuditor report(s)** in the left panel. You can add Instagram, TikTok, and
   YouTube exports for the same creator. Each is read and scored automatically.
3. **Ask the assistant** → click *Suggest opening offer*, or paste the creator's message in the
   composer (select "Creator said"), then hit **Generate**. You get a recommended deal + a draft
   reply you can copy or log.
4. **Log the back-and-forth.** Add what the creator says and what you send. The assistant always
   reads the whole thread, so its advice stays in context across follow-ups.
5. **Tune the rules** any time on **Rules & Settings**.

---

## Good to know

- **Your data stays local.** Everything is stored in `data/app.db` (a SQLite file) and uploaded
  PDFs in `data/uploads/`, both inside this folder. Nothing is sent anywhere except the report
  data + your messages to the Anthropic API to generate recommendations.
- **The numbers are estimates.** HypeAuditor reach/EMV figures are modelled, and pricing
  benchmarks vary. For high-value deals, verify the creator's real reach (ask for screenshots)
  and treat the fair-price range as a guide, not a quote.
- **You're always in control.** The assistant proposes; you review, edit, and send.

---

## Tech (for whoever maintains it)

- **Next.js 16** (App Router) + **React 19** + **TypeScript** + **Tailwind CSS v4**
- **better-sqlite3** for local storage (`src/lib/db.ts`)
- **@anthropic-ai/sdk** — PDF extraction (vision + forced-tool structured output) and the
  assistant (structured output), with prompt caching (`src/lib/anthropic.ts`)
- **Deterministic scoring** in `src/lib/scoring.ts`; **editable rules** seeded from research in
  `src/lib/rules.ts`
- No accounts/auth (single-user local pilot). The data model is ready to move to Postgres +
  auth for a hosted team version later.

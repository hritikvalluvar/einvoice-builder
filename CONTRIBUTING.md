# Contributing

Small project, two maintainers. Keep it simple.

## Setup

```bash
git clone https://github.com/hritikvalluvar/einvoice-builder
cd einvoice-builder
npm install
cp .env.example .env.local
# Fill in Supabase + Swipe values — ask a maintainer if you don't have them
npm run dev
```

Open http://localhost:5173 and sign in with an account you've registered on the Supabase instance.

## Workflow

- `main` is protected. No direct pushes. Vercel auto-deploys `main` to production.
- Work on a branch. Open a PR. One approval + CI passing = merge.
- Keep PRs small and focused. One feature or one bug fix per PR.
- If you touch the schema, include the additive migration SQL in the PR body (not the destructive reset).
- If you add a new edge function, include deployment instructions (which secrets to set on Supabase).

## Commit style

- First line: what changed (not "fix" or "update") — e.g. `Add PIN auto-fill in bill-to section`
- Body (optional): why, if the "why" isn't obvious from the title
- Keep the subject under ~70 chars
- No emojis. No Co-Authored-By trailers

## Code style

- TypeScript strict mode. `npm run build` must pass — it runs `tsc --noEmit` + Vite build.
- No unnecessary comments. Code should be self-explanatory. Comments only for non-obvious *why* (invariants, workarounds, surprising behavior).
- Prefer editing existing files over creating new ones. Prefer existing patterns in the codebase over new abstractions.
- Mobile-first. Test anything UI-related at 375px width minimum.

## What not to do

- Don't commit `.env.local` or any file with real secrets
- Don't skip hooks (`--no-verify`)
- Don't force push to shared branches
- Don't add backwards-compatibility shims for code that's only been live for days
- Don't introduce new dependencies without discussing first

## Secrets

Three environment layers:

| Where | Used for | Set by |
|---|---|---|
| `.env.local` (gitignored) | Local dev — all env vars | You, from `.env.example` |
| Vercel project env vars | Production frontend (`VITE_*` only) | Maintainer |
| Supabase Edge Function secrets | Server-side API keys (`SWIPE_*`, etc) | Maintainer |

**Never put server-side secrets in `VITE_*` vars — Vite inlines them into the browser bundle.**

## Questions

Ping the other maintainer. This is a two-person project; we don't need issue templates.

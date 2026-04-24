# Contributing

Small project, two maintainers. Keep it simple.

## Setup

```bash
git clone https://github.com/hritikvalluvar/einvoice-builder
cd einvoice-builder
npm install
cp .env.example .env.local
# Fill in Supabase + GSTIN provider values — ask a maintainer if you don't have them
npm run dev
```

Open `http://localhost:5173` and sign in with a Supabase-registered account.

## Branch model

- `main` — production. Auto-deploys to [einvoice-builder.vercel.app](https://einvoice-builder.vercel.app). Protected.
- `dev` — staging. Auto-deploys to [einvoice-builder-git-dev-hritik-valluvars-projects.vercel.app](https://einvoice-builder-git-dev-hritik-valluvars-projects.vercel.app). Protected. **Default PR target.**
- `feat/*`, `fix/*`, `chore/*`, `docs/*`, `ci/*`, `refactor/*` — feature/work branches. Created off `dev`.

## Workflow

1. Branch off `dev`. Never `main`.
2. Commit your work. Push.
3. Open a PR targeting `dev`. CI runs five required checks (build, lint, deadcode, gitleaks, Vercel preview).
4. Request review from a maintainer. One approval + all checks green = merge.
5. On merge, `dev` auto-deploys to the staging URL. Test there.
6. Periodically, a maintainer opens a release PR from `dev` → `main` to promote the batch to production.

Neither `dev` nor `main` accepts direct pushes or force pushes.

## Branch naming

Prefix + short kebab-case topic. Descriptive, under ~40 characters.

| Prefix | Use for | Example |
|---|---|---|
| `feat/` | New feature or user-visible change | `feat/ship-to-fetch` |
| `fix/` | Bug fix | `fix/gstin-validation-trailing-space` |
| `refactor/` | Internal change, no behavior shift | `refactor/split-invoice-editor` |
| `chore/` | Tooling, deps, cleanup | `chore/bump-typescript-6` |
| `docs/` | Documentation only | `docs/branch-workflow` |
| `ci/` | CI/CD config | `ci/add-gitleaks` |

**Avoid:** `main`, `update`, `patch-1`, your name as a branch, or anything GitHub auto-generates.

## PR titles

Same convention as commit messages. Imperative, descriptive, under ~70 characters.

- **Good:** `Add GSTIN Fetch to Ship-to section`
- **Good:** `Fix PIN auto-fill clearing state code on backspace`
- **Bad:** `Main`, `Update`, `Fix`, `WIP`

## PR descriptions

Use the auto-filled template. Fill in every section; don't leave the `<!-- placeholder -->` comments.

- **What this changes** — 1–3 bullets.
- **Testing** — how you verified it works locally.
- **Checklist** — tick the boxes that apply.

## Commit style

- First line: what changed (imperative, no period) — e.g. `Add PIN auto-fill in bill-to section`.
- Body (optional): the why, if it's not obvious from the title.
- Subject under ~70 chars.
- No emojis. No `Co-Authored-By` trailers.

## Code style

- TypeScript strict mode. `npm run build` must pass — runs `tsc --noEmit` + Vite build.
- No unnecessary comments. Comments only for non-obvious *why* (invariants, workarounds, surprising behaviour).
- Prefer editing existing files over creating new ones. Prefer existing patterns over new abstractions.
- Mobile-first. Test UI changes at 375px width minimum.

## What not to do

- Don't commit `.env.local` or any file with real secrets.
- Don't skip hooks (`--no-verify`).
- Don't force push to shared branches.
- Don't add backwards-compatibility shims for code that's only been live for days.
- Don't introduce new dependencies without discussing first.
- Don't target `main` from feature branches — target `dev`.

## Secrets

Three environment layers:

| Where | Used for | Set by |
|---|---|---|
| `.env.local` (gitignored) | Local dev — all env vars | Each contributor, from `.env.example` |
| Vercel project env vars | Production frontend (`VITE_*` only) | Maintainer |
| Supabase Edge Function secrets | Server-side API keys (`SWIPE_*`, `GSTIN_PROVIDER`, etc.) | Maintainer |

**Never put server-side secrets in `VITE_*` vars** — Vite inlines them into the browser bundle.

## Supabase setup

For first-time setup beyond `.env.local`:

1. Create a Supabase project at [supabase.com](https://supabase.com).
2. Run `supabase/schema.sql` in the SQL Editor.
3. Deploy the edge function: `supabase functions deploy lookup-gstin` (or paste via the dashboard).
4. Set function secrets: `GSTIN_PROVIDER`, `SWIPE_AUTH_TOKEN`, `SWIPE_API_BASE` (dashboard → Edge Functions → Secrets).

## Questions

Ping a maintainer. Two-person project, no issue templates needed.

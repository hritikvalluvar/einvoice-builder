# einvoice-builder

[![CI](https://github.com/hritikvalluvar/einvoice-builder/actions/workflows/ci.yml/badge.svg)](https://github.com/hritikvalluvar/einvoice-builder/actions/workflows/ci.yml)

A mobile-first GST e-invoice builder for Indian SMEs. Produces NIC schema v1.1-compliant invoice JSON ready for upload to the government e-invoice portal, and fetches buyer details from the GST registry on demand.

**Live:** [einvoice-builder.vercel.app](https://einvoice-builder.vercel.app)

## Features

- **Multi-tenancy.** Supabase email/password auth; companies and memberships with row-level security enforced at the database. Company switcher with GSTIN-first onboarding — looks up registry details before creating a company record.
- **GSTIN Fetch.** One-tap auto-fill of legal name, address, location, PIN, and state from the GST registry. Available on bill-to, ship-to, seller profile, and the client catalog. Provider-agnostic via `GSTIN_PROVIDER` env — ships with Swipe (default, free) and Sandbox.co.in (paid). 30-day row cache; 7-day status freshness enforced at export to block invoicing against cancelled GSTINs.
- **NIC invoice schema.** Bill-to, optional ship-to, optional e-way bill, multi-item lines, rounding adjustment. PascalCase wire format via `src/einvoice.ts`.
- **Pre-save review overlay.** Summary of buyer details, line items, and totals — with floor/ceil round-off options — before the invoice is finalised or exported.
- **Live validation banner.** Displays exactly which required fields are missing or invalid above the save and export buttons; shows a green confirmation when all fields are complete.
- **Snapshot tracking.** When auto-filled bill-to or ship-to fields are manually edited, a confirmation dialog intercepts save and export so accidental overrides are caught before submission.
- **Catalogs.** Searchable CRUD for clients and products. Line-level HSN, GST rate, and description are editable per invoice without mutating the catalog entry. GSTIN Fetch available in the client form.
- **HSN Packs.** Import pre-built HSN code sets by vertical (pharma, construction, textiles, electronics, FMCG, heavy machinery) directly into the product catalog.
- **Auto invoice numbering.** Suggests the next invoice number based on the last-used series, preserving prefix and zero-padding.
- **PIN-based auto-fill.** A 6-digit PIN resolves to GST state code (prefix map) and city (India Post public API, in-memory cached).
- **Inline validation.** GSTIN (15-char format), PIN (6-digit), HSN (6/8-digit), phone, email, and 44 standard UQC codes.
- **Bulk export.** Multi-select order history produces a JSON array suitable for NIC Bulk Upload.

## Stack

- **Frontend:** React 18, TypeScript, Vite, Tailwind, Zustand
- **Backend:** Supabase (Postgres, Auth, RLS)
- **Edge Functions:** Deno on Supabase — handles GSTIN lookup server-side
- **Hosting:** Vercel (auto-deploy on push to `main`; preview deployments per pull request)
- **CI:** GitHub Actions — TypeScript check, ESLint, Knip, Gitleaks, Vercel preview

## Getting started

Prerequisites: Node.js 20 or newer, npm.

```bash
git clone https://github.com/hritikvalluvar/einvoice-builder
cd einvoice-builder
npm install
cp .env.example .env.local
# Fill .env.local with Supabase URL, anon key, and GSTIN provider credentials
npm run dev
```

The app serves at `http://localhost:5173`.

Supabase provisioning (schema, edge function deploy, secrets) is documented in [CONTRIBUTING.md](CONTRIBUTING.md).

## Development

| Command | Purpose |
|---|---|
| `npm run dev` | Vite dev server with hot reload |
| `npm run build` | TypeScript check + production build |
| `npm run lint` | ESLint with TypeScript and React Hooks rules |
| `npm run deadcode` | Knip — detects unused exports, files, and dependencies |
| `npm run preview` | Serve the production build locally |

All contributions flow through pull requests. Branch protection on `main` requires five status checks (build, lint, deadcode, gitleaks, Vercel preview) and one approving review. Branch workflow and commit conventions are documented in [CONTRIBUTING.md](CONTRIBUTING.md).

## Deployment

Vercel auto-deploys `main` to production. Preview deployments are created per pull request. Public environment variables (`VITE_*`) are configured in the Vercel project settings. Server-side credentials (GSTIN provider tokens) are stored as Supabase Edge Function secrets and never reach the browser bundle.

## License

MIT.

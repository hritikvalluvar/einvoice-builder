# Bill Builder

[![CI](https://github.com/hritikvalluvar/einvoice-builder/actions/workflows/ci.yml/badge.svg)](https://github.com/hritikvalluvar/einvoice-builder/actions/workflows/ci.yml)

A minimal, mobile-first **GST e-invoice builder** for Indian SMEs. Lets a shopkeeper (or their counter staff) create invoices on a phone, pick from saved clients and products, and export [NIC-schema-compliant JSON](https://einvoice1.gst.gov.in/) ready for upload to the government's e-invoice portal.

Built over a weekend after research into a real problem: small B2B businesses in the ₹5–500 Cr turnover band are forced to use NIC's GePP portal (clunky Excel-style web tool) because direct API access is only granted to ≥₹500 Cr taxpayers, and routing through a GSP costs per-invoice. This app gives them a better UX to produce the same upload-ready JSON.

**Live demo:** [einvoice-builder.vercel.app](https://einvoice-builder.vercel.app)

---

## What it does

- **Auth & multi-tenancy** — Supabase email/password auth. Users create or join a company with an invite code; data is shared within the company.
- **Create orders** — full NIC-schema invoice with bill-to, optional ship-to, optional e-way bill block, multi-item lines, rounding adjustment.
- **Clients & products catalogs** — searchable, CRUD, with per-invoice overrides (line-level HSN/GST/description editable without changing the catalog entry).
- **Export** — single invoice or multi-select bulk export. Produces NIC schema v1.1 JSON with PascalCase keys, suitable for [NIC Bulk Upload](https://einvoice1.gst.gov.in/Others/BulkGenerationTools).
- **Validation** — inline format checks for GSTIN (15-char format), PIN (6-digit), phone, email, UQC codes (44 standard unit codes).
- **Account page** — seller details, company invite code, member list with owner-only remove.

## Stack

- **Frontend:** React 18, TypeScript, Vite, Tailwind, Zustand
- **Backend:** Supabase (Postgres + Auth + RLS) — no custom server
- **Hosting:** Vercel

## Architecture highlights

- **Row-level security** — every table filtered by `company_id` via a `is_member()` helper tied to `auth.uid()`; enforced in Postgres, not application code.
- **Multi-tenancy via companies + memberships** — users aren't tied to data; memberships are the join table. One user can belong to multiple companies.
- **Invite-by-code** — `join_company(p_code)` RPC validates the code server-side and inserts the membership atomically.
- **Self-contained invoice items** — each line stores its own snapshot of HSN/GST/description, so editing a catalog product doesn't retroactively change old invoices.
- **Editable bill-to** — client picker auto-fills the form, but per-invoice edits are independent of the saved client record.
- **UQC dropdown** — 44 standard codes per GST rules, rendered as the 3-letter code in compact UI but label+description in full forms.

## NIC schema notes

The NIC e-invoice JSON uses PascalCase keys (`DocDtls`, `SellerDtls`, `ItemList`, etc.) while the app uses camelCase internally. The boundary is `src/einvoice.ts` — `toNicJson()` maps from internal shape to wire format. Field order matters for some validators, so the object is built incrementally to place `EwbDtls` between `ValDtls` and `RefDtls` per the spec example.

Required sections and field requirements are documented in the export flow; the UI surfaces inline errors for every format failure.

## Running locally

```bash
# Clone and install
git clone https://github.com/hritikvalluvar/einvoice-builder
cd einvoice-builder
npm install

# Create a Supabase project at supabase.com, then:
cp .env.example .env.local
# edit .env.local with your Supabase URL + anon key

# Run the schema
# In Supabase dashboard → SQL Editor → paste supabase/schema.sql → Run

# Disable email confirmation during dev
# Dashboard → Auth → Providers → Email → toggle "Confirm email" OFF

npm run dev
# open http://localhost:5173
```

First sign-up lands on the Onboarding screen — create a new company to start.

## Project structure

```
src/
├── App.tsx                  # session gate + tab router
├── supabase.ts              # client singleton
├── store.ts                 # zustand store + Supabase CRUD + mappers
├── einvoice.ts              # invoice computation + NIC JSON emitter
├── types.ts                 # domain types
├── validators.ts            # GSTIN/PIN/phone/email rules
├── uqc.ts                   # 44 standard UQC codes
└── components/
    ├── Login.tsx            # email/password auth
    ├── Onboarding.tsx       # create or join company
    ├── InvoiceEditor.tsx    # main form (bill-to, ship-to, items, ewb, summary)
    ├── OrderHistory.tsx     # saved invoices + multi-select export/delete
    ├── ClientList.tsx       # buyer catalog CRUD
    ├── ProductList.tsx      # product catalog CRUD
    └── Account.tsx          # company + members + seller settings + sign out

supabase/
└── schema.sql               # full schema: tables, RLS, helpers, RPCs (destructive reset included)
```

## Deployment

`vercel --prod` from the repo root. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` as environment variables in the Vercel dashboard — they're inlined at build time by Vite.

## What's intentionally not here

- **Direct NIC API submission** — requires a GSP partnership. App stops at JSON export; user uploads to NIC's Bulk Upload portal manually.
- **E-way bill validation** — VehNo is optional in the UI despite NIC requiring it for road mode; the backend would reject, surfacing that error is downstream.
- **GSTIN auto-fill** — there's no public government API for this. Would integrate a paid verification service (Cashfree / API Setu) via a Supabase Edge Function.
- **Real multi-device sync with subscriptions** — every write mirrors to Postgres, but cross-device live updates would need Supabase Realtime channels.

## License

MIT.


## Roadmap

- GSTIN Fetch (shipped) — auto-fill bill-to from the GST registry
- Invoice PDF — mobile-friendly tax invoice generation
- IRN generation — via Sandbox / IRIS / any GSP (pluggable)
- E-way bill integration

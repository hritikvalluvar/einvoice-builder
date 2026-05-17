-- Add per-invoice template choice. NULL = use the company default
-- (which lives in localStorage today; can be promoted to a column
-- on `companies` later if multi-device sync becomes important).
-- Idempotent: safe to re-run.

alter table invoices
  add column if not exists template_id text;

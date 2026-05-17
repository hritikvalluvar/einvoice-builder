-- Add NIC e-invoice fields to invoices table.
-- Run once in Supabase SQL Editor against the live database.
-- Idempotent: safe to re-run.

alter table invoices
  add column if not exists irn text,
  add column if not exists ack_no text,
  add column if not exists ack_dt text,
  add column if not exists signed_qr text,
  add column if not exists signed_invoice text,
  add column if not exists irn_cancelled_at timestamptz;

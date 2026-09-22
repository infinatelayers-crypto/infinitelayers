-- Toggle to show/hide WhatsApp in the storefront footer.
-- Run after 202609250001_track_reviews_support.sql. Safe to run repeatedly.
alter table public.store_settings
  add column if not exists show_whatsapp boolean not null default false;

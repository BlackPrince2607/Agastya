-- Extend `palms` bucket MIME whitelist (camera / Expo may emit WebP); optional GIF for parity with vision ingest.
-- Run after `20260518120000_agastya_sessions.sql`. Safe no-op rows=0 only if bucket `palms` was never created.

update storage.buckets
set
  allowed_mime_types = array[
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp',
    'image/gif'
  ]::text[],
  file_size_limit = 7340032
where id = 'palms';

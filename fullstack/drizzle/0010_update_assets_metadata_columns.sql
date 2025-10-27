ALTER TABLE "assets"
  ADD COLUMN IF NOT EXISTS "metadata_cid" text,
  ADD COLUMN IF NOT EXISTS "metadata_file_id" text,
  ADD COLUMN IF NOT EXISTS "nft_serial_number" integer,
  ADD COLUMN IF NOT EXISTS "apr" text;

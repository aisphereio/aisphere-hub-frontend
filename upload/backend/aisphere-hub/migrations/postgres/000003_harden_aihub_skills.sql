-- Step 5.1 hardening for canonical Skill CRUD.
-- This migration is idempotent and safe to run after the initial Step 5 table
-- creation. It backfills old fixture rows, keeps updated_at fresh, and ensures
-- existing environments have the same constraints as the GORM model.

ALTER TABLE IF EXISTS aihub_skills
  ALTER COLUMN display_name SET DEFAULT '',
  ALTER COLUMN description SET DEFAULT '',
  ALTER COLUMN version SET DEFAULT '',
  ALTER COLUMN status SET DEFAULT 'active',
  ALTER COLUMN visibility SET DEFAULT 'private',
  ALTER COLUMN owner_id SET DEFAULT '',
  ALTER COLUMN org_id SET DEFAULT '',
  ALTER COLUMN project_id SET DEFAULT '',
  ALTER COLUMN source_type SET DEFAULT '',
  ALTER COLUMN source_uri SET DEFAULT '',
  ALTER COLUMN manifest_json SET DEFAULT '{}'::jsonb,
  ALTER COLUMN tags SET DEFAULT '[]'::jsonb,
  ALTER COLUMN created_at SET DEFAULT now(),
  ALTER COLUMN updated_at SET DEFAULT now();

UPDATE aihub_skills
SET
  created_at = COALESCE(NULLIF(created_at, '0001-01-01 00:00:00+00'::timestamptz), updated_at, now()),
  updated_at = COALESCE(updated_at, NULLIF(created_at, '0001-01-01 00:00:00+00'::timestamptz), now())
WHERE created_at IS NULL
   OR updated_at IS NULL
   OR created_at = '0001-01-01 00:00:00+00'::timestamptz;

CREATE OR REPLACE FUNCTION aihub_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_aihub_skills_updated_at ON aihub_skills;
CREATE TRIGGER trg_aihub_skills_updated_at
BEFORE UPDATE ON aihub_skills
FOR EACH ROW EXECUTE FUNCTION aihub_set_updated_at();

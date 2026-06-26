CREATE TABLE IF NOT EXISTS aihub_skills (
  id BIGSERIAL PRIMARY KEY,
  name VARCHAR(128) NOT NULL UNIQUE,
  display_name VARCHAR(256) NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  version VARCHAR(64) NOT NULL DEFAULT '',
  status VARCHAR(32) NOT NULL DEFAULT 'active',
  visibility VARCHAR(32) NOT NULL DEFAULT 'private',
  owner_id VARCHAR(128) NOT NULL DEFAULT '',
  org_id VARCHAR(128) NOT NULL DEFAULT '',
  project_id VARCHAR(128) NOT NULL DEFAULT '',
  source_type VARCHAR(32) NOT NULL DEFAULT '',
  source_uri TEXT NOT NULL DEFAULT '',
  manifest_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  tags JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_aihub_skills_org_id ON aihub_skills(org_id);
CREATE INDEX IF NOT EXISTS idx_aihub_skills_status ON aihub_skills(status);
CREATE INDEX IF NOT EXISTS idx_aihub_skills_visibility ON aihub_skills(visibility);
CREATE INDEX IF NOT EXISTS idx_aihub_skills_deleted_at ON aihub_skills(deleted_at);

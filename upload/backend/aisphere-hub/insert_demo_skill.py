import psycopg
import json

DSN = "host=36.138.61.152 port=30432 user=postgres password=Postgres@123456 dbname=aisphere_hub sslmode=disable"

sql = """
INSERT INTO aihub_skills (
  name, display_name, description, version, status, visibility,
  owner_id, org_id, manifest_json, tags
) VALUES (
  %(name)s, %(display_name)s, %(description)s, %(version)s, %(status)s, %(visibility)s,
  %(owner_id)s, %(org_id)s, %(manifest_json)s::jsonb, %(tags)s::jsonb
)
ON CONFLICT (name) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  description = EXCLUDED.description,
  version = EXCLUDED.version,
  status = EXCLUDED.status,
  visibility = EXCLUDED.visibility,
  owner_id = EXCLUDED.owner_id,
  org_id = EXCLUDED.org_id,
  manifest_json = EXCLUDED.manifest_json,
  tags = EXCLUDED.tags,
  deleted_at = NULL,
  updated_at = now()
RETURNING id, name, display_name, version, status, visibility, owner_id, org_id, created_at, updated_at, deleted_at;
"""

params = {
    "name": "demo-skill",
    "display_name": "Demo Skill",
    "description": "first migrated skill",
    "version": "v0.1.0",
    "status": "active",
    "visibility": "private",
    "owner_id": "admin",
    "org_id": "aisphere",
    "manifest_json": json.dumps({"schema": "v1"}, ensure_ascii=False),
    "tags": json.dumps(["demo", "migration"], ensure_ascii=False),
}

with psycopg.connect(DSN) as conn:
    with conn.cursor() as cur:
        cur.execute(sql, params)
        row = cur.fetchone()
        conn.commit()
        print("upsert ok:")
        print(row)

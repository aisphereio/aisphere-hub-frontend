'use client';

import { Cpu, Layers, Shield, ClipboardCheck } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export function DocsPage() {
  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-6">
      <div className="space-y-2">
        <h2 className="text-xl font-semibold">SkillHub Console Documentation</h2>
        <p className="text-sm text-muted-foreground">
          The SkillHub Console is a management interface for Agent Skill Registry, supporting skill lifecycle management,
          skillset orchestration, Agent Proposal governance, and access control.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2"><Cpu className="h-4 w-4 text-violet-500" /> Skills</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
              <li>Search, upload (ZIP), and browse skills</li>
              <li>Version management: submit, publish, online/offline</li>
              <li>Create drafts and force publish</li>
              <li>File browser with markdown preview</li>
              <li>Version comparison (diff view)</li>
              <li>Labels, bizTags, metadata, and scope management</li>
              <li>Social features: star, rating, subscribe</li>
            </ul>
          </CardContent>
        </Card>

        <Card className="border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2"><Layers className="h-4 w-4 text-fuchsia-500" /> SkillSets</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
              <li>Create and manage skill groups</li>
              <li>Bind/unbind skills with version, label, order</li>
              <li>SkillSet detail with members tab and manifest viewer</li>
              <li>SkillSet-level settings and scope control</li>
              <li>Public/private skillset scoping</li>
            </ul>
          </CardContent>
        </Card>

        <Card className="border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2"><Shield className="h-4 w-4 text-amber-500" /> Access / IAM</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
              <li>Namespace-based access control (RBAC)</li>
              <li>Member management with roles</li>
              <li>Local account and Agent account management</li>
              <li>API Key / Token lifecycle</li>
            </ul>
          </CardContent>
        </Card>

        <Card className="border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2"><ClipboardCheck className="h-4 w-4 text-emerald-500" /> Governance</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
              <li>Agent Proposal review workflow</li>
              <li>Validate, approve, reject proposals</li>
              <li>Delta and evidence inspection</li>
              <li>Gray release support</li>
            </ul>
          </CardContent>
        </Card>
      </div>

      <Card className="border-border/50">
        <CardHeader className="pb-2"><CardTitle className="text-sm">Key API Endpoints</CardTitle></CardHeader>
        <CardContent>
          <pre className="text-[11px] font-mono bg-muted/50 p-3 rounded-lg overflow-auto whitespace-pre-wrap">
{`# Canonical AIHub API (v1)

# Skill CRUD
GET  /v1/skills                            List skills
POST /v1/skills                            Create canonical skill
POST /v1/skills:upload                     Upload skill ZIP
GET  /v1/skills/:name                      Get skill detail
PUT  /v1/skills/:name                      Update skill metadata
DELETE /v1/skills/:name                    Delete skill

# Skill Versions
GET  /v1/skills/:name/versions             List versions
GET  /v1/skills/:name/versions/:version    Get version detail
POST /v1/skills/:name/versions/:version:submit   Submit version
POST /v1/skills/:name/versions/:version:publish  Publish version
POST /v1/skills/:name/versions/:version:online   Bring online
POST /v1/skills/:name/versions/:version:offline  Take offline
GET  /v1/skills/:name/versions/:version/download  Download ZIP

# Skill Files
GET  /v1/skills/:name/versions/:version/files   List files
GET  /v1/skills/:name/versions/:version/file    Get file content

# Skill Shares (authz relationships)
GET    /v1/skills/:name/shares              List shares
POST   /v1/skills/:name/shares              Grant viewer/editor relation
DELETE /v1/skills/:name/shares/:subjectType/:subjectId  Revoke all relations

# Authn (Casdoor OAuth)
GET  /v1/authn/login                       Browser 302 → Casdoor login
GET  /v1/authn/login-url                   JSON: Casdoor login URL
POST /v1/authn/exchange                    Exchange OAuth code for tokens
POST /v1/authn/refresh                     Refresh access token
GET  /v1/authn/logout-url                  JSON: Casdoor logout URL
GET  /v1/authn/logout                      Browser 302 → Casdoor logout
GET  /v1/authn/me                          Current authenticated principal
POST /v1/authn/revoke                      Revoke a token
POST /v1/authn/introspect                  Verify a token (RFC 7662)

# Authz (SpiceDB ReBAC + ABAC)
POST /v1/authz/check                       Check permission
POST /v1/authz/check:batch                 Batch check permissions
POST /v1/authz/relationships               Write relationship tuples
DELETE /v1/authz/relationships             Delete relationship tuples
GET  /v1/authz/relationships               Read relationship tuples
GET  /v1/authz/lookup-resources            Resources a subject can access
GET  /v1/authz/lookup-subjects             Subjects that can access a resource
GET  /v1/authz/schema                      Read SpiceDB schema
PUT  /v1/authz/schema                      Write SpiceDB schema

# Audit
GET  /v1/audit/records                     Query audit log

# Health
GET  /healthz                              Liveness probe (always 200)
GET  /readyz                               Readiness probe (checks DB + Cache + SpiceDB)`}
          </pre>
        </CardContent>
      </Card>

      <Card className="border-border/50">
        <CardHeader className="pb-2"><CardTitle className="text-sm">Deployment Notes</CardTitle></CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground">
            Build the frontend and place output in <code className="bg-muted px-1 rounded">web/aihub-console/dist</code>.
            Configure <code className="bg-muted px-1 rounded">web.enabled=true</code> in the backend config to serve via <code className="bg-muted px-1 rounded">/ui/</code>.
            For external OIDC mode, the upper-layer gateway can handle login and pass the Bearer Token to SkillHub.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

# Skills Domain

## Overview

Skills are the core entity of the Agent Skill Registry. A skill is a versioned package containing a file tree (code, markdown, configs) with a full lifecycle from draft to production.

## Skill Model

Defined in `src/lib/api/types.ts`:

```typescript
type Skill = {
  name: string;
  displayName?: string;
  description?: string;
  version?: string;
  status?: string;
  visibility?: string;    // "private" | "public"
  scope?: string;
  owner?: string;
  sourceType?: string;
  sourceUri?: string;
  manifestJson?: string;
  labels?: Record<string, string>;
  versions?: SkillVersion[];
  skillsets?: string[];   // SkillSet memberships
  tags?: string[];
  onlineVersion?: string;
  // ... more fields
};
```

## Skill Version Lifecycle

```
draft → submitted → published → online
                                 ↓
                              offline
```

- **draft** — Editable working version. Created via `ensureDraftVersion` API.
- **submitted** — Submitted for review.
- **published** — Published but not yet online.
- **online** — Active in production.
- **offline** — Deactivated.

The `SkillEditor` component handles version state transitions:
- Non-editable versions show a yellow banner with "Create draft to edit" button
- `ensureDraftVersion` automatically copies files from the base version into a new `-draft` version

## Skill File CRUD

Skills contain a file tree. The frontend supports full file CRUD on draft versions:

| Operation | API Endpoint | Hook |
|-----------|-------------|------|
| List files | `GET /v1/skills/{name}/versions/{ver}/files` | `useSkillFiles()` |
| Read file | `GET /v1/skills/{name}/versions/{ver}/file?path=` | `useSkillFileContent()` |
| Save file | `PUT /v1/skills/{name}/draft/file` | `useSaveSkillFile()` |
| Create file | `PUT /v1/skills/{name}/draft/file` | `useCreateSkillFile()` |
| Create dir | `POST /v1/skills/{name}/draft/dir` | `useCreateSkillFile()` |
| Delete file | `DELETE /v1/skills/{name}/draft/path` | `useDeleteSkillFile()` |
| Rename file | `POST /v1/skills/{name}/draft/path:move` | `useRenameSkillFile()` |
| Ensure draft | `POST /v1/skills/{name}/draft:commit` | `useEnsureDraftVersion()` |

**Draft version routing:** The `files()` and `file()` API methods check the version status. If the version is a draft, they use `/draft/files` and `/draft/file` endpoints. Otherwise, they use the versioned path.

## Skill Editor (`src/components/editor/skill-editor.tsx`)

The Skill Editor is the most complex component (~69KB). Key features:

- **Code Editor** — CodeMirror 6 with language support for JS, JSON, Markdown, Python, YAML
- **File Tree** — Tree view with create/rename/delete operations (hover actions, inline input)
- **Save All** — Top bar button with unsaved count badge
- **Dirty State** — Tracked via React Query cache comparison (not setState-in-effect)
- **Markdown Preview** — Three modes: Edit / Preview / Split View, using `remark-gfm` with Tailwind Typography
- **Version Management** — Auto-select draft, "Create draft to edit" banner, `ensureDraftVersion` integration
- **Beforeunload Warning** — Warns on page leave with unsaved changes

### File Tree (`src/components/editor/file-tree.tsx`)

- Accepts `editable`, `onCreateFile`, `onDeleteNode`, `onRenameNode` callbacks
- Directory hover: `FilePlus` + `FolderPlus` + DropdownMenu (rename/delete)
- File hover: `Pencil` + `Trash2` buttons
- Inline input for create/rename (Enter confirms, Esc cancels)

## Skill API (`src/lib/api/index.ts`)

The `skillApi` object provides all skill operations:

- **CRUD**: `list()`, `detail()`, `draft()`, `update()`, `remove()`
- **Versions**: `version()`, `publish()`, `submit()`, `online()`, `offline()`
- **Files**: `files()`, `file()`, `saveFile()`, `createFile()`, `deleteFile()`, `renameFile()`
- **Draft**: `ensureDraftVersion()`, `commitDraft()`, `deleteDraft()`
- **Compare**: `compare()` — compares two versions' file lists and SKILL.md content
- **Download**: `download()`, `downloadUrl()`
- **Metadata**: `labels()`, `bizTags()`, `metadata()`, `scope()`

### Normalization

The `normalizeSkill()` function normalizes skill data from the backend:
- Merges `tags`, `keywords`, `bizTags` into a unified `tags` array
- Sorts versions descending
- Derives `onlineVersion`, `stableVersion`, `latestVersion`
- Extracts `labels` and `metadata` from `manifestJson`

## Hooks (`src/hooks/use-skills.ts`)

| Hook | Purpose |
|------|---------|
| `useSkills(params)` | List skills with filtering |
| `useSkillDetail(name)` | Skill detail + versions |
| `useSkillFiles(name, version)` | List files in a version |
| `useSkillFileContent(name, version, path)` | Read file content |
| `useSkillCompare(name, base, target)` | Compare two versions |
| `useSaveSkillFile()` | Save file mutation |
| `useCreateSkillFile()` | Create file mutation |
| `useDeleteSkillFile()` | Delete file mutation |
| `useRenameSkillFile()` | Rename file mutation |
| `useEnsureDraftVersion()` | Ensure draft exists mutation |

## Source Files

| File | Purpose |
|------|---------|
| `src/lib/api/index.ts` (skillApi) | All skill API methods |
| `src/lib/api/types.ts` | Skill, SkillVersion, SkillFileInfo, SkillFileContent types |
| `src/hooks/use-skills.ts` | React Query hooks for skills |
| `src/components/editor/skill-editor.tsx` | Main skill editor component |
| `src/components/editor/file-tree.tsx` | File tree with CRUD |
| `src/components/editor/code-editor.tsx` | CodeMirror wrapper |
| `src/components/skills/skill-card.tsx` | Skill list card |
| `src/components/skills/skill-detail-sheet.tsx` | Skill detail slide-out |
| `src/components/skills/skill-create-dialog.tsx` | Create skill dialog |
| `src/components/skills/skill-upload-dialog.tsx` | Upload skill package |
| `src/components/skills/skill-share-dialog.tsx` | Share skill dialog |
| `src/components/skills/skill-filters.tsx` | Skill list filters |
| `src/components/skills/skill-version-timeline.tsx` | Version history timeline |
| `src/components/skills/skill-compare-view.tsx` | Version comparison view |
| `src/components/skills/skill-file-browser.tsx` | File browser for non-editor view |
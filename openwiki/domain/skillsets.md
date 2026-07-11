# SkillSets Domain

## Overview

SkillSets are named groups of skills that allow organizing skills into logical collections. Each SkillSet has ordered members with configurable properties.

## SkillSet Model

Defined in `src/lib/api/types.ts`:

```typescript
type SkillSet = {
  name: string;
  displayName?: string;
  description?: string;
  labels?: Record<string, string>;
  members?: SkillSetMember[];
  createTime?: string;
  updateTime?: string;
};

type SkillSetMember = {
  skillName: string;
  displayName?: string;
  required?: boolean;
  order?: number;
  labels?: Record<string, string>;
};

type SkillSetUpdate = {
  displayName?: string;
  description?: string;
  labels?: Record<string, string>;
};
```

## API Endpoints

The SkillSet API is still on the legacy `/v1/skillsets/*` path (awaiting backend migration to the new hub):

| Operation | Endpoint | Hook |
|-----------|----------|------|
| List | `GET /v1/skillsets` | `useSkillSets()` |
| Detail | `GET /v1/skillsets/{name}` | `useSkillSetDetail()` |
| Create | `POST /v1/skillsets` | `useSkillSetSave()` |
| Update | `PUT /v1/skillsets/{name}` | `useSkillSetUpdate()` |
| Delete | `DELETE /v1/skillsets/{name}` | `useSkillSetDelete()` |
| Bind skill | `POST /v1/skillsets/{name}/members` | `useSkillSetBind()` |
| Update member | `PUT /v1/skillsets/{name}/members/{skill}` | `useSkillSetUpdateMember()` |
| Unbind skill | `DELETE /v1/skillsets/{name}/members/{skill}` | `useSkillSetUnbind()` |
| List skills | `GET /v1/skillsets/{name}/skills` | `useSkillSetSkills()` |

## Cache Invalidation

SkillSet mutations invalidate multiple query caches to keep the UI consistent:

- **Bind/Unbind** invalidates: `skillsets:detail`, `skillsets:list`, `skills:list` (because skills show their SkillSet memberships)
- **Update** invalidates: `skillsets:detail`, `skillsets:list`
- **Save/Delete** invalidates: `skillsets:list`

## Components

### SkillSet Card (`src/components/skillsets/skillset-card.tsx`)
- Displays SkillSet name, description, member count
- Click opens the detail sheet

### SkillSet Detail Sheet (`src/components/skillsets/skillset-detail-sheet.tsx`)
- Slide-out panel with tabs: overview, members, settings
- Shows member list with required flags and order
- Tab titles use i18n keys

### SkillSet Member List (`src/components/skillsets/skillset-member-list.tsx`)
- Lists all skills in the SkillSet
- Search box to filter quick-pick skills
- Required column as a Switch toggle
- Order column with ↑/↓ buttons for reordering
- All toast feedback uses i18n

### SkillSet Create Dialog (`src/components/skillsets/skillset-create-dialog.tsx`)
- Form to create a new SkillSet with name, display name, description

## Source Files

| File | Purpose |
|------|---------|
| `src/lib/api/index.ts` (skillSetApi) | All SkillSet API methods |
| `src/hooks/use-skillsets.ts` | React Query hooks for SkillSets |
| `src/components/skillsets/skillset-card.tsx` | SkillSet list card |
| `src/components/skillsets/skillset-detail-sheet.tsx` | Detail slide-out |
| `src/components/skillsets/skillset-member-list.tsx` | Member management |
| `src/components/skillsets/skillset-create-dialog.tsx` | Create dialog |
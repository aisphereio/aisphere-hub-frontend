/**
 * skillApi — adapter over the orval-generated SkillService client.
 *
 * Preserves the hand-written module's 27 public methods so consumers
 * (skills-page, skill-editor, use-skills, ...) keep importing from
 * ../index unchanged.
 *
 * Mapping notes:
 *  - Generated V1Skill is a sparse proto shape; normalizeSkill() (from
 *    ./internal) rehydrates the UI's richer Skill domain type (versions,
 *    tags, scope, metadata) exactly as the hand-written module did.
 *  - Generated numeric-ish fields (id, sizeBytes, downloadCount) arrive as
 *    strings; toSkillVersion/toFileInfo coerce them to the domain types.
 *  - draft vs published file branching (files/file) is reproduced using the
 *    generated atomic RPCs, matching the hand-written logic.
 */
import {
  skillServiceCommitSkillDraft,
  skillServiceCreateSkill,
  skillServiceDeleteSkill,
  skillServiceDeleteSkillDraftPath,
  skillServiceDownloadSkillVersion,
  skillServiceGetSkill,
  skillServiceGetSkillDraftFile,
  skillServiceGetSkillVersion,
  skillServiceGetSkillVersionFile,
  skillServiceListSkillDraftFiles,
  skillServiceListSkills,
  skillServiceListSkillVersionFiles,
  skillServiceListSkillVersions,
  skillServiceMoveSkillDraftPath,
  skillServiceOfflineSkillVersion,
  skillServiceOnlineSkillVersion,
  skillServicePublishSkillVersion,
  skillServiceSubmitSkillVersion,
  skillServiceUpdateSkill,
  skillServiceUpdateSkillVisibility,
  skillServiceUpsertSkillDraftDirectory,
  skillServiceUpsertSkillDraftFile,
  skillServiceUploadSkillPackage,
} from '../generated/skill-service/skill-service';
import type {
  V1Skill,
  V1SkillFile,
  V1SkillVersion,
} from '../generated/model';
import type {
  Page,
  Skill,
  SkillDraft,
  SkillFileContent,
  SkillFileList,
  SkillFileInfo,
  SkillPackageDownload,
  SkillVersion,
} from '../types';
import {
  contentTypeForPath,
  fileToBase64,
  manifestJsonForUpdate,
  mergeUniqueTags,
  normalizeSkill,
  normalizeSkillPage,
} from './internal';

function toNum(v: unknown): number | undefined {
  if (v === undefined || v === null) return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

function toSkillVersion(v: V1SkillVersion): SkillVersion {
  return {
    id: toNum(v.id),
    skillName: v.skillName,
    version: v.version || '',
    status: v.status,
    md5: v.md5,
    sha256: v.sha256,
    revision: v.revision,
    sizeBytes: toNum(v.sizeBytes),
    downloadCount: toNum(v.downloadCount),
    commitMsg: v.commitMsg,
    author: v.author,
    manifestJson: v.manifestJson,
    createTime: v.createTime,
    updateTime: v.updateTime,
  };
}

function toFileInfo(f: V1SkillFile): SkillFileInfo {
  return {
    path: f.path || '',
    name: f.name || '',
    type: f.type,
    size: toNum(f.size),
    binary: f.binary,
  };
}

function toFileContent(
  name: string,
  version: string,
  f: V1SkillFile,
): SkillFileContent {
  return {
    skillName: name,
    version,
    path: f.path || '',
    content: f.content || '',
    binary: f.binary,
  };
}

function toSkill(s: V1Skill): Skill {
  // V1Skill lacks versions/keywords/bizTags; normalizeSkill fills defaults
  // from manifestJson and reconciles tag aliases.
  return normalizeSkill({
    ...s,
    versions: [],
  } as Skill);
}

export const skillApi = {
  list: async (params: Record<string, unknown> = {}) => {
    const reply = await skillServiceListSkills({
      pageSize: toNum(params.pageSize ?? params.page_size) as
        | number
        | undefined,
      pageToken: (params.pageToken ?? params.page_token) as
        | string
        | undefined,
      q: (params.q ?? params.search ?? params.keyword) as string | undefined,
      status: params.status as string | undefined,
      visibility: (params.visibility ?? params.scope) as string | undefined,
    });
    const page = {
      items: (reply.skills || []).map(toSkill),
      skills: (reply.skills || []).map(toSkill),
      nextPageToken: reply.nextPageToken,
    } as Page<Skill>;
    return normalizeSkillPage(page);
  },

  detail: async (skillName: string) => {
    const [skill, versionsReply] = await Promise.all([
      skillServiceGetSkill(skillName),
      skillServiceListSkillVersions(skillName),
    ]);
    const versions = (versionsReply.versions || []).map(toSkillVersion);
    return normalizeSkill({ ...(toSkill(skill) as Skill), versions });
  },

  version: (skillName: string, version: string) =>
    skillServiceGetSkillVersion(skillName, version).then(toSkillVersion),

  upload: async (
    file: File,
    overwrite = true,
    targetVersion = '',
    commitMsg = '',
  ) =>
    skillServiceUploadSkillPackage({
      packageBytes: await fileToBase64(file),
      overwrite,
      targetVersion,
      commitMsg,
    }).then(toSkillVersion),

  batchUpload: async (files: File[], overwrite = true) => {
    const versions: SkillVersion[] = [];
    for (const file of files) {
      versions.push(await skillApi.upload(file, overwrite));
    }
    return versions;
  },

  remove: (skillName: string) =>
    skillServiceDeleteSkill(skillName).then(() => '') as Promise<string>,

  publish: (skillName: string, version: string) =>
    skillServicePublishSkillVersion(skillName, version, {}).then(
      () => '',
    ) as Promise<string>,

  submit: (skillName: string, version: string) =>
    skillServiceSubmitSkillVersion(skillName, version, {}).then(
      () => '',
    ) as Promise<string>,

  online: (skillName: string, version: string) =>
    skillServiceOnlineSkillVersion(skillName, version, {}).then(
      () => '',
    ) as Promise<string>,

  offline: (skillName: string, version: string) =>
    skillServiceOfflineSkillVersion(skillName, version, {}).then(
      () => '',
    ) as Promise<string>,

  labels: (skillName: string, labels: Record<string, string>) =>
    skillApi.update(skillName, { name: skillName, labels }),

  downloadUrl: (skillName: string, version: string) =>
    `/v1/skills/${encodeURIComponent(skillName)}/versions/${encodeURIComponent(version)}/download`,

  download: (skillName: string, version: string) =>
    skillServiceDownloadSkillVersion(skillName, version).then((d) => ({
      skillName: d.skillName || skillName,
      version: d.version || version,
      etag: d.etag,
      md5: d.md5,
      sha256: d.sha256,
      notModified: d.notModified,
      packageBytes: d.packageBytes,
    })) as Promise<SkillPackageDownload>,

  files: async (skillName: string, version: string) => {
    const versionMeta = await skillServiceGetSkillVersion(
      skillName,
      version,
    ).then(toSkillVersion);
    if (versionMeta.status === 'draft') {
      const reply = await skillServiceListSkillDraftFiles(skillName, {
        version,
      });
      return { files: (reply.files || []).map(toFileInfo) } as SkillFileList;
    }
    const reply = await skillServiceListSkillVersionFiles(
      skillName,
      version,
    );
    return { files: (reply.files || []).map(toFileInfo) } as SkillFileList;
  },

  file: async (skillName: string, version: string, path: string) => {
    const versionMeta = await skillServiceGetSkillVersion(
      skillName,
      version,
    ).then(toSkillVersion);
    if (versionMeta.status === 'draft') {
      const f = await skillServiceGetSkillDraftFile(skillName, {
        version,
        path,
      });
      return toFileContent(skillName, version, f);
    }
    const f = await skillServiceGetSkillVersionFile(skillName, version, {
      path,
    });
    return toFileContent(skillName, version, f);
  },

  /** Save (create or update) a single text file in a draft/editing version. */
  saveFile: (
    skillName: string,
    version: string,
    path: string,
    content: string,
    commitMsg = '',
  ) =>
    skillServiceUpsertSkillDraftFile(skillName, {
      version,
      path,
      type: contentTypeForPath(path),
      content,
      createParents: true,
    }).then((f) => toFileContent(skillName, version, f)) as Promise<
      SkillFileContent
    >,

  /** Create a new empty file or folder. */
  createFile: (
    skillName: string,
    version: string,
    path: string,
    type: 'file' | 'dir' = 'file',
    content = '',
  ) => {
    if (type === 'dir') {
      return skillServiceUpsertSkillDraftDirectory(skillName, {
        version,
        path,
      }).then((f) => toFileContent(skillName, version, f)) as Promise<
        SkillFileContent
      >;
    }
    return skillServiceUpsertSkillDraftFile(skillName, {
      version,
      path,
      type: contentTypeForPath(path),
      content,
      createParents: true,
    }).then((f) => toFileContent(skillName, version, f)) as Promise<
      SkillFileContent
    >;
  },

  /** Delete a file or directory from a draft version. */
  deleteFile: (skillName: string, version: string, path: string) =>
    skillServiceDeleteSkillDraftPath(skillName, {
      version,
      path,
      recursive: true,
    }),

  /** Rename or move a file/directory inside a draft version. */
  renameFile: (
    skillName: string,
    version: string,
    oldPath: string,
    newPath: string,
  ) =>
    skillServiceMoveSkillDraftPath(skillName, {
      version,
      oldPath,
      newPath,
      overwrite: false,
    }),

  /** Ensure a draft version exists for editing; creates one if the skill only has published versions. */
  ensureDraftVersion: async (skillName: string, baseVersion = '') => {
    const detail = await skillApi.detail(skillName);
    const existing = (detail.versions || []).find((v) => v.status === 'draft');
    if (existing?.version) return { version: existing.version, created: false };
    const base =
      baseVersion || detail.version || detail.latestVersion || '0.0.1';
    const draftVersion = base.endsWith('-draft') ? base : `${base}-draft`;
    const baseFilesReply = await skillServiceListSkillVersionFiles(
      skillName,
      base,
    ).catch(() => ({ files: [] }));
    for (const file of baseFilesReply.files || []) {
      if (!file.path) continue;
      if (file.type === 'directory') {
        await skillServiceUpsertSkillDraftDirectory(skillName, {
          version: draftVersion,
          path: file.path,
        });
        continue;
      }
      const content = await skillServiceGetSkillVersionFile(skillName, base, {
        path: file.path,
      });
      await skillServiceUpsertSkillDraftFile(skillName, {
        version: draftVersion,
        path: file.path,
        type: file.type || contentTypeForPath(file.path),
        content: content.content || '',
        binary: Boolean(content.binary || file.binary),
        createParents: true,
      });
    }
    return { version: draftVersion, created: true };
  },

  commitDraft: (
    skillName: string,
    version: string,
    opts: {
      commitMsg?: string;
      overwrite?: boolean;
      submit?: boolean;
      publish?: boolean;
      online?: boolean;
    } = {},
  ) =>
    skillServiceCommitSkillDraft(skillName, {
      version,
      commitMsg: opts.commitMsg || '',
      overwrite: opts.overwrite ?? true,
      submit: opts.submit ?? false,
      publish: opts.publish ?? false,
      online: opts.online ?? false,
    }).then(toSkillVersion),

  compare: async (
    skillName: string,
    baseVersion: string,
    targetVersion: string,
  ) => {
    const [baseFiles, targetFiles] = await Promise.all([
      skillApi.files(skillName, baseVersion),
      skillApi.files(skillName, targetVersion),
    ]);
    const [baseSkillMd, targetSkillMd] = await Promise.all([
      skillApi
        .file(skillName, baseVersion, 'SKILL.md')
        .then((f) => f.content || '')
        .catch(() => ''),
      skillApi
        .file(skillName, targetVersion, 'SKILL.md')
        .then((f) => f.content || '')
        .catch(() => ''),
    ]);
    return {
      baseVersion,
      targetVersion,
      baseSkillMd,
      targetSkillMd,
      baseFiles: baseFiles.files || [],
      targetFiles: targetFiles.files || [],
    };
  },

  update: async (skillName: string, data: Partial<Skill>) => {
    // The backend PUT is not a sparse PATCH: protobuf default values make
    // omitted strings indistinguishable from empty strings. Always merge
    // with current detail first, so settings panels do not accidentally
    // reset visibility/status/metadata.
    const current = toSkill(await skillServiceGetSkill(skillName));
    const tags = mergeUniqueTags(
      (data as any).tags ?? current.tags,
      data.keywords ?? current.keywords,
      data.bizTags ?? current.bizTags,
    );
    const updated = await skillServiceUpdateSkill(skillName, {
      displayName: data.displayName ?? current.displayName ?? '',
      description: data.description ?? current.description ?? '',
      version: data.version ?? current.version ?? '',
      sourceType: data.sourceType ?? current.sourceType ?? '',
      sourceUri: data.sourceUri ?? current.sourceUri ?? '',
      manifestJson: manifestJsonForUpdate(current, data),
      tags,
    });
    return toSkill(updated);
  },

  draft: async (data: SkillDraft) => {
    const created = await skillServiceCreateSkill({
      name: data.name,
      displayName: data.displayName,
      description: data.description,
      version: data.version,
      status: 'active',
      visibility: data.scope || 'private',
      manifestJson: data.metadata
        ? JSON.stringify({ metadata: data.metadata })
        : '{}',
      tags: [...(data.keywords || []), ...(data.bizTags || [])],
    });
    return toSkill(created);
  },

  updateDraft: (data: SkillDraft) =>
    skillApi.update(data.name, {
      name: data.name,
      displayName: data.displayName,
      description: data.description,
      version: data.version,
      visibility: data.scope as Skill['visibility'],
      metadata: data.metadata,
      tags: [...(data.keywords || []), ...(data.bizTags || [])],
    }),

  deleteDraft: (skillName: string) => skillApi.remove(skillName),

  forcePublish: (skillName: string, version: string) =>
    skillApi.publish(skillName, version),

  redraft: (skillName: string, version: string) =>
    skillApi.ensureDraftVersion(skillName, version),

  bizTags: (skillName: string, tags: string[]) =>
    skillApi.update(skillName, { name: skillName, tags, bizTags: tags }),

  metadata: (skillName: string, metadata: Record<string, unknown>) =>
    skillApi.update(skillName, { name: skillName, metadata }),

  scope: async (skillName: string, scope: string) => {
    const visibility = String(scope || '').toLowerCase();
    if (!['private', 'internal', 'public'].includes(visibility)) {
      throw new Error(
        'Skill visibility must be private, internal, or public',
      );
    }
    const updated = await skillServiceUpdateSkillVisibility(skillName, {
      visibility,
    });
    return toSkill(updated);
  },
};

/**
 * fileApi — adapter over the orval-generated FileService client.
 *
 * The hub FileService is a convenience content layer over the bare git
 * repo, mirroring the GitLab/Gitea repository-files REST shape. The
 * generated client returns proto types (V1FileContent with base64
 * content, V1FileInfo with stringified sizes); this adapter decodes
 * base64 content to plaintext and coerces numeric fields so UI code
 * can treat files as plain { path, content: string } objects.
 *
 * Authz is enforced server-side by biz.FileUsecase (writes bypass the
 * receive-pack update hook, so the biz layer Require()s explicitly).
 * The adapter does NOT retry on 409 — it surfaces the conflict so the
 * caller can refetch and let the user decide (see useSaveFile).
 */
import {
  fileServiceCreateFile,
  fileServiceDeleteFile,
  fileServiceGetFile,
  fileServiceListFiles,
  fileServiceUpdateFile,
} from "../generated/file-service/file-service";
import type {
  FileServiceCreateFileBody,
  FileServiceDeleteFileParams,
  FileServiceGetFileParams,
  FileServiceListFilesParams,
  FileServiceUpdateFileBody,
  V1CreateFileResponse,
  V1FileContents,
  V1FileInfo,
  V1GetFileResponse,
  V1UpdateFileResponse,
} from "../generated/model";
import type { SkillFile, SkillFileEntry } from "../types";

// --- coerce helpers ---------------------------------------------------------

function toNum(v: unknown): number {
  if (v === undefined || v === null || v === "") return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function entryType(t: unknown): SkillFileEntry["type"] {
  switch (t) {
    case "dir":
    case "file":
    case "symlink":
    case "commit":
      return t;
    default:
      return "file";
  }
}

function toEntry(e: V1FileInfo): SkillFileEntry {
  return {
    name: e.name ?? "",
    path: e.path ?? "",
    type: entryType(e.type),
    size: toNum(e.size),
    mode: e.mode ?? "",
    sha: e.sha ?? "",
    lastModified: e.lastModified,
  };
}

function decodeContent(content: string | undefined): string {
  if (!content) return "";
  try {
    // atob is available in browser and Node 16+. The backend guarantees
    // standard base64; if it ever sends a non-base64 payload we'd rather
    // show empty than crash the editor.
    if (typeof atob === "function") {
      return decodeURIComponent(
        atob(content)
          .split("")
          .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
          .join(""),
      );
    }
    return Buffer.from(content, "base64").toString("utf-8");
  } catch {
    return "";
  }
}

function encodeContent(plaintext: string): string {
  try {
    if (typeof btoa === "function") {
      return btoa(
        encodeURIComponent(plaintext).replace(/%([0-9A-F]{2})/g, (_, p1) =>
          String.fromCharCode(Number.parseInt(p1, 16)),
        ),
      );
    }
    return Buffer.from(plaintext, "utf-8").toString("base64");
  } catch {
    return "";
  }
}

function toFile(c: V1GetFileResponse | V1CreateFileResponse | V1UpdateFileResponse): SkillFile {
  return {
    name: c.name ?? "",
    path: c.path ?? "",
    sha: c.sha ?? "",
    size: toNum(c.size),
    content: decodeContent(c.content),
    encoding: "base64",
    ref: c.ref ?? "",
    commitSha: c.commitSha,
    commitMessage: c.commitMessage,
    lastModified: c.lastModified,
  };
}

// --- adapter surface --------------------------------------------------------

export const fileApi = {
  /** List entries at path on ref (default HEAD, root when path is ""). */
  list: async (
    skillName: string,
    params: { path?: string; ref?: string } = {},
  ): Promise<SkillFileEntry[]> => {
    const reply: V1FileContents = await fileServiceListFiles(skillName, {
      path: params.path,
      ref: params.ref,
    } as FileServiceListFilesParams);
    const entries = reply.entries ?? [];
    return entries.map(toEntry);
  },

  /** Fetch a single file's content + commit metadata. */
  get: async (
    skillName: string,
    path: string,
    ref?: string,
  ): Promise<SkillFile> => {
    const reply: V1GetFileResponse = await fileServiceGetFile(skillName, path, {
      ref,
    } as FileServiceGetFileParams);
    return toFile(reply);
  },

  /** Create a new file. Refuses to clobber (server returns 409). */
  create: async (
    skillName: string,
    path: string,
    content: string,
    opts: { message?: string; branch?: string } = {},
  ): Promise<SkillFile> => {
    const body: FileServiceCreateFileBody = {
      content: encodeContent(content),
      message: opts.message,
      branch: opts.branch,
    };
    const reply: V1CreateFileResponse = await fileServiceCreateFile(
      skillName,
      path,
      body,
    );
    return toFile(reply);
  },

  /**
   * Update an existing file. sha is the blob hash the caller last saw;
   * a mismatch (someone else wrote first) surfaces as a 409 from the
   * server, which hubFetch turns into a HubApiError. The caller decides
   * whether to refetch or overwrite.
   */
  update: async (
    skillName: string,
    path: string,
    content: string,
    opts: { message?: string; sha?: string; branch?: string } = {},
  ): Promise<SkillFile> => {
    const body: FileServiceUpdateFileBody = {
      content: encodeContent(content),
      message: opts.message,
      sha: opts.sha,
      branch: opts.branch,
    };
    const reply: V1UpdateFileResponse = await fileServiceUpdateFile(
      skillName,
      path,
      body,
    );
    return toFile(reply);
  },

  /** Delete a file. Returns the new commit identity. */
  remove: async (
    skillName: string,
    path: string,
    opts: { message?: string; sha?: string; branch?: string } = {},
  ): Promise<{ commitSha: string; commitMessage: string }> => {
    const reply = await fileServiceDeleteFile(skillName, path, {
      message: opts.message,
      sha: opts.sha,
      branch: opts.branch,
    } as FileServiceDeleteFileParams);
    return {
      commitSha: reply.commitSha ?? "",
      commitMessage: reply.commitMessage ?? "",
    };
  },
};

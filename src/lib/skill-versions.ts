export type SkillReleaseLike = {
  tag?: string;
};

export type SkillReleaseKind = "stable" | "prerelease";

export type SkillReleaseView<T extends SkillReleaseLike> = {
  release: T;
  tag: string;
  version: string;
  ref: string;
  kind: SkillReleaseKind;
  latestStable: boolean;
};

type ParsedVersion = {
  tag: string;
  version: string;
  major: string;
  minor: string;
  patch: string;
  prerelease: string[];
};

const canonicalSemVer =
  /^v(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/;

function parseVersion(tag: string | undefined): ParsedVersion | null {
  const value = tag?.trim() ?? "";
  const match = canonicalSemVer.exec(value);
  if (!match) return null;

  const prerelease = match[4]?.split(".") ?? [];
  if (
    prerelease.some(
      (identifier) => /^\d+$/.test(identifier) && identifier.length > 1 && identifier.startsWith("0"),
    )
  ) {
    return null;
  }

  return {
    tag: value,
    version: value.slice(1),
    major: match[1],
    minor: match[2],
    patch: match[3],
    prerelease,
  };
}

function compareNumericText(left: string, right: string): number {
  if (left.length !== right.length) return left.length > right.length ? 1 : -1;
  if (left === right) return 0;
  return left > right ? 1 : -1;
}

function comparePrerelease(left: string[], right: string[]): number {
  if (left.length === 0 && right.length === 0) return 0;
  if (left.length === 0) return 1;
  if (right.length === 0) return -1;

  const length = Math.max(left.length, right.length);
  for (let index = 0; index < length; index += 1) {
    const leftPart = left[index];
    const rightPart = right[index];
    if (leftPart === undefined) return -1;
    if (rightPart === undefined) return 1;
    if (leftPart === rightPart) continue;

    const leftNumeric = /^\d+$/.test(leftPart);
    const rightNumeric = /^\d+$/.test(rightPart);
    if (leftNumeric && rightNumeric) return compareNumericText(leftPart, rightPart);
    if (leftNumeric !== rightNumeric) return leftNumeric ? -1 : 1;
    return leftPart > rightPart ? 1 : -1;
  }
  return 0;
}

export function isCanonicalSkillVersionTag(tag: string | undefined): boolean {
  return parseVersion(tag) !== null;
}

export function compareSkillVersionTags(left: string, right: string): number {
  const leftVersion = parseVersion(left);
  const rightVersion = parseVersion(right);
  if (!leftVersion || !rightVersion) return left.localeCompare(right);

  for (const key of ["major", "minor", "patch"] as const) {
    const compared = compareNumericText(leftVersion[key], rightVersion[key]);
    if (compared !== 0) return compared;
  }
  return comparePrerelease(leftVersion.prerelease, rightVersion.prerelease);
}

export function buildSkillReleaseViews<T extends SkillReleaseLike>(
  releases: T[],
): SkillReleaseView<T>[] {
  const seen = new Set<string>();
  const parsed = releases
    .map((release) => ({ release, parsed: parseVersion(release.tag) }))
    .filter(
      (item): item is { release: T; parsed: ParsedVersion } => item.parsed !== null,
    )
    .filter((item) => {
      if (seen.has(item.parsed.tag)) return false;
      seen.add(item.parsed.tag);
      return true;
    })
    .sort((left, right) => compareSkillVersionTags(right.parsed.tag, left.parsed.tag));

  const latestStableTag = parsed.find((item) => item.parsed.prerelease.length === 0)?.parsed.tag;

  return parsed.map(({ release, parsed: version }) => ({
    release,
    tag: version.tag,
    version: version.version,
    ref: `refs/tags/${version.tag}`,
    kind: version.prerelease.length === 0 ? "stable" : "prerelease",
    latestStable: version.tag === latestStableTag,
  }));
}

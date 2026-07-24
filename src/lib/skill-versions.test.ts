import { describe, expect, it } from "vitest";

import {
  buildSkillReleaseViews,
  compareSkillVersionTags,
  isCanonicalSkillVersionTag,
} from "./skill-versions";

describe("skill version helpers", () => {
  it("accepts canonical stable and prerelease tags only", () => {
    expect(isCanonicalSkillVersionTag("v1.2.3")).toBe(true);
    expect(isCanonicalSkillVersionTag("v2.0.0-rc.1")).toBe(true);
    expect(isCanonicalSkillVersionTag("1.2.3")).toBe(false);
    expect(isCanonicalSkillVersionTag("backup-0724")).toBe(false);
    expect(isCanonicalSkillVersionTag("v1.2.3-01")).toBe(false);
  });

  it("sorts with SemVer precedence", () => {
    expect(compareSkillVersionTags("v1.10.0", "v1.9.0")).toBeGreaterThan(0);
    expect(compareSkillVersionTags("v2.0.0", "v2.0.0-rc.1")).toBeGreaterThan(0);
    expect(compareSkillVersionTags("v2.0.0-rc.10", "v2.0.0-rc.2")).toBeGreaterThan(0);
  });

  it("builds stable and prerelease views and marks only the latest stable", () => {
    const views = buildSkillReleaseViews([
      { tag: "backup-0724" },
      { tag: "v1.9.0" },
      { tag: "v2.0.0-beta.2" },
      { tag: "v1.10.0" },
      { tag: "v2.0.0-beta.1" },
    ]);

    expect(views.map((view) => view.tag)).toEqual([
      "v2.0.0-beta.2",
      "v2.0.0-beta.1",
      "v1.10.0",
      "v1.9.0",
    ]);
    expect(views.find((view) => view.latestStable)?.tag).toBe("v1.10.0");
    expect(views.filter((view) => view.latestStable)).toHaveLength(1);
    expect(views[0].kind).toBe("prerelease");
    expect(views[2].ref).toBe("refs/tags/v1.10.0");
  });
});

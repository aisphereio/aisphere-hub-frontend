package biz

import (
	"archive/zip"
	"bytes"
	"context"
	"reflect"
	"sort"
	"strings"
	"testing"

	"github.com/actionlab-ai/aisphere-kit/access"
	"github.com/actionlab-ai/aisphere-kit/permission"
	"github.com/actionlab-ai/aisphere-kit/principal"
	"github.com/actionlab-ai/aisphere-kit/resource"
)

func TestSkillUsecaseListSkillSharesGroupsPolicyGrants(t *testing.T) {
	ctx := skillTestContext()
	perm := &fakeSkillPermission{
		grants: []permission.Grant{
			{Subject: "aisphere/test3", Resource: resource.Name("aihub:skill:share-skill-1"), Action: SkillActionRead},
			{Subject: "aisphere/test3", Resource: resource.Name("aihub:skill:share-skill-1"), Action: "skill.file.read"},
			{Subject: "service:agent-platform", Resource: resource.Name("aihub:skill:share-skill-1"), Action: SkillActionConsume},
			{Subject: "aisphere/test3", Resource: resource.Name("aihub:skill:other"), Action: SkillActionRead},
		},
	}
	uc := NewSkillUsecase(&fakeSkillRepo{skills: map[string]*Skill{
		"share-skill-1": {Name: "share-skill-1", OrgID: "aisphere"},
	}}, access.NewGuard(access.Options{}), perm)

	shares, err := uc.ListSkillShares(ctx, "share-skill-1")
	if err != nil {
		t.Fatalf("ListSkillShares() error = %v", err)
	}

	if len(shares) != 2 {
		t.Fatalf("ListSkillShares() len = %d, want 2: %#v", len(shares), shares)
	}
	if shares[0].Subject != "aisphere/test3" {
		t.Fatalf("first share subject = %q, want aisphere/test3", shares[0].Subject)
	}
	if shares[0].SubjectType != permission.SubjectUser || shares[0].SubjectID != "aisphere/test3" {
		t.Fatalf("first share subject fields = (%q, %q), want user aisphere/test3", shares[0].SubjectType, shares[0].SubjectID)
	}
	if got, want := shares[0].Actions, []string{"skill.file.read", SkillActionRead}; !reflect.DeepEqual(got, want) {
		t.Fatalf("first share actions = %#v, want %#v", got, want)
	}
	if shares[1].Subject != "service:agent-platform" || shares[1].SubjectType != permission.SubjectService || shares[1].SubjectID != "agent-platform" {
		t.Fatalf("second share = %#v, want service:agent-platform", shares[1])
	}
}

func TestSkillUsecaseDeleteSkillShareRevokesAllSubjectActions(t *testing.T) {
	ctx := skillTestContext()
	perm := &fakeSkillPermission{
		grants: []permission.Grant{
			{Subject: "aisphere/test3", Resource: resource.Name("aihub:skill:share-skill-1"), Action: SkillActionRead},
			{Subject: "aisphere/test3", Resource: resource.Name("aihub:skill:share-skill-1"), Action: "skill.file.read"},
			{Subject: "service:agent-platform", Resource: resource.Name("aihub:skill:share-skill-1"), Action: SkillActionConsume},
		},
	}
	uc := NewSkillUsecase(&fakeSkillRepo{skills: map[string]*Skill{
		"share-skill-1": {Name: "share-skill-1", OrgID: "aisphere"},
	}}, access.NewGuard(access.Options{}), perm)

	if err := uc.DeleteSkillShare(ctx, "share-skill-1", encodeSkillGrantID("aisphere/test3")); err != nil {
		t.Fatalf("DeleteSkillShare() error = %v", err)
	}

	if got, want := len(perm.revoked), 2; got != want {
		t.Fatalf("revoked len = %d, want %d: %#v", got, want, perm.revoked)
	}
	if perm.revoked[0].Subject != "aisphere/test3" || perm.revoked[1].Subject != "aisphere/test3" {
		t.Fatalf("revoked subjects = %#v, want only aisphere/test3", perm.revoked)
	}
	if perm.revoked[0].Resource.String() != "aihub:skill:share-skill-1" || perm.revoked[1].Resource.String() != "aihub:skill:share-skill-1" {
		t.Fatalf("revoked resources = %#v", perm.revoked)
	}
}

func TestSkillUsecaseListAndGetSkillVersions(t *testing.T) {
	ctx := skillTestContext()
	repo := &fakeSkillRepo{
		skills: map[string]*Skill{
			"versioned-skill": {Name: "versioned-skill", OrgID: "aisphere"},
		},
		versions: map[string][]*SkillVersion{
			"versioned-skill": {
				{SkillName: "versioned-skill", Version: "0.0.1", Status: SkillVersionStatusDraft, MD5: "md5-v1"},
				{SkillName: "versioned-skill", Version: "0.0.2", Status: SkillVersionStatusOnline, MD5: "md5-v2"},
			},
		},
	}
	uc := NewSkillUsecase(repo, access.NewGuard(access.Options{}), &fakeSkillPermission{})

	list, err := uc.ListSkillVersions(ctx, "versioned-skill")
	if err != nil {
		t.Fatalf("ListSkillVersions() error = %v", err)
	}
	if len(list) != 2 {
		t.Fatalf("ListSkillVersions() len = %d, want 2", len(list))
	}
	if list[0].Version != "0.0.1" || list[1].Version != "0.0.2" {
		t.Fatalf("ListSkillVersions() = %#v, want stable ordering by version", list)
	}

	got, err := uc.GetSkillVersion(ctx, "versioned-skill", "0.0.2")
	if err != nil {
		t.Fatalf("GetSkillVersion() error = %v", err)
	}
	if got.Status != SkillVersionStatusOnline || got.MD5 != "md5-v2" {
		t.Fatalf("GetSkillVersion() = %#v, want online md5-v2", got)
	}
}

func TestSkillUsecaseListAndGetSkillVersionFiles(t *testing.T) {
	ctx := skillTestContext()
	repo := &fakeSkillRepo{
		skills: map[string]*Skill{
			"file-skill": {Name: "file-skill", OrgID: "aisphere"},
		},
		versions: map[string][]*SkillVersion{
			"file-skill": {{SkillName: "file-skill", Version: "0.0.1", Status: SkillVersionStatusOnline}},
		},
		files: map[string][]*SkillFile{
			"file-skill@0.0.1": {
				{SkillName: "file-skill", Version: "0.0.1", Path: "SKILL.md", Name: "SKILL.md", Type: "markdown", Size: 31, Content: "# Skill\nbody"},
				{SkillName: "file-skill", Version: "0.0.1", Path: "prompts/main.md", Name: "main.md", Type: "prompts", Size: 13, Content: "prompt body"},
			},
		},
	}
	uc := NewSkillUsecase(repo, access.NewGuard(access.Options{}), &fakeSkillPermission{})

	files, err := uc.ListSkillVersionFiles(ctx, "file-skill", "0.0.1")
	if err != nil {
		t.Fatalf("ListSkillVersionFiles() error = %v", err)
	}
	if got, want := len(files), 2; got != want {
		t.Fatalf("ListSkillVersionFiles() len = %d, want %d", got, want)
	}
	if files[0].Path != "SKILL.md" || files[1].Path != "prompts/main.md" {
		t.Fatalf("ListSkillVersionFiles() = %#v, want sorted file paths", files)
	}

	got, err := uc.GetSkillVersionFile(ctx, "file-skill", "0.0.1", "SKILL.md")
	if err != nil {
		t.Fatalf("GetSkillVersionFile() error = %v", err)
	}
	if got.Content != "# Skill\nbody" || got.Binary {
		t.Fatalf("GetSkillVersionFile() = %#v, want markdown content", got)
	}
}

func TestSkillUsecaseCompareSkillVersions(t *testing.T) {
	ctx := skillTestContext()
	repo := &fakeSkillRepo{
		skills: map[string]*Skill{
			"compare-skill": {Name: "compare-skill", OrgID: "aisphere"},
		},
		versions: map[string][]*SkillVersion{
			"compare-skill": {
				{SkillName: "compare-skill", Version: "0.1.0", Status: SkillVersionStatusPublished},
				{SkillName: "compare-skill", Version: "0.2.0", Status: SkillVersionStatusOnline},
			},
		},
		files: map[string][]*SkillFile{
			"compare-skill@0.1.0": {
				{SkillName: "compare-skill", Version: "0.1.0", Path: "prompts/main.md", Name: "main.md", Content: "old prompt"},
				{SkillName: "compare-skill", Version: "0.1.0", Path: "SKILL.md", Name: "SKILL.md", Content: "# Skill\nold"},
			},
			"compare-skill@0.2.0": {
				{SkillName: "compare-skill", Version: "0.2.0", Path: "SKILL.md", Name: "SKILL.md", Content: "# Skill\nnew"},
				{SkillName: "compare-skill", Version: "0.2.0", Path: "references/ref.md", Name: "ref.md", Content: "new ref"},
			},
		},
	}
	uc := NewSkillUsecase(repo, access.NewGuard(access.Options{}), &fakeSkillPermission{})

	got, err := uc.CompareSkillVersions(ctx, "compare-skill", "0.1.0", "0.2.0")
	if err != nil {
		t.Fatalf("CompareSkillVersions() error = %v", err)
	}
	if got.BaseSkillMD != "# Skill\nold" || got.TargetSkillMD != "# Skill\nnew" {
		t.Fatalf("CompareSkillVersions() markdown = %#v, want old/new SKILL.md", got)
	}
	if got.BaseFiles[0].Path != "SKILL.md" || got.BaseFiles[1].Path != "prompts/main.md" {
		t.Fatalf("base files = %#v, want sorted file paths", got.BaseFiles)
	}
	if got.TargetFiles[0].Path != "SKILL.md" || got.TargetFiles[1].Path != "references/ref.md" {
		t.Fatalf("target files = %#v, want sorted file paths", got.TargetFiles)
	}
}

func TestSkillUsecaseUploadSkillPackageCreatesSkillVersionAndFiles(t *testing.T) {
	ctx := skillTestContext()
	repo := &fakeSkillRepo{
		skills:   map[string]*Skill{},
		versions: map[string][]*SkillVersion{},
		files:    map[string][]*SkillFile{},
	}
	perm := &fakeSkillPermission{}
	uc := NewSkillUsecase(repo, access.NewGuard(access.Options{}), perm)

	out, err := uc.UploadSkillPackage(ctx, SkillPackageUpload{
		PackageBytes: testSkillZip(t, map[string]string{
			"demo-skill/SKILL.md":          "---\nname: demo-skill\ndescription: Demo skill\nversion: 0.1.0\n---\nUse this skill.",
			"demo-skill/prompts/main.md":   "Prompt body",
			"demo-skill/references/ref.md": "Reference body",
		}),
		CommitMsg: "initial import",
	})
	if err != nil {
		t.Fatalf("UploadSkillPackage() error = %v", err)
	}

	if out.SkillName != "demo-skill" || out.Version != "0.1.0" {
		t.Fatalf("UploadSkillPackage() = %#v, want demo-skill@0.1.0", out)
	}
	if repo.skills["demo-skill"] == nil {
		t.Fatal("UploadSkillPackage() did not create canonical skill")
	}
	if got := len(repo.versions["demo-skill"]); got != 1 {
		t.Fatalf("version count = %d, want 1", got)
	}
	files := repo.files["demo-skill@0.1.0"]
	if got, want := len(files), 3; got != want {
		t.Fatalf("file count = %d, want %d: %#v", got, want, files)
	}
	if files[0].Path != "SKILL.md" || files[1].Path != "prompts/main.md" || files[2].Path != "references/ref.md" {
		t.Fatalf("files = %#v, want sorted canonical paths", files)
	}
	if got := len(perm.grantedRoles); got != 1 {
		t.Fatalf("owner grant count = %d, want 1: %#v", got, perm.grantedRoles)
	}
	grant := perm.grantedRoles[0]
	if grant.Subject != "aisphere/admin" || grant.Resource.String() != "aihub:skill:demo-skill" || grant.Role != permission.RoleOwner {
		t.Fatalf("owner grant = %#v, want creator owner on demo-skill", grant)
	}
}

func TestSkillUsecaseCreateSkillGrantsCreatorOwner(t *testing.T) {
	ctx := skillTestContext()
	repo := &fakeSkillRepo{skills: map[string]*Skill{}}
	perm := &fakeSkillPermission{}
	uc := NewSkillUsecase(repo, access.NewGuard(access.Options{}), perm)

	out, err := uc.CreateSkill(ctx, &Skill{Name: "new-skill", DisplayName: "New Skill"})
	if err != nil {
		t.Fatalf("CreateSkill() error = %v", err)
	}
	if out.Name != "new-skill" || repo.skills["new-skill"] == nil {
		t.Fatalf("CreateSkill() = %#v, skill not persisted", out)
	}
	if got := len(perm.grantedRoles); got != 1 {
		t.Fatalf("owner grant count = %d, want 1: %#v", got, perm.grantedRoles)
	}
	grant := perm.grantedRoles[0]
	if grant.Subject != "aisphere/admin" || grant.Resource.String() != "aihub:skill:new-skill" || grant.Role != permission.RoleOwner {
		t.Fatalf("owner grant = %#v, want creator owner on new-skill", grant)
	}
}

func TestSkillUsecaseCatalogOnlyReturnsOnlineSkills(t *testing.T) {
	ctx := skillTestContext()
	repo := &fakeSkillRepo{
		skills: map[string]*Skill{
			"draft-skill":  {Name: "draft-skill"},
			"online-skill": {Name: "online-skill"},
			"orphan-skill": {Name: "orphan-skill"},
		},
		versions: map[string][]*SkillVersion{
			"draft-skill":  {{SkillName: "draft-skill", Version: "0.1.0", Status: SkillVersionStatusPublished}},
			"online-skill": {{SkillName: "online-skill", Version: "0.1.0", Status: SkillVersionStatusOnline}},
		},
	}
	uc := NewSkillUsecase(repo, access.NewGuard(access.Options{}), &fakeSkillPermission{})

	list, err := uc.ListCatalogSkills(ctx, SkillListOptions{})
	if err != nil {
		t.Fatalf("ListCatalogSkills() error = %v", err)
	}
	if len(list.Items) != 1 || list.Items[0].Name != "online-skill" {
		t.Fatalf("ListCatalogSkills() = %#v, want only online-skill", list.Items)
	}
	if _, err := uc.GetCatalogSkill(ctx, "draft-skill"); err == nil {
		t.Fatal("GetCatalogSkill(draft-skill) error = nil, want non-online rejected")
	}
}

func TestSkillUsecaseUploadSkillPackageRejectsDuplicateWithoutOverwrite(t *testing.T) {
	ctx := skillTestContext()
	repo := &fakeSkillRepo{
		skills: map[string]*Skill{"demo-skill": {Name: "demo-skill"}},
		versions: map[string][]*SkillVersion{
			"demo-skill": {{SkillName: "demo-skill", Version: "0.1.0"}},
		},
		files: map[string][]*SkillFile{},
	}
	uc := NewSkillUsecase(repo, access.NewGuard(access.Options{}), &fakeSkillPermission{})

	_, err := uc.UploadSkillPackage(ctx, SkillPackageUpload{
		PackageBytes: testSkillZip(t, map[string]string{
			"demo-skill/SKILL.md": "---\nname: demo-skill\ndescription: Demo skill\nversion: 0.1.0\n---\nUse this skill.",
		}),
	})
	if err == nil {
		t.Fatal("UploadSkillPackage() error = nil, want duplicate rejection")
	}
}

func TestSkillUsecaseSubmitPublishOnlineOfflineFlow(t *testing.T) {
	ctx := skillTestContext()
	repo := &fakeSkillRepo{
		skills: map[string]*Skill{"demo-skill": {Name: "demo-skill", Status: SkillStatusActive}},
		versions: map[string][]*SkillVersion{
			"demo-skill": {{SkillName: "demo-skill", Version: "0.1.0", Status: SkillVersionStatusDraft}},
		},
		files: map[string][]*SkillFile{},
	}
	uc := NewSkillUsecase(repo, access.NewGuard(access.Options{}), &fakeSkillPermission{})

	if got, err := uc.SubmitSkillVersion(ctx, "demo-skill", "0.1.0"); err != nil || got.Status != SkillVersionStatusSubmitted {
		t.Fatalf("SubmitSkillVersion() = %#v, %v; want submitted", got, err)
	}
	if got, err := uc.PublishSkillVersion(ctx, "demo-skill", "0.1.0", false); err != nil || got.Status != SkillVersionStatusPublished {
		t.Fatalf("PublishSkillVersion() = %#v, %v; want published", got, err)
	}
	if got, err := uc.OnlineSkillVersion(ctx, "demo-skill", "0.1.0"); err != nil || got.Status != SkillVersionStatusOnline {
		t.Fatalf("OnlineSkillVersion() = %#v, %v; want online", got, err)
	}
	if repo.skills["demo-skill"].Version != "0.1.0" {
		t.Fatalf("online skill version = %q, want 0.1.0", repo.skills["demo-skill"].Version)
	}
	if got, err := uc.OfflineSkillVersion(ctx, "demo-skill", "0.1.0"); err != nil || got.Status != SkillVersionStatusOffline {
		t.Fatalf("OfflineSkillVersion() = %#v, %v; want offline", got, err)
	}
}

func TestSkillUsecaseDownloadAndManifestUseETag(t *testing.T) {
	ctx := skillTestContext()
	repo := &fakeSkillRepo{
		skills: map[string]*Skill{"demo-skill": {Name: "demo-skill", Version: "0.1.0", Status: SkillStatusActive}},
		versions: map[string][]*SkillVersion{
			"demo-skill": {{SkillName: "demo-skill", Version: "0.1.0", Status: SkillVersionStatusOnline, MD5: "md5", SHA256: "sha", Revision: "rev"}},
		},
		files: map[string][]*SkillFile{
			"demo-skill@0.1.0": {{Path: "SKILL.md"}, {Path: "prompts/main.md"}},
		},
		packages: map[string][]byte{"demo-skill@0.1.0": []byte("zip")},
	}
	uc := NewSkillUsecase(repo, access.NewGuard(access.Options{}), &fakeSkillPermission{})

	download, err := uc.DownloadSkillVersion(ctx, "demo-skill", "0.1.0", "")
	if err != nil {
		t.Fatalf("DownloadSkillVersion() error = %v", err)
	}
	if string(download.PackageBytes) != "zip" || download.ETag == "" || download.NotModified {
		t.Fatalf("DownloadSkillVersion() = %#v, want zip with etag", download)
	}
	cached, err := uc.DownloadSkillVersion(ctx, "demo-skill", "0.1.0", download.ETag)
	if err != nil {
		t.Fatalf("DownloadSkillVersion(if-none-match) error = %v", err)
	}
	if !cached.NotModified || len(cached.PackageBytes) != 0 {
		t.Fatalf("cached download = %#v, want not modified without body", cached)
	}

	manifest, err := uc.GetCatalogSkillManifest(ctx, "demo-skill", "")
	if err != nil {
		t.Fatalf("GetCatalogSkillManifest() error = %v", err)
	}
	if manifest.Version != "0.1.0" || len(manifest.Files) != 2 || manifest.ETag == "" {
		t.Fatalf("manifest = %#v, want online version file manifest", manifest)
	}
	cachedManifest, err := uc.GetCatalogSkillManifest(ctx, "demo-skill", manifest.ETag)
	if err != nil {
		t.Fatalf("GetCatalogSkillManifest(if-none-match) error = %v", err)
	}
	if !cachedManifest.NotModified || len(cachedManifest.Files) != 0 {
		t.Fatalf("cached manifest = %#v, want not modified", cachedManifest)
	}
}

func TestSkillUsecaseCatalogDownloadRequiresOnlineVersion(t *testing.T) {
	ctx := skillTestContext()
	repo := &fakeSkillRepo{
		skills: map[string]*Skill{"demo-skill": {Name: "demo-skill"}},
		versions: map[string][]*SkillVersion{
			"demo-skill": {{SkillName: "demo-skill", Version: "0.1.0", Status: SkillVersionStatusPublished, SHA256: "sha"}},
		},
		packages: map[string][]byte{"demo-skill@0.1.0": []byte("zip")},
	}
	uc := NewSkillUsecase(repo, access.NewGuard(access.Options{}), &fakeSkillPermission{})

	if _, err := uc.DownloadCatalogSkillVersion(ctx, "demo-skill", "0.1.0", ""); err == nil {
		t.Fatal("DownloadCatalogSkillVersion() error = nil, want non-online version rejected")
	}
	repo.versions["demo-skill"][0].Status = SkillVersionStatusOnline
	got, err := uc.DownloadCatalogSkillVersion(ctx, "demo-skill", "0.1.0", "")
	if err != nil {
		t.Fatalf("DownloadCatalogSkillVersion() error = %v", err)
	}
	if string(got.PackageBytes) != "zip" {
		t.Fatalf("DownloadCatalogSkillVersion() = %#v, want package bytes", got)
	}
}

func skillTestContext() context.Context {
	return principal.NewContext(context.Background(), &principal.Principal{
		SubjectType: principal.SubjectUser,
		SubjectID:   "admin",
		OrgID:       "aisphere",
	})
}

func testSkillZip(t *testing.T, files map[string]string) []byte {
	t.Helper()
	buf := bytes.NewBuffer(nil)
	zw := zip.NewWriter(buf)
	for name, content := range files {
		w, err := zw.Create(name)
		if err != nil {
			t.Fatal(err)
		}
		if _, err := w.Write([]byte(content)); err != nil {
			t.Fatal(err)
		}
	}
	if err := zw.Close(); err != nil {
		t.Fatal(err)
	}
	return buf.Bytes()
}

type fakeSkillRepo struct {
	skills   map[string]*Skill
	versions map[string][]*SkillVersion
	files    map[string][]*SkillFile
	packages map[string][]byte
}

func (r *fakeSkillRepo) CreateSkill(_ context.Context, skill *Skill) (*Skill, error) {
	if r.skills == nil {
		r.skills = map[string]*Skill{}
	}
	if _, ok := r.skills[skill.Name]; ok {
		return nil, ErrSkillAlreadyExists
	}
	out := cloneSkill(skill)
	r.skills[out.Name] = out
	return out, nil
}

func (r *fakeSkillRepo) UpdateSkill(context.Context, *Skill) (*Skill, error) {
	panic("not used")
}

func (r *fakeSkillRepo) ListSkills(_ context.Context, opts SkillListOptions) (*SkillListResult, error) {
	return r.listSkills(nil, opts), nil
}

func (r *fakeSkillRepo) ListSkillsByNames(_ context.Context, names []string, opts SkillListOptions) (*SkillListResult, error) {
	return r.listSkills(names, opts), nil
}

func (r *fakeSkillRepo) GetSkill(_ context.Context, name string) (*Skill, error) {
	if r != nil && r.skills != nil {
		if skill := r.skills[name]; skill != nil {
			return skill, nil
		}
	}
	return nil, ErrSkillNotFound
}

func (r *fakeSkillRepo) DeleteSkill(context.Context, string) error {
	panic("not used")
}

func (r *fakeSkillRepo) SaveSkillPackage(_ context.Context, skill *Skill, version *SkillVersion, files []*SkillFile, _ []byte, overwrite bool) (*SkillVersion, error) {
	if r.skills == nil {
		r.skills = map[string]*Skill{}
	}
	if r.versions == nil {
		r.versions = map[string][]*SkillVersion{}
	}
	if r.files == nil {
		r.files = map[string][]*SkillFile{}
	}
	for _, existing := range r.versions[skill.Name] {
		if existing.Version == version.Version && !overwrite {
			return nil, ErrSkillVersionAlreadyExists
		}
	}
	r.skills[skill.Name] = skill
	replaced := false
	for i, existing := range r.versions[skill.Name] {
		if existing.Version == version.Version {
			r.versions[skill.Name][i] = version
			replaced = true
			break
		}
	}
	if !replaced {
		r.versions[skill.Name] = append(r.versions[skill.Name], version)
	}
	r.files[skill.Name+"@"+version.Version] = append([]*SkillFile(nil), files...)
	return version, nil
}

func (r *fakeSkillRepo) ListSkillVersions(_ context.Context, name string) ([]*SkillVersion, error) {
	return append([]*SkillVersion(nil), r.versions[name]...), nil
}

func (r *fakeSkillRepo) GetSkillVersion(_ context.Context, name, version string) (*SkillVersion, error) {
	for _, item := range r.versions[name] {
		if item.Version == version {
			return item, nil
		}
	}
	return nil, ErrSkillVersionNotFound
}

func (r *fakeSkillRepo) ListSkillVersionFiles(_ context.Context, name, version string) ([]*SkillFile, error) {
	return append([]*SkillFile(nil), r.files[name+"@"+version]...), nil
}

func (r *fakeSkillRepo) GetSkillVersionFile(_ context.Context, name, version, filePath string) (*SkillFile, error) {
	for _, item := range r.files[name+"@"+version] {
		if item.Path == filePath {
			return item, nil
		}
	}
	return nil, ErrSkillFileNotFound
}

func (r *fakeSkillRepo) UpdateSkillVersionStatus(_ context.Context, name, version, status string) (*SkillVersion, error) {
	for _, item := range r.versions[name] {
		if item.Version == version {
			item.Status = status
			if status == SkillVersionStatusOnline {
				r.skills[name].Version = version
			}
			return item, nil
		}
	}
	return nil, ErrSkillVersionNotFound
}

func (r *fakeSkillRepo) GetOnlineSkillVersion(_ context.Context, name string) (*SkillVersion, error) {
	for _, item := range r.versions[name] {
		if item.Status == SkillVersionStatusOnline {
			return item, nil
		}
	}
	return nil, ErrSkillVersionNotFound
}

func (r *fakeSkillRepo) DownloadSkillPackage(_ context.Context, name, version string) ([]byte, error) {
	if b := r.packages[name+"@"+version]; b != nil {
		return b, nil
	}
	return nil, ErrSkillFileNotFound
}

func (r *fakeSkillRepo) listSkills(names []string, opts SkillListOptions) *SkillListResult {
	filterNames := names != nil
	allowed := map[string]struct{}{}
	for _, name := range names {
		allowed[name] = struct{}{}
	}
	if filterNames && len(allowed) == 0 {
		return &SkillListResult{Items: []*Skill{}, NextOffset: opts.Offset, HasMore: false}
	}
	items := make([]*Skill, 0, len(r.skills))
	query := strings.TrimSpace(opts.Query)
	for name, skill := range r.skills {
		if filterNames {
			if _, ok := allowed[name]; !ok {
				continue
			}
		}
		if query != "" && !strings.Contains(skill.Name, query) && !strings.Contains(skill.DisplayName, query) && !strings.Contains(skill.Description, query) {
			continue
		}
		if opts.Status != "" && skill.Status != opts.Status {
			continue
		}
		if opts.Visibility != "" && skill.Visibility != opts.Visibility {
			continue
		}
		if opts.OnlyOnline && !r.hasOnlineVersion(name) {
			continue
		}
		items = append(items, cloneSkill(skill))
	}
	sort.Slice(items, func(i, j int) bool { return items[i].Name < items[j].Name })
	limit := opts.Limit
	if limit <= 0 {
		limit = 20
	}
	if opts.Offset >= len(items) {
		return &SkillListResult{Items: []*Skill{}, NextOffset: opts.Offset, HasMore: false}
	}
	end := opts.Offset + limit
	hasMore := false
	if end < len(items) {
		hasMore = true
	} else {
		end = len(items)
	}
	out := items[opts.Offset:end]
	return &SkillListResult{Items: out, NextOffset: opts.Offset + len(out), HasMore: hasMore}
}

func (r *fakeSkillRepo) hasOnlineVersion(name string) bool {
	for _, item := range r.versions[name] {
		if item.Status == SkillVersionStatusOnline {
			return true
		}
	}
	return false
}

type fakeSkillPermission struct {
	grants       []permission.Grant
	grantedRoles []permission.Grant
	revoked      []permission.Grant
}

func (p *fakeSkillPermission) Grant(context.Context, permission.Grant) error {
	panic("not used")
}

func (p *fakeSkillPermission) GrantRole(_ context.Context, grant permission.Grant) error {
	p.grantedRoles = append(p.grantedRoles, grant)
	return nil
}

func (p *fakeSkillPermission) Share(context.Context, permission.ShareRequest) error {
	panic("not used")
}

func (p *fakeSkillPermission) Revoke(_ context.Context, grant permission.Grant) error {
	p.revoked = append(p.revoked, grant)
	return nil
}

func (p *fakeSkillPermission) Check(context.Context, permission.CheckRequest) (bool, error) {
	panic("not used")
}

func (p *fakeSkillPermission) List(_ context.Context, filter permission.ListFilter) ([]permission.Grant, error) {
	out := make([]permission.Grant, 0, len(p.grants))
	for _, g := range p.grants {
		if filter.Subject != "" && g.Subject != filter.Subject {
			continue
		}
		if filter.Resource.String() != "" && g.Resource != filter.Resource {
			continue
		}
		if filter.Action != "" && g.Action != filter.Action {
			continue
		}
		out = append(out, g)
	}
	return out, nil
}

func (p *fakeSkillPermission) DeleteResourcePolicies(context.Context, resource.Name) error {
	panic("not used")
}

func (p *fakeSkillPermission) DeleteResourcePoliciesEx(context.Context, permission.DeleteResourceRequest) error {
	panic("not used")
}

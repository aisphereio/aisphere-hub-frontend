package biz

import (
	"context"
	"crypto/md5"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"time"

	"aisphere-hub/internal/skillzip"

	"github.com/actionlab-ai/aisphere-kit/access"
	"github.com/actionlab-ai/aisphere-kit/permission"
	"github.com/actionlab-ai/aisphere-kit/principal"
	"github.com/actionlab-ai/aisphere-kit/resource"
	"github.com/go-kratos/kratos/v3/errors"
)

const (
	SkillStatusActive   = "active"
	SkillStatusArchived = "archived"

	SkillVisibilityPrivate = "private"
	SkillVisibilityPublic  = "public"

	SkillResourceListPrefix = "aihub:skill:*"
	SkillResourcePrefix     = "aihub:skill:"

	SkillActionList         = "skill.list"
	SkillActionRead         = "skill.read"
	SkillActionCreate       = "skill.create"
	SkillActionUpdate       = "skill.update"
	SkillActionDelete       = "skill.delete"
	SkillActionUpload       = "skill.upload"
	SkillActionSubmit       = "skill.submit"
	SkillActionPublish      = "skill.publish"
	SkillActionForcePublish = "skill.force_publish"
	SkillActionOnline       = "skill.online"
	SkillActionOffline      = "skill.offline"
	SkillActionDownload     = "skill.download"
	SkillActionShareList    = "skill.share.list"
	SkillActionShareCreate  = "skill.share.create"
	SkillActionShareDelete  = "skill.share.delete"
	SkillActionCatalogRead  = "skill.catalog.read"
	SkillActionConsume      = "skill.consume"
	SkillActionVersionList  = "skill.version.list"
	SkillActionVersionRead  = "skill.version.read"
	SkillActionFileList     = "skill.file.list"
	SkillActionFileRead     = "skill.file.read"
	SkillActionCompare      = "skill.compare"
	SkillActionManifestRead = "skill.manifest.read"

	SkillVersionStatusDraft     = "draft"
	SkillVersionStatusSubmitted = "submitted"
	SkillVersionStatusPublished = "published"
	SkillVersionStatusOnline    = "online"
	SkillVersionStatusOffline   = "offline"
)

var (
	ErrSkillNotFound             = errors.NotFound("SKILL_NOT_FOUND", "skill not found")
	ErrSkillAlreadyExists        = errors.Conflict("SKILL_ALREADY_EXISTS", "skill already exists")
	ErrSkillShareNotFound        = errors.NotFound("SKILL_SHARE_NOT_FOUND", "skill share not found")
	ErrSkillVersionNotFound      = errors.NotFound("SKILL_VERSION_NOT_FOUND", "skill version not found")
	ErrSkillVersionAlreadyExists = errors.Conflict("SKILL_VERSION_ALREADY_EXISTS", "skill version already exists")
	ErrSkillFileNotFound         = errors.NotFound("SKILL_FILE_NOT_FOUND", "skill file not found")
	ErrSkillInvalidArgument      = errors.BadRequest("SKILL_INVALID_ARGUMENT", "invalid skill argument")
	ErrSkillPackageInvalid       = errors.BadRequest("SKILL_PACKAGE_INVALID", "invalid skill package")
	ErrSkillPermissionSetup      = errors.InternalServer("SKILL_PERMISSION_SETUP_ERROR", "skill permission manager is not configured")

	skillNameRE = regexp.MustCompile(`^[A-Za-z0-9][A-Za-z0-9_.-]{0,127}$`)
)

type Skill struct {
	ID           int64
	Name         string
	DisplayName  string
	Description  string
	Version      string
	Status       string
	Visibility   string
	OwnerID      string
	OrgID        string
	ProjectID    string
	SourceType   string
	SourceURI    string
	ManifestJSON string
	Tags         []string
	CreateTime   time.Time
	UpdateTime   time.Time
}

type SkillShare struct {
	GrantID      string
	Resource     string
	Subject      string
	SubjectType  string
	SubjectID    string
	Role         string
	Actions      []string
	CreatedBy    string
	MetadataJSON string
}

type SkillVersion struct {
	ID                  int64
	SkillName           string
	Version             string
	Status              string
	Author              string
	CommitMsg           string
	PublishPipelineInfo string
	DownloadCount       int64
	MD5                 string
	SHA256              string
	Revision            string
	SizeBytes           int64
	ManifestJSON        string
	CreateTime          time.Time
	UpdateTime          time.Time
}

type SkillFile struct {
	ID         int64
	SkillName  string
	Version    string
	Path       string
	Name       string
	Type       string
	Size       int64
	Binary     bool
	Content    string
	CreateTime time.Time
	UpdateTime time.Time
}

type SkillPackageDownload struct {
	SkillName    string
	Version      string
	ETag         string
	MD5          string
	SHA256       string
	NotModified  bool
	PackageBytes []byte
}

type SkillManifest struct {
	SkillName    string
	Version      string
	Status       string
	ETag         string
	MD5          string
	SHA256       string
	Revision     string
	ManifestJSON string
	Files        []*SkillFile
	NotModified  bool
}

type SkillVersionCompare struct {
	BaseVersion   string
	TargetVersion string
	BaseSkillMD   string
	TargetSkillMD string
	BaseFiles     []*SkillFile
	TargetFiles   []*SkillFile
}

type SkillShareInput struct {
	Name         string
	SubjectType  string
	SubjectID    string
	OrgID        string
	ProjectID    string
	Role         string
	Actions      []string
	MetadataJSON string
}

type SkillPackageUpload struct {
	PackageBytes  []byte
	Overwrite     bool
	TargetVersion string
	CommitMsg     string
}

type SkillListOptions struct {
	Limit      int
	Offset     int
	Query      string
	Status     string
	Visibility string
	OnlyOnline bool
}

type SkillListResult struct {
	Items      []*Skill
	NextOffset int
	HasMore    bool
}

type SkillRepo interface {
	CreateSkill(ctx context.Context, skill *Skill) (*Skill, error)
	UpdateSkill(ctx context.Context, skill *Skill) (*Skill, error)
	ListSkills(ctx context.Context, opts SkillListOptions) (*SkillListResult, error)
	ListSkillsByNames(ctx context.Context, names []string, opts SkillListOptions) (*SkillListResult, error)
	GetSkill(ctx context.Context, name string) (*Skill, error)
	DeleteSkill(ctx context.Context, name string) error
	ListSkillVersions(ctx context.Context, name string) ([]*SkillVersion, error)
	GetSkillVersion(ctx context.Context, name, version string) (*SkillVersion, error)
	ListSkillVersionFiles(ctx context.Context, name, version string) ([]*SkillFile, error)
	GetSkillVersionFile(ctx context.Context, name, version, filePath string) (*SkillFile, error)
	SaveSkillPackage(ctx context.Context, skill *Skill, version *SkillVersion, files []*SkillFile, packageBytes []byte, overwrite bool) (*SkillVersion, error)
	UpdateSkillVersionStatus(ctx context.Context, name, version, status string) (*SkillVersion, error)
	GetOnlineSkillVersion(ctx context.Context, name string) (*SkillVersion, error)
	DownloadSkillPackage(ctx context.Context, name, version string) ([]byte, error)
}

type SkillUsecase struct {
	repo       SkillRepo
	access     *access.Guard
	permission permission.Manager
}

func NewSkillUsecase(repo SkillRepo, guard *access.Guard, perm permission.Manager) *SkillUsecase {
	return &SkillUsecase{repo: repo, access: guard, permission: perm}
}

func (uc *SkillUsecase) CreateSkill(ctx context.Context, in *Skill) (*Skill, error) {
	principal, err := uc.require(ctx, SkillResourceListPrefix, SkillActionCreate)
	if err != nil {
		return nil, err
	}
	skill, err := normalizeSkillForCreate(in, principal)
	if err != nil {
		uc.record(ctx, SkillActionCreate, SkillResourceListPrefix, err, nil)
		return nil, err
	}
	out, err := uc.repo.CreateSkill(ctx, skill)
	res := SkillResource(outName(skill, out))
	if err == ErrSkillAlreadyExists {
		if existing, getErr := uc.repo.GetSkill(ctx, skill.Name); getErr == nil && skillOwnedByPrincipal(existing, principal) {
			res = SkillResource(existing.Name)
			err = uc.ensureSkillOwnerGrant(ctx, res, principal, SkillActionCreate)
			uc.record(ctx, SkillActionCreate, res, err, map[string]string{"name": skill.Name, "recovered_owner_grant": "true"})
			return existing, err
		}
	}
	if err == nil {
		err = uc.ensureSkillOwnerGrant(ctx, res, principal, SkillActionCreate)
	}
	uc.record(ctx, SkillActionCreate, res, err, map[string]string{"name": skill.Name})
	return out, err
}

func (uc *SkillUsecase) UpdateSkill(ctx context.Context, in *Skill) (*Skill, error) {
	skill, err := normalizeSkillForUpdate(in)
	if err != nil {
		return nil, err
	}
	resource := SkillResource(skill.Name)
	if _, err := uc.require(ctx, resource, SkillActionUpdate); err != nil {
		return nil, err
	}
	out, err := uc.repo.UpdateSkill(ctx, skill)
	uc.record(ctx, SkillActionUpdate, resource, err, map[string]string{"name": skill.Name})
	return out, err
}

func (uc *SkillUsecase) ListSkills(ctx context.Context, opts SkillListOptions) (*SkillListResult, error) {
	opts = normalizeSkillListOptions(opts)
	if opts.Offset < 0 {
		return nil, ErrSkillInvalidArgument
	}
	if _, err := uc.require(ctx, SkillResourceListPrefix, SkillActionList); err != nil {
		return nil, err
	}
	out, err := uc.repo.ListSkills(ctx, opts)
	uc.record(ctx, SkillActionList, SkillResourceListPrefix, err, map[string]string{
		"limit":      strconv.Itoa(opts.Limit),
		"offset":     strconv.Itoa(opts.Offset),
		"q":          opts.Query,
		"status":     opts.Status,
		"visibility": opts.Visibility,
	})
	return out, err
}

func (uc *SkillUsecase) GetSkill(ctx context.Context, name string) (*Skill, error) {
	name = normalizeSkillName(name)
	if !isValidSkillName(name) {
		return nil, ErrSkillInvalidArgument
	}
	resource := SkillResource(name)
	if _, err := uc.require(ctx, resource, SkillActionRead); err != nil {
		return nil, err
	}
	skill, err := uc.repo.GetSkill(ctx, name)
	uc.record(ctx, SkillActionRead, resource, err, nil)
	return skill, err
}

func (uc *SkillUsecase) DeleteSkill(ctx context.Context, name string) error {
	name = normalizeSkillName(name)
	if !isValidSkillName(name) {
		return ErrSkillInvalidArgument
	}
	resource := SkillResource(name)
	if _, err := uc.require(ctx, resource, SkillActionDelete); err != nil {
		return err
	}
	err := uc.repo.DeleteSkill(ctx, name)
	uc.record(ctx, SkillActionDelete, resource, err, nil)
	return err
}

func (uc *SkillUsecase) UploadSkillPackage(ctx context.Context, in SkillPackageUpload) (*SkillVersion, error) {
	p, err := uc.require(ctx, SkillResourceListPrefix, SkillActionUpload)
	if err != nil {
		return nil, err
	}
	parsed, err := skillzip.ParseSkillFromZip(in.PackageBytes)
	if err != nil {
		uc.record(ctx, SkillActionUpload, SkillResourceListPrefix, ErrSkillPackageInvalid, nil)
		return nil, ErrSkillPackageInvalid
	}
	name := normalizeSkillName(parsed.Name)
	versionName := normalizeSkillVersion(in.TargetVersion)
	if versionName == "" {
		versionName = normalizeSkillVersion(parsed.Version)
	}
	if !isValidSkillName(name) || versionName == "" {
		uc.record(ctx, SkillActionUpload, SkillResourceListPrefix, ErrSkillInvalidArgument, nil)
		return nil, ErrSkillInvalidArgument
	}

	manifest, err := skillManifestJSON(parsed)
	if err != nil {
		uc.record(ctx, SkillActionUpload, SkillResource(name), err, nil)
		return nil, err
	}
	md5sum := md5.Sum(in.PackageBytes)
	sha256sum := sha256.Sum256(in.PackageBytes)
	skill := &Skill{
		Name:         name,
		DisplayName:  name,
		Description:  strings.TrimSpace(parsed.Description),
		Version:      versionName,
		Status:       SkillStatusActive,
		Visibility:   SkillVisibilityPrivate,
		OwnerID:      p.SubjectID,
		OrgID:        p.OrgID,
		SourceType:   "package",
		ManifestJSON: manifest,
		Tags:         skillTagsFromMetadata(parsed.Metadata),
	}
	version := &SkillVersion{
		SkillName:    name,
		Version:      versionName,
		Status:       SkillVersionStatusDraft,
		Author:       p.SubjectID,
		CommitMsg:    strings.TrimSpace(in.CommitMsg),
		MD5:          hex.EncodeToString(md5sum[:]),
		SHA256:       hex.EncodeToString(sha256sum[:]),
		SizeBytes:    int64(len(in.PackageBytes)),
		ManifestJSON: manifest,
	}
	files := skillFilesFromPackage(name, versionName, parsed)
	out, err := uc.repo.SaveSkillPackage(ctx, skill, version, files, in.PackageBytes, in.Overwrite)
	res := SkillResource(name)
	if err == nil {
		err = uc.ensureSkillOwnerGrant(ctx, res, p, SkillActionUpload)
	}
	uc.record(ctx, SkillActionUpload, res, err, map[string]string{"name": name, "version": versionName})
	return out, err
}

func (uc *SkillUsecase) SubmitSkillVersion(ctx context.Context, name, version string) (*SkillVersion, error) {
	return uc.transitionSkillVersion(ctx, name, version, SkillActionSubmit, SkillVersionStatusSubmitted, false)
}

func (uc *SkillUsecase) PublishSkillVersion(ctx context.Context, name, version string, force bool) (*SkillVersion, error) {
	action := SkillActionPublish
	if force {
		action = SkillActionForcePublish
	}
	return uc.transitionSkillVersion(ctx, name, version, action, SkillVersionStatusPublished, force)
}

func (uc *SkillUsecase) OnlineSkillVersion(ctx context.Context, name, version string) (*SkillVersion, error) {
	return uc.transitionSkillVersion(ctx, name, version, SkillActionOnline, SkillVersionStatusOnline, false)
}

func (uc *SkillUsecase) OfflineSkillVersion(ctx context.Context, name, version string) (*SkillVersion, error) {
	return uc.transitionSkillVersion(ctx, name, version, SkillActionOffline, SkillVersionStatusOffline, false)
}

func (uc *SkillUsecase) DownloadSkillVersion(ctx context.Context, name, version, ifNoneMatch string) (*SkillPackageDownload, error) {
	name = normalizeSkillName(name)
	version = normalizeSkillVersion(version)
	if !isValidSkillName(name) || version == "" {
		return nil, ErrSkillInvalidArgument
	}
	res := SkillResource(name)
	if err := uc.requireAny(ctx, res, SkillActionDownload, SkillActionConsume, SkillActionRead); err != nil {
		return nil, err
	}
	meta, err := uc.repo.GetSkillVersion(ctx, name, version)
	if err != nil {
		return nil, err
	}
	etag := skillVersionETag(meta)
	out := &SkillPackageDownload{
		SkillName: name,
		Version:   version,
		ETag:      etag,
		MD5:       meta.MD5,
		SHA256:    meta.SHA256,
	}
	if etagMatches(ifNoneMatch, etag) {
		out.NotModified = true
		uc.record(ctx, SkillActionDownload, res, nil, map[string]string{"version": version, "not_modified": "true"})
		return out, nil
	}
	out.PackageBytes, err = uc.repo.DownloadSkillPackage(ctx, name, version)
	uc.record(ctx, SkillActionDownload, res, err, map[string]string{"version": version})
	if err != nil {
		return nil, err
	}
	return out, nil
}

func (uc *SkillUsecase) DownloadCatalogSkillVersion(ctx context.Context, name, version, ifNoneMatch string) (*SkillPackageDownload, error) {
	name = normalizeSkillName(name)
	version = normalizeSkillVersion(version)
	if !isValidSkillName(name) || version == "" {
		return nil, ErrSkillInvalidArgument
	}
	res := SkillResource(name)
	if err := uc.requireAny(ctx, res, SkillActionDownload, SkillActionConsume, SkillActionCatalogRead); err != nil {
		return nil, err
	}
	meta, err := uc.repo.GetSkillVersion(ctx, name, version)
	if err != nil {
		return nil, err
	}
	if meta.Status != SkillVersionStatusOnline {
		uc.record(ctx, SkillActionDownload, res, ErrSkillVersionNotFound, map[string]string{"version": version, "catalog": "true"})
		return nil, ErrSkillVersionNotFound
	}
	return uc.downloadSkillVersionPackage(ctx, res, meta, ifNoneMatch, true)
}

func (uc *SkillUsecase) GetCatalogSkillManifest(ctx context.Context, name, ifNoneMatch string) (*SkillManifest, error) {
	name = normalizeSkillName(name)
	if !isValidSkillName(name) {
		return nil, ErrSkillInvalidArgument
	}
	res := SkillResource(name)
	if err := uc.requireAny(ctx, res, SkillActionManifestRead, SkillActionCatalogRead, SkillActionConsume, SkillActionRead); err != nil {
		return nil, err
	}
	version, err := uc.repo.GetOnlineSkillVersion(ctx, name)
	if err != nil {
		return nil, err
	}
	etag := skillVersionETag(version)
	out := &SkillManifest{
		SkillName:    name,
		Version:      version.Version,
		Status:       version.Status,
		ETag:         etag,
		MD5:          version.MD5,
		SHA256:       version.SHA256,
		Revision:     version.Revision,
		ManifestJSON: version.ManifestJSON,
	}
	if etagMatches(ifNoneMatch, etag) {
		out.NotModified = true
		uc.record(ctx, SkillActionManifestRead, res, nil, map[string]string{"version": version.Version, "not_modified": "true"})
		return out, nil
	}
	out.Files, err = uc.repo.ListSkillVersionFiles(ctx, name, version.Version)
	if err == nil {
		sort.Slice(out.Files, func(i, j int) bool { return out.Files[i].Path < out.Files[j].Path })
	}
	uc.record(ctx, SkillActionManifestRead, res, err, map[string]string{"version": version.Version})
	return out, err
}

func (uc *SkillUsecase) ListSkillVersions(ctx context.Context, name string) ([]*SkillVersion, error) {
	name = normalizeSkillName(name)
	if !isValidSkillName(name) {
		return nil, ErrSkillInvalidArgument
	}
	res := SkillResource(name)
	if _, err := uc.require(ctx, res, SkillActionVersionList); err != nil {
		return nil, err
	}
	if _, err := uc.repo.GetSkill(ctx, name); err != nil {
		return nil, err
	}
	out, err := uc.repo.ListSkillVersions(ctx, name)
	if err == nil {
		sort.Slice(out, func(i, j int) bool { return out[i].Version < out[j].Version })
	}
	uc.record(ctx, SkillActionVersionList, res, err, map[string]string{"count": strconv.Itoa(len(out))})
	return out, err
}

func (uc *SkillUsecase) GetSkillVersion(ctx context.Context, name, version string) (*SkillVersion, error) {
	name = normalizeSkillName(name)
	version = normalizeSkillVersion(version)
	if !isValidSkillName(name) || version == "" {
		return nil, ErrSkillInvalidArgument
	}
	res := SkillResource(name)
	if _, err := uc.require(ctx, res, SkillActionVersionRead); err != nil {
		return nil, err
	}
	if _, err := uc.repo.GetSkill(ctx, name); err != nil {
		return nil, err
	}
	out, err := uc.repo.GetSkillVersion(ctx, name, version)
	uc.record(ctx, SkillActionVersionRead, res, err, map[string]string{"version": version})
	return out, err
}

func (uc *SkillUsecase) ListSkillVersionFiles(ctx context.Context, name, version string) ([]*SkillFile, error) {
	name = normalizeSkillName(name)
	version = normalizeSkillVersion(version)
	if !isValidSkillName(name) || version == "" {
		return nil, ErrSkillInvalidArgument
	}
	res := SkillResource(name)
	if _, err := uc.require(ctx, res, SkillActionFileList); err != nil {
		return nil, err
	}
	if _, err := uc.repo.GetSkillVersion(ctx, name, version); err != nil {
		return nil, err
	}
	out, err := uc.repo.ListSkillVersionFiles(ctx, name, version)
	if err == nil {
		sort.Slice(out, func(i, j int) bool { return out[i].Path < out[j].Path })
	}
	uc.record(ctx, SkillActionFileList, res, err, map[string]string{"version": version, "count": strconv.Itoa(len(out))})
	return out, err
}

func (uc *SkillUsecase) GetSkillVersionFile(ctx context.Context, name, version, filePath string) (*SkillFile, error) {
	name = normalizeSkillName(name)
	version = normalizeSkillVersion(version)
	filePath = normalizeSkillFilePath(filePath)
	if !isValidSkillName(name) || version == "" || filePath == "" {
		return nil, ErrSkillInvalidArgument
	}
	res := SkillResource(name)
	if _, err := uc.require(ctx, res, SkillActionFileRead); err != nil {
		return nil, err
	}
	if _, err := uc.repo.GetSkillVersion(ctx, name, version); err != nil {
		return nil, err
	}
	out, err := uc.repo.GetSkillVersionFile(ctx, name, version, filePath)
	uc.record(ctx, SkillActionFileRead, res, err, map[string]string{"version": version, "path": filePath})
	return out, err
}

func (uc *SkillUsecase) CompareSkillVersions(ctx context.Context, name, baseVersion, targetVersion string) (*SkillVersionCompare, error) {
	name = normalizeSkillName(name)
	baseVersion = normalizeSkillVersion(baseVersion)
	targetVersion = normalizeSkillVersion(targetVersion)
	if !isValidSkillName(name) || baseVersion == "" || targetVersion == "" || baseVersion == targetVersion {
		return nil, ErrSkillInvalidArgument
	}
	res := SkillResource(name)
	if err := uc.requireAny(ctx, res, SkillActionCompare, SkillActionFileRead, SkillActionVersionRead, SkillActionRead); err != nil {
		return nil, err
	}
	if _, err := uc.repo.GetSkill(ctx, name); err != nil {
		return nil, err
	}
	if _, err := uc.repo.GetSkillVersion(ctx, name, baseVersion); err != nil {
		return nil, err
	}
	if _, err := uc.repo.GetSkillVersion(ctx, name, targetVersion); err != nil {
		return nil, err
	}
	baseFiles, err := uc.repo.ListSkillVersionFiles(ctx, name, baseVersion)
	if err != nil {
		uc.record(ctx, SkillActionCompare, res, err, map[string]string{"base_version": baseVersion, "target_version": targetVersion})
		return nil, err
	}
	targetFiles, err := uc.repo.ListSkillVersionFiles(ctx, name, targetVersion)
	if err != nil {
		uc.record(ctx, SkillActionCompare, res, err, map[string]string{"base_version": baseVersion, "target_version": targetVersion})
		return nil, err
	}
	sort.Slice(baseFiles, func(i, j int) bool { return baseFiles[i].Path < baseFiles[j].Path })
	sort.Slice(targetFiles, func(i, j int) bool { return targetFiles[i].Path < targetFiles[j].Path })
	out := &SkillVersionCompare{
		BaseVersion:   baseVersion,
		TargetVersion: targetVersion,
		BaseFiles:     baseFiles,
		TargetFiles:   targetFiles,
	}
	baseMD, err := uc.repo.GetSkillVersionFile(ctx, name, baseVersion, "SKILL.md")
	if err != nil && !errors.Is(err, ErrSkillFileNotFound) {
		uc.record(ctx, SkillActionCompare, res, err, map[string]string{"base_version": baseVersion, "target_version": targetVersion, "path": "SKILL.md"})
		return nil, err
	}
	if baseMD != nil {
		out.BaseSkillMD = baseMD.Content
	}
	targetMD, err := uc.repo.GetSkillVersionFile(ctx, name, targetVersion, "SKILL.md")
	if err != nil && !errors.Is(err, ErrSkillFileNotFound) {
		uc.record(ctx, SkillActionCompare, res, err, map[string]string{"base_version": baseVersion, "target_version": targetVersion, "path": "SKILL.md"})
		return nil, err
	}
	if targetMD != nil {
		out.TargetSkillMD = targetMD.Content
	}
	uc.record(ctx, SkillActionCompare, res, nil, map[string]string{"base_version": baseVersion, "target_version": targetVersion})
	return out, nil
}

func (uc *SkillUsecase) ListSkillShares(ctx context.Context, name string) ([]*SkillShare, error) {
	name = normalizeSkillName(name)
	if !isValidSkillName(name) {
		return nil, ErrSkillInvalidArgument
	}
	res := SkillResource(name)
	if _, err := uc.require(ctx, res, SkillActionShareList); err != nil {
		return nil, err
	}
	if _, err := uc.repo.GetSkill(ctx, name); err != nil {
		return nil, err
	}
	grants, err := uc.listPolicies(ctx, res, "")
	if err != nil {
		uc.record(ctx, SkillActionShareList, res, err, nil)
		return nil, err
	}
	out := groupGrantsAsShares(res, grants)
	uc.record(ctx, SkillActionShareList, res, nil, map[string]string{"count": strconv.Itoa(len(out))})
	return out, nil
}

func (uc *SkillUsecase) downloadSkillVersionPackage(ctx context.Context, res string, meta *SkillVersion, ifNoneMatch string, catalog bool) (*SkillPackageDownload, error) {
	etag := skillVersionETag(meta)
	out := &SkillPackageDownload{
		SkillName: meta.SkillName,
		Version:   meta.Version,
		ETag:      etag,
		MD5:       meta.MD5,
		SHA256:    meta.SHA256,
	}
	if etagMatches(ifNoneMatch, etag) {
		out.NotModified = true
		uc.record(ctx, SkillActionDownload, res, nil, map[string]string{"version": meta.Version, "not_modified": "true", "catalog": strconv.FormatBool(catalog)})
		return out, nil
	}
	var err error
	out.PackageBytes, err = uc.repo.DownloadSkillPackage(ctx, meta.SkillName, meta.Version)
	uc.record(ctx, SkillActionDownload, res, err, map[string]string{"version": meta.Version, "catalog": strconv.FormatBool(catalog)})
	if err != nil {
		return nil, err
	}
	return out, nil
}

func (uc *SkillUsecase) CreateSkillShare(ctx context.Context, in SkillShareInput) (*SkillShare, error) {
	name := normalizeSkillName(in.Name)
	if !isValidSkillName(name) {
		return nil, ErrSkillInvalidArgument
	}
	res := SkillResource(name)
	actor, err := uc.require(ctx, res, SkillActionShareCreate)
	if err != nil {
		return nil, err
	}
	skill, err := uc.repo.GetSkill(ctx, name)
	if err != nil {
		return nil, err
	}
	share, err := normalizeSkillShareInput(in, skill, actor)
	if err != nil {
		return nil, err
	}
	if uc.permission == nil {
		return nil, ErrSkillPermissionSetup
	}
	metadata, err := decodeMetadataJSON(share.MetadataJSON)
	if err != nil {
		return nil, err
	}
	grantedBy := permission.PolicySubjectFromPrincipal(actor)
	req := permission.ShareRequest{
		Resource:    resource.Name(res),
		SubjectType: share.SubjectType,
		SubjectID:   share.SubjectID,
		OrgID:       share.OrgID,
		ProjectID:   share.ProjectID,
		Role:        share.Role,
		Actions:     share.Actions,
		GrantedBy:   grantedBy,
		Metadata:    metadata,
	}
	if err := uc.permission.Share(ctx, req); err != nil {
		uc.record(ctx, SkillActionShareCreate, res, err, map[string]string{"subject_type": share.SubjectType, "subject_id": share.SubjectID})
		return nil, err
	}
	actions, err := permission.RoleActionsForResource(resource.Name(res), share.Role, share.Actions)
	if err != nil {
		return nil, err
	}
	subject := permission.PolicySubject(share.SubjectType, share.SubjectID, share.OrgID)
	out := &SkillShare{
		GrantID:      encodeSkillGrantID(subject),
		Resource:     res,
		Subject:      subject,
		SubjectType:  share.SubjectType,
		SubjectID:    share.SubjectID,
		Role:         share.Role,
		Actions:      actions,
		CreatedBy:    grantedBy,
		MetadataJSON: share.MetadataJSON,
	}
	uc.record(ctx, SkillActionShareCreate, res, nil, map[string]string{"subject": subject})
	return out, nil
}

func (uc *SkillUsecase) DeleteSkillShare(ctx context.Context, name, grantID string) error {
	name = normalizeSkillName(name)
	if !isValidSkillName(name) || strings.TrimSpace(grantID) == "" {
		return ErrSkillInvalidArgument
	}
	res := SkillResource(name)
	if _, err := uc.require(ctx, res, SkillActionShareDelete); err != nil {
		return err
	}
	if _, err := uc.repo.GetSkill(ctx, name); err != nil {
		return err
	}
	subject, err := decodeSkillGrantID(grantID)
	if err != nil || subject == "" {
		return ErrSkillInvalidArgument
	}
	grants, err := uc.listPolicies(ctx, res, subject)
	if err != nil {
		return err
	}
	if len(grants) == 0 {
		return ErrSkillShareNotFound
	}
	for _, g := range grants {
		if err := uc.permission.Revoke(ctx, permission.Grant{Subject: g.Subject, Resource: g.Resource, Action: g.Action}); err != nil {
			uc.record(ctx, SkillActionShareDelete, res, err, map[string]string{"subject": subject})
			return err
		}
	}
	uc.record(ctx, SkillActionShareDelete, res, nil, map[string]string{"subject": subject, "actions": strconv.Itoa(len(grants))})
	return nil
}

func (uc *SkillUsecase) ListCatalogSkills(ctx context.Context, opts SkillListOptions) (*SkillListResult, error) {
	opts = normalizeSkillListOptions(opts)
	opts.OnlyOnline = true
	if opts.Offset < 0 {
		return nil, ErrSkillInvalidArgument
	}
	p, err := uc.requirePrincipal(ctx)
	if err != nil {
		return nil, err
	}
	if ok, err := uc.can(ctx, SkillResourceListPrefix, SkillActionCatalogRead); err == nil && ok {
		out, err := uc.repo.ListSkills(ctx, opts)
		uc.record(ctx, SkillActionCatalogRead, SkillResourceListPrefix, err, map[string]string{"mode": "global"})
		return out, err
	}
	if uc.permission == nil {
		return nil, ErrSkillPermissionSetup
	}
	names, err := uc.catalogSkillNamesForPrincipal(ctx, p)
	if err != nil {
		uc.record(ctx, SkillActionCatalogRead, SkillResourceListPrefix, err, map[string]string{"mode": "shared"})
		return nil, err
	}
	out, err := uc.repo.ListSkillsByNames(ctx, names, opts)
	uc.record(ctx, SkillActionCatalogRead, SkillResourceListPrefix, err, map[string]string{"mode": "shared", "count": strconv.Itoa(len(names))})
	return out, err
}

func (uc *SkillUsecase) GetCatalogSkill(ctx context.Context, name string) (*Skill, error) {
	name = normalizeSkillName(name)
	if !isValidSkillName(name) {
		return nil, ErrSkillInvalidArgument
	}
	res := SkillResource(name)
	if err := uc.requireAny(ctx, res, SkillActionCatalogRead, SkillActionConsume, SkillActionRead); err != nil {
		return nil, err
	}
	if _, err := uc.repo.GetOnlineSkillVersion(ctx, name); err != nil {
		uc.record(ctx, SkillActionCatalogRead, res, err, map[string]string{"catalog": "true", "online": "false"})
		return nil, err
	}
	skill, err := uc.repo.GetSkill(ctx, name)
	uc.record(ctx, SkillActionCatalogRead, res, err, map[string]string{"catalog": "true"})
	return skill, err
}

func SkillResource(name string) string {
	return SkillResourcePrefix + normalizeSkillName(name)
}

func normalizeSkillForCreate(in *Skill, p *principal.Principal) (*Skill, error) {
	if in == nil {
		return nil, ErrSkillInvalidArgument
	}
	out := cloneSkill(in)
	out.Name = normalizeSkillName(out.Name)
	if !isValidSkillName(out.Name) {
		return nil, ErrSkillInvalidArgument
	}
	if strings.TrimSpace(out.ManifestJSON) == "" {
		out.ManifestJSON = "{}"
	}
	if !json.Valid([]byte(out.ManifestJSON)) {
		return nil, ErrSkillInvalidArgument
	}
	out.DisplayName = strings.TrimSpace(out.DisplayName)
	out.Description = strings.TrimSpace(out.Description)
	out.Version = strings.TrimSpace(out.Version)
	out.Status = normalizeSkillStatus(out.Status)
	out.Visibility = normalizeSkillVisibility(out.Visibility)
	out.OwnerID = strings.TrimSpace(out.OwnerID)
	out.OrgID = strings.TrimSpace(out.OrgID)
	out.ProjectID = strings.TrimSpace(out.ProjectID)
	out.SourceType = strings.TrimSpace(out.SourceType)
	out.SourceURI = strings.TrimSpace(out.SourceURI)
	out.Tags = normalizeSkillTags(out.Tags)
	if out.OwnerID == "" && p != nil {
		out.OwnerID = p.SubjectID
	}
	if out.OrgID == "" && p != nil {
		out.OrgID = p.OrgID
	}
	return out, nil
}

func normalizeSkillForUpdate(in *Skill) (*Skill, error) {
	if in == nil {
		return nil, ErrSkillInvalidArgument
	}
	out := cloneSkill(in)
	out.Name = normalizeSkillName(out.Name)
	if !isValidSkillName(out.Name) {
		return nil, ErrSkillInvalidArgument
	}
	if strings.TrimSpace(out.ManifestJSON) == "" {
		out.ManifestJSON = "{}"
	}
	if !json.Valid([]byte(out.ManifestJSON)) {
		return nil, ErrSkillInvalidArgument
	}
	out.DisplayName = strings.TrimSpace(out.DisplayName)
	out.Description = strings.TrimSpace(out.Description)
	out.Version = strings.TrimSpace(out.Version)
	out.Status = normalizeSkillStatus(out.Status)
	out.Visibility = normalizeSkillVisibility(out.Visibility)
	out.OwnerID = strings.TrimSpace(out.OwnerID)
	out.OrgID = strings.TrimSpace(out.OrgID)
	out.ProjectID = strings.TrimSpace(out.ProjectID)
	out.SourceType = strings.TrimSpace(out.SourceType)
	out.SourceURI = strings.TrimSpace(out.SourceURI)
	out.Tags = normalizeSkillTags(out.Tags)
	return out, nil
}

func normalizeSkillShareInput(in SkillShareInput, skill *Skill, actor *principal.Principal) (SkillShareInput, error) {
	out := in
	out.Name = normalizeSkillName(out.Name)
	out.SubjectType = strings.TrimSpace(out.SubjectType)
	out.SubjectID = strings.TrimSpace(out.SubjectID)
	out.OrgID = strings.TrimSpace(out.OrgID)
	out.ProjectID = strings.TrimSpace(out.ProjectID)
	out.Role = strings.TrimSpace(out.Role)
	out.Actions = normalizeSkillTags(out.Actions)
	if out.SubjectType == "" {
		return out, ErrSkillInvalidArgument
	}
	if out.SubjectType != permission.SubjectPublic && out.SubjectID == "" {
		return out, ErrSkillInvalidArgument
	}
	if out.Role == "" && len(out.Actions) == 0 {
		out.Role = permission.RoleViewer
	}
	if out.SubjectType == permission.SubjectUser && out.OrgID == "" && !strings.Contains(out.SubjectID, "/") {
		if skill != nil && skill.OrgID != "" {
			out.OrgID = skill.OrgID
		} else if actor != nil {
			out.OrgID = actor.OrgID
		}
	}
	if strings.TrimSpace(out.MetadataJSON) == "" {
		out.MetadataJSON = "{}"
	}
	if !json.Valid([]byte(out.MetadataJSON)) {
		return out, ErrSkillInvalidArgument
	}
	return out, nil
}

func normalizeSkillListOptions(opts SkillListOptions) SkillListOptions {
	if opts.Limit <= 0 {
		opts.Limit = 20
	}
	if opts.Limit > 100 {
		opts.Limit = 100
	}
	return opts
}

func cloneSkill(in *Skill) *Skill {
	if in == nil {
		return nil
	}
	out := *in
	out.Tags = append([]string(nil), in.Tags...)
	return &out
}

func normalizeSkillName(name string) string {
	return strings.TrimSpace(name)
}

func normalizeSkillVersion(version string) string {
	return strings.TrimSpace(version)
}

func normalizeSkillFilePath(filePath string) string {
	filePath = strings.TrimSpace(strings.ReplaceAll(filePath, "\\", "/"))
	filePath = strings.TrimPrefix(filePath, "/")
	if filePath == "" || strings.Contains(filePath, "..") {
		return ""
	}
	return filePath
}

func isValidSkillName(name string) bool {
	return skillNameRE.MatchString(name)
}

func normalizeSkillStatus(status string) string {
	status = strings.TrimSpace(status)
	if status == "" {
		return SkillStatusActive
	}
	return status
}

func normalizeSkillVisibility(visibility string) string {
	visibility = strings.TrimSpace(visibility)
	if visibility == "" {
		return SkillVisibilityPrivate
	}
	return visibility
}

func normalizeSkillTags(tags []string) []string {
	seen := make(map[string]struct{}, len(tags))
	out := make([]string, 0, len(tags))
	for _, tag := range tags {
		tag = strings.TrimSpace(tag)
		if tag == "" {
			continue
		}
		if _, ok := seen[tag]; ok {
			continue
		}
		seen[tag] = struct{}{}
		out = append(out, tag)
	}
	return out
}

func (uc *SkillUsecase) transitionSkillVersion(ctx context.Context, name, version, action, targetStatus string, force bool) (*SkillVersion, error) {
	name = normalizeSkillName(name)
	version = normalizeSkillVersion(version)
	if !isValidSkillName(name) || version == "" {
		return nil, ErrSkillInvalidArgument
	}
	res := SkillResource(name)
	if _, err := uc.require(ctx, res, action); err != nil {
		return nil, err
	}
	current, err := uc.repo.GetSkillVersion(ctx, name, version)
	if err != nil {
		return nil, err
	}
	if !canTransitionSkillVersion(current.Status, targetStatus, force) {
		uc.record(ctx, action, res, ErrSkillInvalidArgument, map[string]string{"version": version, "from": current.Status, "to": targetStatus})
		return nil, ErrSkillInvalidArgument
	}
	out, err := uc.repo.UpdateSkillVersionStatus(ctx, name, version, targetStatus)
	uc.record(ctx, action, res, err, map[string]string{"version": version, "from": current.Status, "to": targetStatus})
	return out, err
}

func canTransitionSkillVersion(from, to string, force bool) bool {
	from = strings.TrimSpace(from)
	switch to {
	case SkillVersionStatusSubmitted:
		return from == SkillVersionStatusDraft
	case SkillVersionStatusPublished:
		if force {
			return from == SkillVersionStatusDraft || from == SkillVersionStatusSubmitted || from == SkillVersionStatusPublished || from == SkillVersionStatusOffline
		}
		return from == SkillVersionStatusSubmitted
	case SkillVersionStatusOnline:
		return from == SkillVersionStatusPublished
	case SkillVersionStatusOffline:
		return from == SkillVersionStatusOnline
	default:
		return false
	}
}

func skillVersionETag(version *SkillVersion) string {
	if version == nil {
		return ""
	}
	for _, value := range []string{version.SHA256, version.MD5, version.Revision} {
		value = strings.TrimSpace(value)
		if value != "" {
			return `"` + value + `"`
		}
	}
	if version.SkillName != "" && version.Version != "" {
		return `"` + version.SkillName + "@" + version.Version + `"`
	}
	return ""
}

func etagMatches(ifNoneMatch, etag string) bool {
	ifNoneMatch = strings.TrimSpace(ifNoneMatch)
	etag = strings.TrimSpace(etag)
	if ifNoneMatch == "" || etag == "" {
		return false
	}
	for _, part := range strings.Split(ifNoneMatch, ",") {
		part = strings.TrimSpace(part)
		if part == "*" || part == etag || strings.Trim(part, `"`) == strings.Trim(etag, `"`) {
			return true
		}
	}
	return false
}

func skillManifestJSON(parsed *skillzip.Skill) (string, error) {
	if parsed == nil {
		return "", ErrSkillPackageInvalid
	}
	manifest := map[string]any{
		"name":        parsed.Name,
		"description": parsed.Description,
		"version":     parsed.Version,
		"metadata":    parsed.Metadata,
	}
	b, err := json.Marshal(manifest)
	if err != nil {
		return "", err
	}
	return string(b), nil
}

func skillTagsFromMetadata(metadata map[string]string) []string {
	if len(metadata) == 0 {
		return nil
	}
	candidates := []string{}
	for _, key := range []string{"keywords", "groups", "skillSet"} {
		value := strings.TrimSpace(metadata[key])
		if value == "" {
			continue
		}
		for _, part := range strings.Split(value, ",") {
			candidates = append(candidates, strings.TrimSpace(part))
		}
	}
	return normalizeSkillTags(candidates)
}

func skillFilesFromPackage(name, version string, parsed *skillzip.Skill) []*SkillFile {
	if parsed == nil {
		return nil
	}
	files := []*SkillFile{{
		SkillName: name,
		Version:   version,
		Path:      skillzip.SkillMDFile,
		Name:      skillzip.SkillMDFile,
		Type:      "markdown",
		Size:      int64(len(parsed.SkillMD)),
		Content:   parsed.SkillMD,
	}}
	for _, res := range parsed.Resources {
		files = append(files, &SkillFile{
			SkillName: name,
			Version:   version,
			Path:      res.Path,
			Name:      res.Name,
			Type:      res.Type,
			Size:      res.Size,
			Binary:    res.Binary,
			Content:   res.Content,
		})
	}
	sort.Slice(files, func(i, j int) bool { return files[i].Path < files[j].Path })
	return files
}

func outName(in, out *Skill) string {
	if out != nil && out.Name != "" {
		return out.Name
	}
	if in != nil {
		return in.Name
	}
	return ""
}

func (uc *SkillUsecase) require(ctx context.Context, resource, action string) (*principal.Principal, error) {
	if uc == nil || uc.access == nil {
		return nil, fmt.Errorf("access guard is nil")
	}
	p, err := uc.access.Require(ctx, access.Check{Resource: resource, Action: action})
	if err != nil {
		return nil, normalizeAccessError(err)
	}
	return p, nil
}

func (uc *SkillUsecase) requireAny(ctx context.Context, resource string, actions ...string) error {
	var last error
	for _, action := range actions {
		ok, err := uc.can(ctx, resource, action)
		if err != nil {
			last = err
			continue
		}
		if ok {
			return nil
		}
	}
	if last != nil {
		return normalizeAccessError(last)
	}
	return errors.Forbidden("PERMISSION_DENIED", fmt.Sprintf("permission denied: cannot access %s", resource))
}

func (uc *SkillUsecase) can(ctx context.Context, resource, action string) (bool, error) {
	if uc == nil || uc.access == nil {
		return false, fmt.Errorf("access guard is nil")
	}
	return uc.access.Can(ctx, access.Check{Resource: resource, Action: action})
}

func (uc *SkillUsecase) requirePrincipal(ctx context.Context) (*principal.Principal, error) {
	if uc == nil || uc.access == nil {
		return nil, fmt.Errorf("access guard is nil")
	}
	p, err := uc.access.Principal(ctx)
	if err != nil {
		return nil, normalizeAccessError(err)
	}
	return p, nil
}

func (uc *SkillUsecase) listPolicies(ctx context.Context, res string, subject string) ([]permission.Grant, error) {
	if uc.permission == nil {
		return nil, ErrSkillPermissionSetup
	}
	return uc.permission.List(ctx, permission.ListFilter{Resource: resource.Name(res), Subject: subject})
}

func (uc *SkillUsecase) ensureSkillOwnerGrant(ctx context.Context, res string, p *principal.Principal, action string) error {
	if uc.permission == nil {
		return ErrSkillPermissionSetup
	}
	if p == nil {
		return ErrSkillInvalidArgument
	}
	subject := permission.PolicySubjectFromPrincipal(p)
	if strings.TrimSpace(subject) == "" {
		return ErrSkillInvalidArgument
	}
	subjectType := strings.TrimSpace(p.SubjectType)
	if subjectType == "" {
		subjectType = permission.SubjectUser
	}
	return uc.permission.GrantRole(ctx, permission.Grant{
		Subject:     subject,
		SubjectType: subjectType,
		SubjectID:   strings.TrimSpace(p.SubjectID),
		OrgID:       strings.TrimSpace(p.OrgID),
		ProjectID:   strings.TrimSpace(p.ProjectID),
		Resource:    resource.Name(res),
		Role:        permission.RoleOwner,
		GrantedBy:   subject,
		Metadata: map[string]any{
			"source": "skill_auto_owner",
			"action": action,
		},
	})
}

func skillOwnedByPrincipal(skill *Skill, p *principal.Principal) bool {
	if skill == nil || p == nil {
		return false
	}
	if strings.TrimSpace(skill.OwnerID) == "" || strings.TrimSpace(p.SubjectID) == "" {
		return false
	}
	if strings.TrimSpace(skill.OwnerID) != strings.TrimSpace(p.SubjectID) {
		return false
	}
	if strings.TrimSpace(skill.OrgID) != "" && strings.TrimSpace(p.OrgID) != "" && strings.TrimSpace(skill.OrgID) != strings.TrimSpace(p.OrgID) {
		return false
	}
	return true
}

func (uc *SkillUsecase) catalogSkillNamesForPrincipal(ctx context.Context, p *principal.Principal) ([]string, error) {
	subjects := []string{permission.PolicySubjectFromPrincipal(p), "public:*"}
	seen := map[string]struct{}{}
	for _, subject := range subjects {
		if strings.TrimSpace(subject) == "" {
			continue
		}
		grants, err := uc.permission.List(ctx, permission.ListFilter{Subject: subject})
		if err != nil {
			return nil, err
		}
		for _, g := range grants {
			if !isCatalogAction(g.Action) {
				continue
			}
			name := skillNameFromResource(g.Resource.String())
			if name == "" {
				continue
			}
			seen[name] = struct{}{}
		}
	}
	names := make([]string, 0, len(seen))
	for name := range seen {
		names = append(names, name)
	}
	sort.Strings(names)
	return names, nil
}

func isCatalogAction(action string) bool {
	switch action {
	case SkillActionCatalogRead, SkillActionConsume, SkillActionRead:
		return true
	default:
		return false
	}
}

func skillNameFromResource(res string) string {
	res = strings.TrimSpace(res)
	if !strings.HasPrefix(res, SkillResourcePrefix) {
		return ""
	}
	name := strings.TrimPrefix(res, SkillResourcePrefix)
	if name == "" || name == "*" || !isValidSkillName(name) {
		return ""
	}
	return name
}

func groupGrantsAsShares(res string, grants []permission.Grant) []*SkillShare {
	bySubject := map[string]*SkillShare{}
	for _, g := range grants {
		subject := strings.TrimSpace(g.Subject)
		if subject == "" {
			continue
		}
		share := bySubject[subject]
		if share == nil {
			subjectType, subjectID := splitPolicySubject(subject)
			share = &SkillShare{
				GrantID:     encodeSkillGrantID(subject),
				Resource:    res,
				Subject:     subject,
				SubjectType: subjectType,
				SubjectID:   subjectID,
				Actions:     []string{},
			}
			bySubject[subject] = share
		}
		if strings.TrimSpace(g.Action) != "" {
			share.Actions = append(share.Actions, g.Action)
		}
	}
	out := make([]*SkillShare, 0, len(bySubject))
	for _, share := range bySubject {
		share.Actions = normalizeSkillTags(share.Actions)
		sort.Strings(share.Actions)
		out = append(out, share)
	}
	sort.Slice(out, func(i, j int) bool { return out[i].Subject < out[j].Subject })
	return out
}

func splitPolicySubject(subject string) (string, string) {
	if strings.Contains(subject, "/") && !strings.Contains(subject, ":") {
		return permission.SubjectUser, subject
	}
	parts := strings.SplitN(subject, ":", 2)
	if len(parts) == 2 {
		return parts[0], parts[1]
	}
	return "", subject
}

func encodeSkillGrantID(subject string) string {
	return base64.RawURLEncoding.EncodeToString([]byte(subject))
}

func decodeSkillGrantID(grantID string) (string, error) {
	b, err := base64.RawURLEncoding.DecodeString(strings.TrimSpace(grantID))
	if err != nil {
		return "", err
	}
	return string(b), nil
}

func decodeMetadataJSON(s string) (map[string]any, error) {
	s = strings.TrimSpace(s)
	if s == "" || s == "{}" {
		return nil, nil
	}
	if !json.Valid([]byte(s)) {
		return nil, ErrSkillInvalidArgument
	}
	var out map[string]any
	if err := json.Unmarshal([]byte(s), &out); err != nil {
		return nil, ErrSkillInvalidArgument
	}
	return out, nil
}

func (uc *SkillUsecase) record(ctx context.Context, action, resource string, err error, metadata map[string]string) {
	if uc == nil || uc.access == nil {
		return
	}
	result := access.ResultSuccess
	message := ""
	if err != nil {
		result = access.ResultFailed
		message = err.Error()
	}
	_ = uc.access.Record(ctx, access.Event{
		Name:      fmt.Sprintf("%s:%s", action, resource),
		Action:    action,
		Resource:  resource,
		Result:    result,
		Message:   message,
		Component: "aisphere-hub",
		Metadata:  metadata,
	})
}

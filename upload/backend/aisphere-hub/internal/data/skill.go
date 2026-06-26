package data

import (
	"archive/zip"
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	stderrors "errors"
	"fmt"
	"io"
	"path"
	"strconv"
	"strings"
	"time"

	"aisphere-hub/internal/biz"

	"github.com/actionlab-ai/aisphere-kit/objectstore"
	"github.com/jackc/pgx/v5/pgconn"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

type skillRepo struct {
	data *Data
}

type skillModel struct {
	ID           int64          `gorm:"primaryKey;autoIncrement;column:id"`
	Name         string         `gorm:"column:name;size:128;uniqueIndex;not null"`
	DisplayName  string         `gorm:"column:display_name;size:256;not null;default:''"`
	Description  string         `gorm:"column:description;type:text;not null;default:''"`
	Version      string         `gorm:"column:version;size:64;not null;default:''"`
	Status       string         `gorm:"column:status;size:32;index;not null;default:'active'"`
	Visibility   string         `gorm:"column:visibility;size:32;not null;default:'private'"`
	OwnerID      string         `gorm:"column:owner_id;size:128;not null;default:''"`
	OrgID        string         `gorm:"column:org_id;size:128;index;not null;default:''"`
	ProjectID    string         `gorm:"column:project_id;size:128;not null;default:''"`
	SourceType   string         `gorm:"column:source_type;size:32;not null;default:''"`
	SourceURI    string         `gorm:"column:source_uri;type:text;not null;default:''"`
	ManifestJSON []byte         `gorm:"column:manifest_json;type:jsonb;not null;default:'{}'::jsonb"`
	TagsJSON     []byte         `gorm:"column:tags;type:jsonb;not null;default:'[]'::jsonb"`
	CreatedAt    time.Time      `gorm:"column:created_at;not null;autoCreateTime"`
	UpdatedAt    time.Time      `gorm:"column:updated_at;not null;autoUpdateTime"`
	DeletedAt    gorm.DeletedAt `gorm:"column:deleted_at;index"`
}

type skillVersionModel struct {
	ID                  int64          `gorm:"primaryKey;autoIncrement;column:id"`
	SkillName           string         `gorm:"column:skill_name;size:128;index;not null"`
	Version             string         `gorm:"column:version;size:64;not null"`
	Status              string         `gorm:"column:status;size:32;index;not null;default:'draft'"`
	Author              string         `gorm:"column:author;size:128;not null;default:''"`
	CommitMsg           string         `gorm:"column:commit_msg;type:text;not null;default:''"`
	PublishPipelineInfo string         `gorm:"column:publish_pipeline_info;type:text;not null;default:''"`
	DownloadCount       int64          `gorm:"column:download_count;not null;default:0"`
	MD5                 string         `gorm:"column:md5;size:64;not null;default:''"`
	SHA256              string         `gorm:"column:sha256;size:128;not null;default:''"`
	Revision            string         `gorm:"column:revision;size:128;not null;default:''"`
	SizeBytes           int64          `gorm:"column:size_bytes;not null;default:0"`
	ManifestJSON        []byte         `gorm:"column:manifest_json;type:jsonb;not null;default:'{}'::jsonb"`
	CreatedAt           time.Time      `gorm:"column:created_at;not null;autoCreateTime"`
	UpdatedAt           time.Time      `gorm:"column:updated_at;not null;autoUpdateTime"`
	DeletedAt           gorm.DeletedAt `gorm:"column:deleted_at;index"`
}

type skillFileModel struct {
	ID        int64          `gorm:"primaryKey;autoIncrement;column:id"`
	SkillName string         `gorm:"column:skill_name;size:128;index;not null"`
	Version   string         `gorm:"column:version;size:64;index;not null"`
	Path      string         `gorm:"column:path;size:512;not null"`
	Name      string         `gorm:"column:name;size:256;not null;default:''"`
	Type      string         `gorm:"column:type;size:128;not null;default:''"`
	Size      int64          `gorm:"column:size;not null;default:0"`
	Binary    bool           `gorm:"column:binary;not null;default:false"`
	Content   string         `gorm:"column:content;type:text;not null;default:''"`
	CreatedAt time.Time      `gorm:"column:created_at;not null;autoCreateTime"`
	UpdatedAt time.Time      `gorm:"column:updated_at;not null;autoUpdateTime"`
	DeletedAt gorm.DeletedAt `gorm:"column:deleted_at;index"`
}

func (skillModel) TableName() string { return "aihub_skills" }

func (skillVersionModel) TableName() string { return "aihub_skill_versions" }

func (skillFileModel) TableName() string { return "aihub_skill_files" }

func NewSkillRepo(data *Data) (biz.SkillRepo, error) {
	// DB connection, pooling, logging, health checks, and transaction context are
	// owned by aisphere-kit. The Hub repo only keeps the Runtime reference and
	// performs business CRUD. It must not run AutoMigrate or open its own DB.
	//
	// Schema changes are applied through migrations/postgres/*.sql. If migrations
	// were not run, runtime queries return a clear "run migrations" error.
	return &skillRepo{data: data}, nil
}

func (r *skillRepo) CreateSkill(ctx context.Context, skill *biz.Skill) (*biz.Skill, error) {
	db := r.db(ctx)
	if db == nil {
		return nil, fmt.Errorf("skill repo database is not configured")
	}
	row, err := skillToRow(skill)
	if err != nil {
		return nil, err
	}
	if err := db.Create(row).Error; err != nil {
		if isUniqueViolation(err) {
			return nil, biz.ErrSkillAlreadyExists
		}
		return nil, mapSkillDBError(err)
	}
	return rowToSkill(row), nil
}

func (r *skillRepo) UpdateSkill(ctx context.Context, skill *biz.Skill) (*biz.Skill, error) {
	db := r.db(ctx)
	if db == nil {
		return nil, fmt.Errorf("skill repo database is not configured")
	}
	row, err := skillToRow(skill)
	if err != nil {
		return nil, err
	}
	updates := map[string]any{
		"display_name":  row.DisplayName,
		"description":   row.Description,
		"version":       row.Version,
		"status":        row.Status,
		"visibility":    row.Visibility,
		"owner_id":      row.OwnerID,
		"org_id":        row.OrgID,
		"project_id":    row.ProjectID,
		"source_type":   row.SourceType,
		"source_uri":    row.SourceURI,
		"manifest_json": row.ManifestJSON,
		"tags":          row.TagsJSON,
		"updated_at":    time.Now(),
	}
	res := db.Model(&skillModel{}).Where("name = ?", row.Name).Updates(updates)
	if res.Error != nil {
		return nil, mapSkillDBError(res.Error)
	}
	if res.RowsAffected == 0 {
		return nil, biz.ErrSkillNotFound
	}
	return r.GetSkill(ctx, row.Name)
}

func (r *skillRepo) ListSkills(ctx context.Context, opts biz.SkillListOptions) (*biz.SkillListResult, error) {
	base := r.db(ctx)
	if base == nil {
		return nil, fmt.Errorf("skill repo database is not configured")
	}
	db := base.Model(&skillModel{})
	if q := strings.TrimSpace(opts.Query); q != "" {
		like := "%" + q + "%"
		db = db.Where("name ILIKE ? OR display_name ILIKE ? OR description ILIKE ?", like, like, like)
	}
	if status := strings.TrimSpace(opts.Status); status != "" {
		db = db.Where("status = ?", status)
	}
	if visibility := strings.TrimSpace(opts.Visibility); visibility != "" {
		db = db.Where("visibility = ?", visibility)
	}
	if opts.OnlyOnline {
		db = db.Where(`EXISTS (
			SELECT 1 FROM aihub_skill_versions v
			WHERE v.skill_name = aihub_skills.name
			  AND v.status = ?
			  AND v.deleted_at IS NULL
		)`, biz.SkillVersionStatusOnline)
	}

	limit := opts.Limit
	if limit <= 0 {
		limit = 20
	}
	if limit > 100 {
		limit = 100
	}

	var rows []skillModel
	if err := db.Order("id ASC").Offset(opts.Offset).Limit(limit + 1).Find(&rows).Error; err != nil {
		return nil, mapSkillDBError(err)
	}
	hasMore := len(rows) > limit
	if hasMore {
		rows = rows[:limit]
	}
	items := make([]*biz.Skill, 0, len(rows))
	for i := range rows {
		items = append(items, rowToSkill(&rows[i]))
	}
	return &biz.SkillListResult{
		Items:      items,
		NextOffset: opts.Offset + len(items),
		HasMore:    hasMore,
	}, nil
}

func (r *skillRepo) ListSkillsByNames(ctx context.Context, names []string, opts biz.SkillListOptions) (*biz.SkillListResult, error) {
	base := r.db(ctx)
	if base == nil {
		return nil, fmt.Errorf("skill repo database is not configured")
	}
	clean := make([]string, 0, len(names))
	seen := map[string]struct{}{}
	for _, name := range names {
		name = strings.TrimSpace(name)
		if name == "" {
			continue
		}
		if _, ok := seen[name]; ok {
			continue
		}
		seen[name] = struct{}{}
		clean = append(clean, name)
	}
	if len(clean) == 0 {
		return &biz.SkillListResult{Items: []*biz.Skill{}, NextOffset: opts.Offset, HasMore: false}, nil
	}
	db := base.Model(&skillModel{}).Where("name IN ?", clean)
	if q := strings.TrimSpace(opts.Query); q != "" {
		like := "%" + q + "%"
		db = db.Where("name ILIKE ? OR display_name ILIKE ? OR description ILIKE ?", like, like, like)
	}
	if status := strings.TrimSpace(opts.Status); status != "" {
		db = db.Where("status = ?", status)
	}
	if visibility := strings.TrimSpace(opts.Visibility); visibility != "" {
		db = db.Where("visibility = ?", visibility)
	}
	if opts.OnlyOnline {
		db = db.Where(`EXISTS (
			SELECT 1 FROM aihub_skill_versions v
			WHERE v.skill_name = aihub_skills.name
			  AND v.status = ?
			  AND v.deleted_at IS NULL
		)`, biz.SkillVersionStatusOnline)
	}
	limit := opts.Limit
	if limit <= 0 {
		limit = 20
	}
	if limit > 100 {
		limit = 100
	}
	var rows []skillModel
	if err := db.Order("name ASC").Offset(opts.Offset).Limit(limit + 1).Find(&rows).Error; err != nil {
		return nil, mapSkillDBError(err)
	}
	hasMore := len(rows) > limit
	if hasMore {
		rows = rows[:limit]
	}
	items := make([]*biz.Skill, 0, len(rows))
	for i := range rows {
		items = append(items, rowToSkill(&rows[i]))
	}
	return &biz.SkillListResult{Items: items, NextOffset: opts.Offset + len(items), HasMore: hasMore}, nil
}

func (r *skillRepo) GetSkill(ctx context.Context, name string) (*biz.Skill, error) {
	db := r.db(ctx)
	if db == nil {
		return nil, fmt.Errorf("skill repo database is not configured")
	}
	var row skillModel
	err := db.Where("name = ?", name).First(&row).Error
	if err == nil {
		return rowToSkill(&row), nil
	}
	if err == gorm.ErrRecordNotFound {
		return nil, biz.ErrSkillNotFound
	}
	return nil, mapSkillDBError(err)
}

func (r *skillRepo) DeleteSkill(ctx context.Context, name string) error {
	db := r.db(ctx)
	if db == nil {
		return fmt.Errorf("skill repo database is not configured")
	}
	res := db.Where("name = ?", name).Delete(&skillModel{})
	if res.Error != nil {
		return mapSkillDBError(res.Error)
	}
	if res.RowsAffected == 0 {
		return biz.ErrSkillNotFound
	}
	return nil
}

func (r *skillRepo) SaveSkillPackage(ctx context.Context, skill *biz.Skill, version *biz.SkillVersion, files []*biz.SkillFile, packageBytes []byte, overwrite bool) (*biz.SkillVersion, error) {
	db := r.db(ctx)
	if db == nil {
		return nil, fmt.Errorf("skill repo database is not configured")
	}
	if r.data != nil && r.data.Runtime != nil && r.data.Runtime.S3 != nil {
		refs, err := storeSkillPackageObjects(ctx, r.data.Runtime.S3, skill, version, files, packageBytes)
		if err != nil {
			return nil, err
		}
		skill.SourceURI = refs.PackageURI
		version.Revision = refs.PackageKey
	}
	skillRow, err := skillToRow(skill)
	if err != nil {
		return nil, err
	}
	versionRow, err := skillVersionToRow(version)
	if err != nil {
		return nil, err
	}
	fileRows := make([]skillFileModel, 0, len(files))
	for _, file := range files {
		row, err := skillFileToRow(file)
		if err != nil {
			return nil, err
		}
		fileRows = append(fileRows, *row)
	}

	var out *biz.SkillVersion
	err = db.Transaction(func(tx *gorm.DB) error {
		var existing skillVersionModel
		err := tx.Where("skill_name = ? AND version = ?", versionRow.SkillName, versionRow.Version).First(&existing).Error
		if err == nil && !overwrite {
			return biz.ErrSkillVersionAlreadyExists
		}
		if err != nil && err != gorm.ErrRecordNotFound {
			return mapSkillDBError(err)
		}

		if err := tx.Clauses(clause.OnConflict{
			Columns: []clause.Column{{Name: "name"}},
			DoUpdates: clause.AssignmentColumns([]string{
				"display_name",
				"description",
				"version",
				"status",
				"visibility",
				"owner_id",
				"org_id",
				"project_id",
				"source_type",
				"source_uri",
				"manifest_json",
				"tags",
				"updated_at",
			}),
		}).Create(skillRow).Error; err != nil {
			return mapSkillDBError(err)
		}

		if err == nil && overwrite {
			if err := tx.Unscoped().Where("skill_name = ? AND version = ?", versionRow.SkillName, versionRow.Version).Delete(&skillFileModel{}).Error; err != nil {
				return mapSkillDBError(err)
			}
			updates := map[string]any{
				"status":                versionRow.Status,
				"author":                versionRow.Author,
				"commit_msg":            versionRow.CommitMsg,
				"publish_pipeline_info": versionRow.PublishPipelineInfo,
				"md5":                   versionRow.MD5,
				"sha256":                versionRow.SHA256,
				"revision":              versionRow.Revision,
				"size_bytes":            versionRow.SizeBytes,
				"manifest_json":         versionRow.ManifestJSON,
				"updated_at":            time.Now(),
			}
			if err := tx.Model(&skillVersionModel{}).Where("skill_name = ? AND version = ?", versionRow.SkillName, versionRow.Version).Updates(updates).Error; err != nil {
				return mapSkillDBError(err)
			}
		} else {
			if err := tx.Create(versionRow).Error; err != nil {
				if isUniqueViolation(err) {
					return biz.ErrSkillVersionAlreadyExists
				}
				return mapSkillDBError(err)
			}
		}

		if len(fileRows) > 0 {
			if err := tx.Create(&fileRows).Error; err != nil {
				return mapSkillDBError(err)
			}
		}
		var saved skillVersionModel
		if err := tx.Where("skill_name = ? AND version = ?", versionRow.SkillName, versionRow.Version).First(&saved).Error; err != nil {
			return mapSkillDBError(err)
		}
		out = rowToSkillVersion(&saved)
		return nil
	})
	if err != nil {
		return nil, err
	}
	return out, nil
}

type skillPackageObjectRefs struct {
	PackageKey string
	PackageURI string
	FileKeys   map[string]string
}

func storeSkillPackageObjects(ctx context.Context, s3 objectstore.Client, skill *biz.Skill, version *biz.SkillVersion, files []*biz.SkillFile, packageBytes []byte) (skillPackageObjectRefs, error) {
	if s3 == nil {
		return skillPackageObjectRefs{}, nil
	}
	base := fmt.Sprintf("skills/%s/versions/%s", objectPathPart(skill.Name), objectPathPart(version.Version))
	packageKey := base + "/package.zip"
	if _, err := s3.PutObject(ctx, packageKey, bytes.NewReader(packageBytes), int64(len(packageBytes)), objectstore.PutOptions{
		ContentType: "application/zip",
		Metadata: map[string]string{
			"skill-name": skill.Name,
			"version":    version.Version,
		},
	}); err != nil {
		return skillPackageObjectRefs{}, err
	}

	refs := skillPackageObjectRefs{
		PackageKey: packageKey,
		PackageURI: objectstoreURI(s3.Bucket(), packageKey),
		FileKeys:   map[string]string{},
	}
	for _, file := range files {
		if file == nil {
			continue
		}
		rel, ok := cleanObjectRelPath(file.Path)
		if !ok {
			return skillPackageObjectRefs{}, biz.ErrSkillInvalidArgument
		}
		key := base + "/files/" + rel
		body := []byte(file.Content)
		if file.Binary {
			decoded, err := base64.StdEncoding.DecodeString(file.Content)
			if err != nil {
				return skillPackageObjectRefs{}, biz.ErrSkillInvalidArgument
			}
			body = decoded
		}
		if _, err := s3.PutObject(ctx, key, bytes.NewReader(body), int64(len(body)), objectstore.PutOptions{
			ContentType: skillFileContentType(file),
			Metadata: map[string]string{
				"skill-name": skill.Name,
				"version":    version.Version,
				"path":       rel,
			},
		}); err != nil {
			return skillPackageObjectRefs{}, err
		}
		refs.FileKeys[rel] = key
	}
	return refs, nil
}

func objectPathPart(value string) string {
	value = strings.TrimSpace(strings.ReplaceAll(value, "\\", "/"))
	value = strings.Trim(value, "/")
	if value == "" {
		return "_"
	}
	value = strings.ReplaceAll(value, "/", "_")
	return value
}

func cleanObjectRelPath(value string) (string, bool) {
	value = strings.TrimSpace(strings.ReplaceAll(value, "\\", "/"))
	value = strings.TrimPrefix(value, "/")
	clean := path.Clean(value)
	if clean == "." || clean == "" || clean == ".." || strings.HasPrefix(clean, "../") || strings.Contains(clean, "/../") {
		return "", false
	}
	return clean, true
}

func objectstoreURI(bucket, key string) string {
	return fmt.Sprintf("objectstore://%s/%s", bucket, key)
}

func skillFileContentType(file *biz.SkillFile) string {
	if file == nil {
		return "application/octet-stream"
	}
	if file.Binary {
		return "application/octet-stream"
	}
	switch strings.ToLower(file.Type) {
	case "markdown", "prompts", "references":
		return "text/markdown; charset=utf-8"
	case "json":
		return "application/json"
	default:
		return "text/plain; charset=utf-8"
	}
}

func zipSkillFiles(skillName string, files []*biz.SkillFile) ([]byte, error) {
	buf := bytes.NewBuffer(nil)
	zw := zip.NewWriter(buf)
	prefix := objectPathPart(skillName)
	for _, file := range files {
		if file == nil {
			continue
		}
		rel, ok := cleanObjectRelPath(file.Path)
		if !ok {
			_ = zw.Close()
			return nil, biz.ErrSkillInvalidArgument
		}
		body := []byte(file.Content)
		if file.Binary {
			decoded, err := base64.StdEncoding.DecodeString(file.Content)
			if err != nil {
				_ = zw.Close()
				return nil, biz.ErrSkillInvalidArgument
			}
			body = decoded
		}
		w, err := zw.Create(prefix + "/" + rel)
		if err != nil {
			_ = zw.Close()
			return nil, err
		}
		if _, err := w.Write(body); err != nil {
			_ = zw.Close()
			return nil, err
		}
	}
	if err := zw.Close(); err != nil {
		return nil, err
	}
	return buf.Bytes(), nil
}

func (r *skillRepo) ListSkillVersions(ctx context.Context, name string) ([]*biz.SkillVersion, error) {
	db := r.db(ctx)
	if db == nil {
		return nil, fmt.Errorf("skill repo database is not configured")
	}
	var rows []skillVersionModel
	err := db.Where("skill_name = ?", name).Order("version ASC").Find(&rows).Error
	if err != nil {
		if isUndefinedTable(err) {
			return r.syntheticSkillVersion(ctx, name)
		}
		return nil, mapSkillDBError(err)
	}
	if len(rows) == 0 {
		return r.syntheticSkillVersion(ctx, name)
	}
	out := make([]*biz.SkillVersion, 0, len(rows))
	for i := range rows {
		out = append(out, rowToSkillVersion(&rows[i]))
	}
	return out, nil
}

func (r *skillRepo) GetSkillVersion(ctx context.Context, name, version string) (*biz.SkillVersion, error) {
	db := r.db(ctx)
	if db == nil {
		return nil, fmt.Errorf("skill repo database is not configured")
	}
	var row skillVersionModel
	err := db.Where("skill_name = ? AND version = ?", name, version).First(&row).Error
	if err == nil {
		return rowToSkillVersion(&row), nil
	}
	if err == gorm.ErrRecordNotFound {
		if synthetic, synthErr := r.syntheticSkillVersion(ctx, name); synthErr == nil {
			for _, item := range synthetic {
				if item.Version == version {
					return item, nil
				}
			}
		}
		return nil, biz.ErrSkillVersionNotFound
	}
	if isUndefinedTable(err) {
		if synthetic, synthErr := r.syntheticSkillVersion(ctx, name); synthErr == nil {
			for _, item := range synthetic {
				if item.Version == version {
					return item, nil
				}
			}
		}
		return nil, biz.ErrSkillVersionNotFound
	}
	return nil, mapSkillDBError(err)
}

func (r *skillRepo) ListSkillVersionFiles(ctx context.Context, name, version string) ([]*biz.SkillFile, error) {
	db := r.db(ctx)
	if db == nil {
		return nil, fmt.Errorf("skill repo database is not configured")
	}
	var rows []skillFileModel
	err := db.Where("skill_name = ? AND version = ?", name, version).Order("path ASC").Find(&rows).Error
	if err != nil {
		return nil, mapSkillDBError(err)
	}
	out := make([]*biz.SkillFile, 0, len(rows))
	for i := range rows {
		out = append(out, rowToSkillFile(&rows[i]))
	}
	return out, nil
}

func (r *skillRepo) GetSkillVersionFile(ctx context.Context, name, version, filePath string) (*biz.SkillFile, error) {
	db := r.db(ctx)
	if db == nil {
		return nil, fmt.Errorf("skill repo database is not configured")
	}
	var row skillFileModel
	err := db.Where("skill_name = ? AND version = ? AND path = ?", name, version, filePath).First(&row).Error
	if err == nil {
		return rowToSkillFile(&row), nil
	}
	if err == gorm.ErrRecordNotFound {
		return nil, biz.ErrSkillFileNotFound
	}
	return nil, mapSkillDBError(err)
}

func (r *skillRepo) UpdateSkillVersionStatus(ctx context.Context, name, version, status string) (*biz.SkillVersion, error) {
	db := r.db(ctx)
	if db == nil {
		return nil, fmt.Errorf("skill repo database is not configured")
	}
	err := db.Transaction(func(tx *gorm.DB) error {
		res := tx.Model(&skillVersionModel{}).Where("skill_name = ? AND version = ?", name, version).Updates(map[string]any{
			"status":     status,
			"updated_at": time.Now(),
		})
		if res.Error != nil {
			return mapSkillDBError(res.Error)
		}
		if res.RowsAffected == 0 {
			return biz.ErrSkillVersionNotFound
		}
		if status == biz.SkillVersionStatusOnline {
			if err := tx.Model(&skillVersionModel{}).
				Where("skill_name = ? AND version <> ? AND status = ?", name, version, biz.SkillVersionStatusOnline).
				Updates(map[string]any{"status": biz.SkillVersionStatusPublished, "updated_at": time.Now()}).Error; err != nil {
				return mapSkillDBError(err)
			}
			if err := tx.Model(&skillModel{}).Where("name = ?", name).Updates(map[string]any{
				"version":    version,
				"status":     biz.SkillStatusActive,
				"updated_at": time.Now(),
			}).Error; err != nil {
				return mapSkillDBError(err)
			}
		}
		if status == biz.SkillVersionStatusOffline {
			if err := tx.Model(&skillModel{}).Where("name = ? AND version = ?", name, version).Updates(map[string]any{
				"status":     biz.SkillStatusArchived,
				"updated_at": time.Now(),
			}).Error; err != nil {
				return mapSkillDBError(err)
			}
		}
		return nil
	})
	if err != nil {
		return nil, err
	}
	return r.GetSkillVersion(ctx, name, version)
}

func (r *skillRepo) GetOnlineSkillVersion(ctx context.Context, name string) (*biz.SkillVersion, error) {
	db := r.db(ctx)
	if db == nil {
		return nil, fmt.Errorf("skill repo database is not configured")
	}
	var row skillVersionModel
	err := db.Where("skill_name = ? AND status = ?", name, biz.SkillVersionStatusOnline).Order("updated_at DESC").First(&row).Error
	if err == nil {
		return rowToSkillVersion(&row), nil
	}
	if err == gorm.ErrRecordNotFound {
		return nil, biz.ErrSkillVersionNotFound
	}
	return nil, mapSkillDBError(err)
}

func (r *skillRepo) DownloadSkillPackage(ctx context.Context, name, version string) ([]byte, error) {
	meta, err := r.GetSkillVersion(ctx, name, version)
	if err != nil {
		return nil, err
	}
	if r.data != nil && r.data.Runtime != nil && r.data.Runtime.S3 != nil && strings.TrimSpace(meta.Revision) != "" {
		rc, _, err := r.data.Runtime.S3.GetObject(ctx, meta.Revision, objectstore.GetOptions{})
		if err != nil {
			return nil, err
		}
		defer rc.Close()
		return io.ReadAll(rc)
	}
	files, err := r.ListSkillVersionFiles(ctx, name, version)
	if err != nil {
		return nil, err
	}
	return zipSkillFiles(name, files)
}

func (r *skillRepo) db(ctx context.Context) *gorm.DB {
	if r.data != nil && r.data.Runtime != nil {
		if db := r.data.Runtime.DBFromContext(ctx); db != nil {
			return db
		}
		if r.data.Runtime.DB != nil {
			return r.data.Runtime.DB.WithContext(ctx)
		}
	}
	return nil
}

func skillToRow(skill *biz.Skill) (*skillModel, error) {
	if skill == nil {
		return nil, biz.ErrSkillInvalidArgument
	}
	manifest := []byte(strings.TrimSpace(skill.ManifestJSON))
	if len(manifest) == 0 {
		manifest = []byte(`{}`)
	}
	if !json.Valid(manifest) {
		return nil, biz.ErrSkillInvalidArgument
	}
	tagsValue := skill.Tags
	if tagsValue == nil {
		tagsValue = []string{}
	}
	tags, err := json.Marshal(tagsValue)
	if err != nil {
		return nil, err
	}
	now := time.Now()
	createdAt := skill.CreateTime
	if createdAt.IsZero() {
		createdAt = now
	}
	updatedAt := skill.UpdateTime
	if updatedAt.IsZero() {
		updatedAt = now
	}
	return &skillModel{
		ID:           skill.ID,
		Name:         skill.Name,
		DisplayName:  skill.DisplayName,
		Description:  skill.Description,
		Version:      skill.Version,
		Status:       skill.Status,
		Visibility:   skill.Visibility,
		OwnerID:      skill.OwnerID,
		OrgID:        skill.OrgID,
		ProjectID:    skill.ProjectID,
		SourceType:   skill.SourceType,
		SourceURI:    skill.SourceURI,
		ManifestJSON: manifest,
		TagsJSON:     tags,
		CreatedAt:    createdAt,
		UpdatedAt:    updatedAt,
	}, nil
}

func rowToSkill(row *skillModel) *biz.Skill {
	if row == nil {
		return nil
	}
	createdAt := row.CreatedAt
	updatedAt := row.UpdatedAt
	if updatedAt.IsZero() {
		updatedAt = createdAt
	}
	if createdAt.IsZero() {
		createdAt = updatedAt
	}
	return &biz.Skill{
		ID:           row.ID,
		Name:         row.Name,
		DisplayName:  row.DisplayName,
		Description:  row.Description,
		Version:      row.Version,
		Status:       row.Status,
		Visibility:   row.Visibility,
		OwnerID:      row.OwnerID,
		OrgID:        row.OrgID,
		ProjectID:    row.ProjectID,
		SourceType:   row.SourceType,
		SourceURI:    row.SourceURI,
		ManifestJSON: bytesToJSONString(row.ManifestJSON, "{}"),
		Tags:         decodeStringSlice(row.TagsJSON),
		CreateTime:   createdAt,
		UpdateTime:   updatedAt,
	}
}

func skillVersionToRow(version *biz.SkillVersion) (*skillVersionModel, error) {
	if version == nil {
		return nil, biz.ErrSkillInvalidArgument
	}
	manifest := []byte(strings.TrimSpace(version.ManifestJSON))
	if len(manifest) == 0 {
		manifest = []byte(`{}`)
	}
	if !json.Valid(manifest) {
		return nil, biz.ErrSkillInvalidArgument
	}
	now := time.Now()
	createdAt := version.CreateTime
	if createdAt.IsZero() {
		createdAt = now
	}
	updatedAt := version.UpdateTime
	if updatedAt.IsZero() {
		updatedAt = now
	}
	return &skillVersionModel{
		ID:                  version.ID,
		SkillName:           version.SkillName,
		Version:             version.Version,
		Status:              version.Status,
		Author:              version.Author,
		CommitMsg:           version.CommitMsg,
		PublishPipelineInfo: version.PublishPipelineInfo,
		DownloadCount:       version.DownloadCount,
		MD5:                 version.MD5,
		SHA256:              version.SHA256,
		Revision:            version.Revision,
		SizeBytes:           version.SizeBytes,
		ManifestJSON:        manifest,
		CreatedAt:           createdAt,
		UpdatedAt:           updatedAt,
	}, nil
}

func rowToSkillVersion(row *skillVersionModel) *biz.SkillVersion {
	if row == nil {
		return nil
	}
	return &biz.SkillVersion{
		ID:                  row.ID,
		SkillName:           row.SkillName,
		Version:             row.Version,
		Status:              row.Status,
		Author:              row.Author,
		CommitMsg:           row.CommitMsg,
		PublishPipelineInfo: row.PublishPipelineInfo,
		DownloadCount:       row.DownloadCount,
		MD5:                 row.MD5,
		SHA256:              row.SHA256,
		Revision:            row.Revision,
		SizeBytes:           row.SizeBytes,
		ManifestJSON:        bytesToJSONString(row.ManifestJSON, "{}"),
		CreateTime:          row.CreatedAt,
		UpdateTime:          row.UpdatedAt,
	}
}

func skillFileToRow(file *biz.SkillFile) (*skillFileModel, error) {
	if file == nil {
		return nil, biz.ErrSkillInvalidArgument
	}
	now := time.Now()
	createdAt := file.CreateTime
	if createdAt.IsZero() {
		createdAt = now
	}
	updatedAt := file.UpdateTime
	if updatedAt.IsZero() {
		updatedAt = now
	}
	return &skillFileModel{
		ID:        file.ID,
		SkillName: file.SkillName,
		Version:   file.Version,
		Path:      file.Path,
		Name:      file.Name,
		Type:      file.Type,
		Size:      file.Size,
		Binary:    file.Binary,
		Content:   file.Content,
		CreatedAt: createdAt,
		UpdatedAt: updatedAt,
	}, nil
}

func rowToSkillFile(row *skillFileModel) *biz.SkillFile {
	if row == nil {
		return nil
	}
	return &biz.SkillFile{
		ID:         row.ID,
		SkillName:  row.SkillName,
		Version:    row.Version,
		Path:       row.Path,
		Name:       row.Name,
		Type:       row.Type,
		Size:       row.Size,
		Binary:     row.Binary,
		Content:    row.Content,
		CreateTime: row.CreatedAt,
		UpdateTime: row.UpdatedAt,
	}
}

func (r *skillRepo) syntheticSkillVersion(ctx context.Context, name string) ([]*biz.SkillVersion, error) {
	skill, err := r.GetSkill(ctx, name)
	if err != nil {
		return nil, err
	}
	if strings.TrimSpace(skill.Version) == "" {
		return []*biz.SkillVersion{}, nil
	}
	return []*biz.SkillVersion{{
		SkillName:    skill.Name,
		Version:      skill.Version,
		Status:       skill.Status,
		ManifestJSON: skill.ManifestJSON,
		CreateTime:   skill.CreateTime,
		UpdateTime:   skill.UpdateTime,
	}}, nil
}

func bytesToJSONString(b []byte, fallback string) string {
	if len(b) == 0 {
		return fallback
	}
	return string(b)
}

func decodeStringSlice(b []byte) []string {
	if len(b) == 0 {
		return nil
	}
	var out []string
	if err := json.Unmarshal(b, &out); err != nil {
		return nil
	}
	return out
}

func isUniqueViolation(err error) bool {
	if err == nil {
		return false
	}
	var pgErr *pgconn.PgError
	if stderrors.As(err, &pgErr) && pgErr.Code == "23505" {
		return true
	}
	msg := err.Error()
	return strings.Contains(msg, "SQLSTATE 23505") || strings.Contains(msg, "duplicate key") || strings.Contains(msg, "unique constraint") || strings.Contains(msg, "violates unique constraint")
}

func mapSkillDBError(err error) error {
	if err == nil {
		return nil
	}
	if isUndefinedTable(err) {
		return fmt.Errorf("aihub skill tables are not ready; run migrations/postgres/000002_create_aihub_skills.sql through migrations/postgres/000004_create_aihub_skill_versions_files.sql: %w", err)
	}
	return err
}

func isUndefinedTable(err error) bool {
	if err == nil {
		return false
	}
	var pgErr *pgconn.PgError
	if stderrors.As(err, &pgErr) && pgErr.Code == "42P01" {
		return true
	}
	msg := err.Error()
	return strings.Contains(msg, "SQLSTATE 42P01") || strings.Contains(msg, "relation \"aihub_skills\" does not exist") || strings.Contains(msg, "UndefinedTable")
}

func EncodePageToken(offset int) string {
	if offset <= 0 {
		return ""
	}
	return strconv.Itoa(offset)
}

func DecodePageToken(token string) (int, error) {
	if strings.TrimSpace(token) == "" {
		return 0, nil
	}
	offset, err := strconv.Atoi(token)
	if err != nil || offset < 0 {
		return 0, biz.ErrSkillInvalidArgument
	}
	return offset, nil
}

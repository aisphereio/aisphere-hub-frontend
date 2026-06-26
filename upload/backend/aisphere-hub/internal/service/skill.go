package service

import (
	"context"
	"strconv"
	"strings"
	"time"

	v1 "aisphere-hub/api/skill/v1"
	"aisphere-hub/internal/biz"

	khttp "github.com/go-kratos/kratos/v3/transport/http"
	"google.golang.org/protobuf/types/known/emptypb"
	"google.golang.org/protobuf/types/known/timestamppb"
)

const defaultSkillPageSize = 20

type SkillService struct {
	v1.UnimplementedSkillServiceServer
	uc *biz.SkillUsecase
}

func NewSkillService(uc *biz.SkillUsecase) *SkillService {
	return &SkillService{uc: uc}
}

func (s *SkillService) RegisterHTTPServer(srv *khttp.Server) {
	v1.RegisterSkillServiceHTTPServer(srv, s)
}

func (s *SkillService) CreateSkill(ctx context.Context, req *v1.CreateSkillRequest) (*v1.Skill, error) {
	out, err := s.uc.CreateSkill(ctx, &biz.Skill{
		Name:         req.GetName(),
		DisplayName:  req.GetDisplayName(),
		Description:  req.GetDescription(),
		Version:      req.GetVersion(),
		Status:       req.GetStatus(),
		Visibility:   req.GetVisibility(),
		OwnerID:      req.GetOwnerId(),
		OrgID:        req.GetOrgId(),
		ProjectID:    req.GetProjectId(),
		SourceType:   req.GetSourceType(),
		SourceURI:    req.GetSourceUri(),
		ManifestJSON: req.GetManifestJson(),
		Tags:         append([]string(nil), req.GetTags()...),
	})
	if err != nil {
		return nil, err
	}
	return skillDOToDTO(out), nil
}

func (s *SkillService) UpdateSkill(ctx context.Context, req *v1.UpdateSkillRequest) (*v1.Skill, error) {
	out, err := s.uc.UpdateSkill(ctx, &biz.Skill{
		Name:         req.GetName(),
		DisplayName:  req.GetDisplayName(),
		Description:  req.GetDescription(),
		Version:      req.GetVersion(),
		Status:       req.GetStatus(),
		Visibility:   req.GetVisibility(),
		OwnerID:      req.GetOwnerId(),
		OrgID:        req.GetOrgId(),
		ProjectID:    req.GetProjectId(),
		SourceType:   req.GetSourceType(),
		SourceURI:    req.GetSourceUri(),
		ManifestJSON: req.GetManifestJson(),
		Tags:         append([]string(nil), req.GetTags()...),
	})
	if err != nil {
		return nil, err
	}
	return skillDOToDTO(out), nil
}

func (s *SkillService) ListSkills(ctx context.Context, req *v1.ListSkillsRequest) (*v1.ListSkillsResponse, error) {
	limit := int(req.GetPageSize())
	if limit <= 0 {
		limit = defaultSkillPageSize
	}
	offset, err := parseSkillPageToken(req.GetPageToken())
	if err != nil {
		return nil, err
	}
	out, err := s.uc.ListSkills(ctx, biz.SkillListOptions{
		Limit:      limit,
		Offset:     offset,
		Query:      req.GetQ(),
		Status:     req.GetStatus(),
		Visibility: req.GetVisibility(),
	})
	if err != nil {
		return nil, err
	}
	return skillListResultToDTO(out), nil
}

func (s *SkillService) GetSkill(ctx context.Context, req *v1.GetSkillRequest) (*v1.Skill, error) {
	item, err := s.uc.GetSkill(ctx, req.GetName())
	if err != nil {
		return nil, err
	}
	return skillDOToDTO(item), nil
}

func (s *SkillService) DeleteSkill(ctx context.Context, req *v1.DeleteSkillRequest) (*emptypb.Empty, error) {
	if err := s.uc.DeleteSkill(ctx, req.GetName()); err != nil {
		return nil, err
	}
	return &emptypb.Empty{}, nil
}

func (s *SkillService) UploadSkillPackage(ctx context.Context, req *v1.UploadSkillPackageRequest) (*v1.SkillVersion, error) {
	out, err := s.uc.UploadSkillPackage(ctx, biz.SkillPackageUpload{
		PackageBytes:  req.GetPackageBytes(),
		Overwrite:     req.GetOverwrite(),
		TargetVersion: req.GetTargetVersion(),
		CommitMsg:     req.GetCommitMsg(),
	})
	if err != nil {
		return nil, err
	}
	return skillVersionDOToDTO(out), nil
}

func (s *SkillService) ListSkillVersions(ctx context.Context, req *v1.ListSkillVersionsRequest) (*v1.ListSkillVersionsResponse, error) {
	items, err := s.uc.ListSkillVersions(ctx, req.GetName())
	if err != nil {
		return nil, err
	}
	resp := &v1.ListSkillVersionsResponse{Versions: make([]*v1.SkillVersion, 0, len(items))}
	for _, item := range items {
		resp.Versions = append(resp.Versions, skillVersionDOToDTO(item))
	}
	return resp, nil
}

func (s *SkillService) GetSkillVersion(ctx context.Context, req *v1.GetSkillVersionRequest) (*v1.SkillVersion, error) {
	item, err := s.uc.GetSkillVersion(ctx, req.GetName(), req.GetVersion())
	if err != nil {
		return nil, err
	}
	return skillVersionDOToDTO(item), nil
}

func (s *SkillService) SubmitSkillVersion(ctx context.Context, req *v1.SkillVersionActionRequest) (*v1.SkillVersion, error) {
	out, err := s.uc.SubmitSkillVersion(ctx, req.GetName(), req.GetVersion())
	if err != nil {
		return nil, err
	}
	return skillVersionDOToDTO(out), nil
}

func (s *SkillService) PublishSkillVersion(ctx context.Context, req *v1.SkillVersionActionRequest) (*v1.SkillVersion, error) {
	out, err := s.uc.PublishSkillVersion(ctx, req.GetName(), req.GetVersion(), false)
	if err != nil {
		return nil, err
	}
	return skillVersionDOToDTO(out), nil
}

func (s *SkillService) ForcePublishSkillVersion(ctx context.Context, req *v1.SkillVersionActionRequest) (*v1.SkillVersion, error) {
	out, err := s.uc.PublishSkillVersion(ctx, req.GetName(), req.GetVersion(), true)
	if err != nil {
		return nil, err
	}
	return skillVersionDOToDTO(out), nil
}

func (s *SkillService) OnlineSkillVersion(ctx context.Context, req *v1.SkillVersionActionRequest) (*v1.SkillVersion, error) {
	out, err := s.uc.OnlineSkillVersion(ctx, req.GetName(), req.GetVersion())
	if err != nil {
		return nil, err
	}
	return skillVersionDOToDTO(out), nil
}

func (s *SkillService) OfflineSkillVersion(ctx context.Context, req *v1.SkillVersionActionRequest) (*v1.SkillVersion, error) {
	out, err := s.uc.OfflineSkillVersion(ctx, req.GetName(), req.GetVersion())
	if err != nil {
		return nil, err
	}
	return skillVersionDOToDTO(out), nil
}

func (s *SkillService) DownloadSkillVersion(ctx context.Context, req *v1.DownloadSkillVersionRequest) (*v1.SkillPackageDownload, error) {
	out, err := s.uc.DownloadSkillVersion(ctx, req.GetName(), req.GetVersion(), req.GetIfNoneMatch())
	if err != nil {
		return nil, err
	}
	return skillPackageDownloadDOToDTO(out), nil
}

func (s *SkillService) ListSkillVersionFiles(ctx context.Context, req *v1.ListSkillVersionFilesRequest) (*v1.ListSkillVersionFilesResponse, error) {
	items, err := s.uc.ListSkillVersionFiles(ctx, req.GetName(), req.GetVersion())
	if err != nil {
		return nil, err
	}
	resp := &v1.ListSkillVersionFilesResponse{Files: make([]*v1.SkillFile, 0, len(items))}
	for _, item := range items {
		resp.Files = append(resp.Files, skillFileDOToDTO(item, false))
	}
	return resp, nil
}

func (s *SkillService) GetSkillVersionFile(ctx context.Context, req *v1.GetSkillVersionFileRequest) (*v1.SkillFile, error) {
	item, err := s.uc.GetSkillVersionFile(ctx, req.GetName(), req.GetVersion(), req.GetPath())
	if err != nil {
		return nil, err
	}
	return skillFileDOToDTO(item, true), nil
}

func (s *SkillService) CompareSkillVersions(ctx context.Context, req *v1.CompareSkillVersionsRequest) (*v1.CompareSkillVersionsResponse, error) {
	out, err := s.uc.CompareSkillVersions(ctx, req.GetName(), req.GetBaseVersion(), req.GetTargetVersion())
	if err != nil {
		return nil, err
	}
	return skillVersionCompareDOToDTO(out), nil
}

func (s *SkillService) ListSkillShares(ctx context.Context, req *v1.ListSkillSharesRequest) (*v1.ListSkillSharesResponse, error) {
	shares, err := s.uc.ListSkillShares(ctx, req.GetName())
	if err != nil {
		return nil, err
	}
	resp := &v1.ListSkillSharesResponse{Shares: make([]*v1.SkillShare, 0, len(shares))}
	for _, item := range shares {
		resp.Shares = append(resp.Shares, skillShareDOToDTO(item))
	}
	return resp, nil
}

func (s *SkillService) CreateSkillShare(ctx context.Context, req *v1.CreateSkillShareRequest) (*v1.SkillShare, error) {
	out, err := s.uc.CreateSkillShare(ctx, biz.SkillShareInput{
		Name:         req.GetName(),
		SubjectType:  req.GetSubjectType(),
		SubjectID:    req.GetSubjectId(),
		OrgID:        req.GetOrgId(),
		ProjectID:    req.GetProjectId(),
		Role:         req.GetRole(),
		Actions:      append([]string(nil), req.GetActions()...),
		MetadataJSON: req.GetMetadataJson(),
	})
	if err != nil {
		return nil, err
	}
	return skillShareDOToDTO(out), nil
}

func (s *SkillService) DeleteSkillShare(ctx context.Context, req *v1.DeleteSkillShareRequest) (*emptypb.Empty, error) {
	if err := s.uc.DeleteSkillShare(ctx, req.GetName(), req.GetGrantId()); err != nil {
		return nil, err
	}
	return &emptypb.Empty{}, nil
}

func (s *SkillService) ListCatalogSkills(ctx context.Context, req *v1.ListCatalogSkillsRequest) (*v1.ListCatalogSkillsResponse, error) {
	limit := int(req.GetPageSize())
	if limit <= 0 {
		limit = defaultSkillPageSize
	}
	offset, err := parseSkillPageToken(req.GetPageToken())
	if err != nil {
		return nil, err
	}
	out, err := s.uc.ListCatalogSkills(ctx, biz.SkillListOptions{Limit: limit, Offset: offset, Query: req.GetQ()})
	if err != nil {
		return nil, err
	}
	resp := &v1.ListCatalogSkillsResponse{Skills: make([]*v1.Skill, 0, len(out.Items))}
	for _, item := range out.Items {
		resp.Skills = append(resp.Skills, skillDOToDTO(item))
	}
	if out.HasMore {
		resp.NextPageToken = strconv.Itoa(out.NextOffset)
	}
	return resp, nil
}

func (s *SkillService) GetCatalogSkill(ctx context.Context, req *v1.GetCatalogSkillRequest) (*v1.Skill, error) {
	item, err := s.uc.GetCatalogSkill(ctx, req.GetName())
	if err != nil {
		return nil, err
	}
	return skillDOToDTO(item), nil
}

func (s *SkillService) GetCatalogSkillManifest(ctx context.Context, req *v1.GetCatalogSkillManifestRequest) (*v1.SkillManifest, error) {
	out, err := s.uc.GetCatalogSkillManifest(ctx, req.GetName(), req.GetIfNoneMatch())
	if err != nil {
		return nil, err
	}
	return skillManifestDOToDTO(out), nil
}

func (s *SkillService) DownloadCatalogSkillVersion(ctx context.Context, req *v1.DownloadSkillVersionRequest) (*v1.SkillPackageDownload, error) {
	out, err := s.uc.DownloadCatalogSkillVersion(ctx, req.GetName(), req.GetVersion(), req.GetIfNoneMatch())
	if err != nil {
		return nil, err
	}
	return skillPackageDownloadDOToDTO(out), nil
}

func skillDOToDTO(item *biz.Skill) *v1.Skill {
	if item == nil {
		return nil
	}
	return &v1.Skill{
		Id:           item.ID,
		Name:         item.Name,
		DisplayName:  item.DisplayName,
		Description:  item.Description,
		Version:      item.Version,
		Status:       item.Status,
		Visibility:   item.Visibility,
		OwnerId:      item.OwnerID,
		OrgId:        item.OrgID,
		ProjectId:    item.ProjectID,
		SourceType:   item.SourceType,
		SourceUri:    item.SourceURI,
		ManifestJson: item.ManifestJSON,
		Tags:         append([]string(nil), item.Tags...),
		CreateTime:   timestampOrNil(item.CreateTime),
		UpdateTime:   timestampOrNil(item.UpdateTime),
	}
}

func skillListResultToDTO(out *biz.SkillListResult) *v1.ListSkillsResponse {
	resp := &v1.ListSkillsResponse{}
	if out == nil {
		return resp
	}
	resp.Skills = make([]*v1.Skill, 0, len(out.Items))
	for _, item := range out.Items {
		resp.Skills = append(resp.Skills, skillDOToDTO(item))
	}
	if out.HasMore {
		resp.NextPageToken = strconv.Itoa(out.NextOffset)
	}
	return resp
}

func skillVersionDOToDTO(item *biz.SkillVersion) *v1.SkillVersion {
	if item == nil {
		return nil
	}
	return &v1.SkillVersion{
		Id:                  item.ID,
		SkillName:           item.SkillName,
		Version:             item.Version,
		Status:              item.Status,
		Author:              item.Author,
		CommitMsg:           item.CommitMsg,
		PublishPipelineInfo: item.PublishPipelineInfo,
		DownloadCount:       item.DownloadCount,
		Md5:                 item.MD5,
		Sha256:              item.SHA256,
		Revision:            item.Revision,
		SizeBytes:           item.SizeBytes,
		ManifestJson:        item.ManifestJSON,
		CreateTime:          timestampOrNil(item.CreateTime),
		UpdateTime:          timestampOrNil(item.UpdateTime),
	}
}

func skillPackageDownloadDOToDTO(item *biz.SkillPackageDownload) *v1.SkillPackageDownload {
	if item == nil {
		return nil
	}
	return &v1.SkillPackageDownload{
		SkillName:    item.SkillName,
		Version:      item.Version,
		Etag:         item.ETag,
		Md5:          item.MD5,
		Sha256:       item.SHA256,
		NotModified:  item.NotModified,
		PackageBytes: append([]byte(nil), item.PackageBytes...),
	}
}

func skillFileDOToDTO(item *biz.SkillFile, includeContent bool) *v1.SkillFile {
	if item == nil {
		return nil
	}
	out := &v1.SkillFile{
		Id:         item.ID,
		SkillName:  item.SkillName,
		Version:    item.Version,
		Path:       item.Path,
		Name:       item.Name,
		Type:       item.Type,
		Size:       item.Size,
		Binary:     item.Binary,
		CreateTime: timestampOrNil(item.CreateTime),
		UpdateTime: timestampOrNil(item.UpdateTime),
	}
	if includeContent {
		out.Content = item.Content
	}
	return out
}

func skillManifestDOToDTO(item *biz.SkillManifest) *v1.SkillManifest {
	if item == nil {
		return nil
	}
	out := &v1.SkillManifest{
		SkillName:    item.SkillName,
		Version:      item.Version,
		Status:       item.Status,
		Etag:         item.ETag,
		Md5:          item.MD5,
		Sha256:       item.SHA256,
		Revision:     item.Revision,
		ManifestJson: item.ManifestJSON,
		NotModified:  item.NotModified,
		Files:        make([]*v1.SkillFile, 0, len(item.Files)),
	}
	for _, file := range item.Files {
		out.Files = append(out.Files, skillFileDOToDTO(file, false))
	}
	return out
}

func skillVersionCompareDOToDTO(item *biz.SkillVersionCompare) *v1.CompareSkillVersionsResponse {
	if item == nil {
		return nil
	}
	out := &v1.CompareSkillVersionsResponse{
		BaseVersion:   item.BaseVersion,
		TargetVersion: item.TargetVersion,
		BaseSkillMd:   item.BaseSkillMD,
		TargetSkillMd: item.TargetSkillMD,
		BaseFiles:     make([]*v1.SkillFile, 0, len(item.BaseFiles)),
		TargetFiles:   make([]*v1.SkillFile, 0, len(item.TargetFiles)),
	}
	for _, file := range item.BaseFiles {
		out.BaseFiles = append(out.BaseFiles, skillFileDOToDTO(file, false))
	}
	for _, file := range item.TargetFiles {
		out.TargetFiles = append(out.TargetFiles, skillFileDOToDTO(file, false))
	}
	return out
}

func skillShareDOToDTO(item *biz.SkillShare) *v1.SkillShare {
	if item == nil {
		return nil
	}
	return &v1.SkillShare{
		GrantId:      item.GrantID,
		Resource:     item.Resource,
		Subject:      item.Subject,
		SubjectType:  item.SubjectType,
		SubjectId:    item.SubjectID,
		Role:         item.Role,
		Actions:      append([]string(nil), item.Actions...),
		CreatedBy:    item.CreatedBy,
		MetadataJson: item.MetadataJSON,
	}
}

func timestampOrNil(t time.Time) *timestamppb.Timestamp {
	// Kept as a tiny helper so zero DB timestamps do not leak as year 0001 in
	// JSON. The data layer backfills and falls back timestamps, so this should
	// normally only guard old rows or hand-written fixtures.
	if t.IsZero() {
		return nil
	}
	return timestamppb.New(t)
}

func parseSkillPageToken(token string) (int, error) {
	if strings.TrimSpace(token) == "" {
		return 0, nil
	}
	offset, err := strconv.Atoi(token)
	if err != nil || offset < 0 {
		return 0, biz.ErrSkillInvalidArgument
	}
	return offset, nil
}

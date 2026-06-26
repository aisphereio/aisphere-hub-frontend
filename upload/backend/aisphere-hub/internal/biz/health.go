// Package biz health module — Domain Object + Repo interface + Usecase.
//
// This file follows the AGENTS.md layer contract:
//   - biz only imports api for error reason enums (none needed here yet).
//   - biz does NOT import data, service, or any DTO/proto type.
//   - The Health struct is the canonical domain object; data layer maps to it,
//     service layer maps from it to proto DTOs.
//
// Health has no persistent storage of its own — the "repo" here is a thin
// adapter around kit's health.Check() that pings DB/Redis/MinIO/Casdoor.
// We still go through the repo interface so the layering stays consistent
// with future modules that DO have storage.

package biz

import (
	"context"
	"time"
)

// Health is the domain-level health snapshot returned by the usecase.
type Health struct {
	// Status is the overall status: "ok" or "degraded".
	Status string
	// CheckedAt is when the check ran.
	CheckedAt time.Time
	// Components is the per-component status list.
	Components []ComponentStatus
}

// ComponentStatus describes the health of a single dependency
// (database, redis, objectstore, casdoor, ...).
type ComponentStatus struct {
	// Name is the component identifier, e.g. "postgres", "redis".
	Name string
	// OK is true when the component responded successfully.
	OK bool
	// Error is empty when OK is true; otherwise contains the failure message.
	Error string
	// Duration is how long the ping took.
	Duration time.Duration
}

// HealthRepo is the port through which the usecase obtains health data.
// The data layer provides the adapter.
type HealthRepo interface {
	// Check pings every configured dependency and returns the aggregated result.
	Check(ctx context.Context) (*Health, error)
}

// HealthUsecase orchestrates health-check logic. Today it is a thin pass-through
// to the repo, but it is the right place to add business rules in the future
// (e.g. caching, degradation thresholds, partial-failure policy).
type HealthUsecase struct {
	repo HealthRepo
}

// NewHealthUsecase constructs a HealthUsecase.
func NewHealthUsecase(repo HealthRepo) *HealthUsecase {
	return &HealthUsecase{repo: repo}
}

// Check returns the current health snapshot. The optional component filter is
// applied at the service layer (not here) to keep the usecase pure.
func (uc *HealthUsecase) Check(ctx context.Context) (*Health, error) {
	if uc == nil || uc.repo == nil {
		return &Health{Status: "degraded", CheckedAt: time.Now()}, nil
	}
	return uc.repo.Check(ctx)
}

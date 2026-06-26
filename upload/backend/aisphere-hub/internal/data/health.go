// Package data health module — Repo implementation using kit Runtime.
//
// This file follows the AGENTS.md layer contract:
//   - data does NOT import proto/DTO types.
//   - data returns biz domain objects, not proto messages.
//   - data is the ONLY layer that touches kit Runtime fields (rt.SQL, rt.Redis,
//     rt.S3, rt.Casdoor) directly.
//
// We delegate the actual ping logic to aisphere-kit/health.Check(), which
// already knows how to ping every dependency the Runtime initialized. This
// avoids duplicating the ping code and keeps us aligned with kit's health
// semantics (timeout, per-component naming, error formatting).

package data

import (
	"context"
	"time"

	"aisphere-hub/internal/biz"

	kithealth "github.com/actionlab-ai/aisphere-kit/health"
)

// healthRepo implements biz.HealthRepo by delegating to kithealth.Check.
type healthRepo struct {
	data *Data
}

// NewHealthRepo constructs a biz.HealthRepo backed by the shared *Data.
//
// Like every other repo, it accepts *Data (not *starter.Runtime) so wire can
// build a uniform dependency graph: NewRuntimeData -> *Data -> NewXxxRepo.
func NewHealthRepo(data *Data) biz.HealthRepo {
	return &healthRepo{data: data}
}

// Check calls kithealth.Check and maps the result to biz types.
//
// Mapping happens here (not in biz) because the kit health.Result type is a
// data-layer concern; biz should not depend on kit types.
func (r *healthRepo) Check(ctx context.Context) (*biz.Health, error) {
	results := kithealth.Check(ctx, r.data.Runtime)

	h := &biz.Health{
		Status:     "ok",
		CheckedAt:  time.Now().UTC(),
		Components: make([]biz.ComponentStatus, 0, len(results)),
	}
	for _, res := range results {
		d, _ := time.ParseDuration(res.Duration)
		h.Components = append(h.Components, biz.ComponentStatus{
			Name:     res.Name,
			OK:       res.OK,
			Error:    res.Error,
			Duration: d,
		})
		if !res.OK {
			h.Status = "degraded"
		}
	}
	return h, nil
}

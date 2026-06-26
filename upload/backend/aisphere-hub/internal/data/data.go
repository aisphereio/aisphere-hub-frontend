// Package data holds repository implementations backed by the kit Runtime.
//
// Layering contract (AGENTS.md):
//   - data imports: biz (for repo interfaces and domain objects to return),
//     aisphere-kit/* (for Runtime, db, cache, ...), and standard library.
//   - data MUST NOT import: proto/DTO types, service, conf.
//
// Each module's repo lives in its own file:
//   - health.go     (Phase 1, delegates to kithealth.Check)
//   - namespace.go   (Phase 3, uses rt.DB / pgx)
//   - skill.go       (Phase 4)
//   - ...
//
// The Data struct is the single shared entry point for repos that need kit
// Runtime resources (DB, Redis, S3, Casdoor, ...). It is constructed once
// per process by NewRuntimeData, which receives the *starter.Runtime from
// the kit starter (NOT from wire — wire only builds repos on top of Data).

package data

import (
	"context"

	kitconfig "github.com/actionlab-ai/aisphere-kit/config"
	kitstarter "github.com/actionlab-ai/aisphere-kit/starter"
	"github.com/google/wire"
)

// ProviderSet lists all data-layer providers.
//
// NewRuntimeData is the entry point: it receives the kit Runtime from
// app.wireApp (which received it from kitstarter.Serve) and returns *Data.
// Every NewXxxRepo takes *Data and returns the corresponding biz.XxxRepo
// interface.
//
// Adding a new module: append its NewXxxRepo constructor here.
var ProviderSet = wire.NewSet(
	NewRuntimeData,
	NewHealthRepo,
	NewAccessGuard,
	NewPermissionManager,
	NewAuthRepo,
	NewSkillRepo,
	// Namespace migration intentionally skipped. Auth is the first Casdoor-native module.
	// TODO(Phase 4): NewAgentRepo,
	// ...
)

// Data is the shared data-layer container. It holds the kit Runtime so that
// repos needing multiple resources (e.g. DB + Redis + S3 in the same
// transaction) can share a single Data instance instead of accepting each
// resource as a separate constructor argument.
//
// New repos should accept *Data (not *starter.Runtime) when they touch more
// than one resource; single-resource repos can take the resource directly
// (see health.go, which only needs rt itself for kithealth.Check).
type Data struct {
	Runtime *kitstarter.Runtime
}

// NewRuntimeData is the AI Sphere composition path. It is called by wire
// (indirectly, via wireApp) to construct a Data instance shared across repos.
//
// Do NOT open DB/Redis/MinIO here; starter.NewRuntime has already done that
// once for the whole service. We only store the runtime reference.
func NewRuntimeData(ctx context.Context, cfg *kitconfig.Config, rt *kitstarter.Runtime) (*Data, func(), error) {
	if rt != nil && rt.Logger != nil {
		rt.Logger.Info("hub data layer initialized", "app", cfg.App.Name)
	}
	cleanup := func() {}
	return &Data{Runtime: rt}, cleanup, nil
}

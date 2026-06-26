// Package service holds HTTP/gRPC handlers (RPC implementations) that:
//   1. Receive proto DTOs from the kratos transport.
//   2. Convert DTOs to biz domain objects.
//   3. Call the corresponding usecase.
//   4. Convert the returned domain objects back to DTOs.
//
// Layering contract (AGENTS.md):
//   - service imports: api/* (proto DTOs) and biz (domain objects + usecases).
//   - service MUST NOT import: data, conf, or any kit Runtime type.
//
// Each module's service lives in its own file:
//   - health.go     (Phase 1)
//   - namespace.go   (Phase 3)
//   - skill.go       (Phase 4)
//   - ...
//
// ProviderSet aggregates every service constructor. wire uses it to build the
// dependency graph; app.NewApp receives the constructed services and calls
// RegisterHTTPServer on each to mount routes on the kratos HTTP server.

package service

import "github.com/google/wire"

// ProviderSet lists all service-layer providers.
//
// Adding a new module: append its NewXxxService constructor here.
var ProviderSet = wire.NewSet(
	NewHealthService,
	NewAuthService,
	NewSkillService,
	// Namespace migration intentionally skipped. Auth is the first Casdoor-native module.
	// TODO(Phase 4): NewAgentService,
	// ...
)

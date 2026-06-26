// Package biz holds domain objects (DO), repository interfaces, and usecases.
//
// Layering contract (AGENTS.md):
//   - biz imports ONLY: standard library, kratos/errors (for error reason
//     enums), and api/* for proto-generated error reason enums.
//   - biz MUST NOT import: data, service, conf, or any DTO/proto message type
//     other than error-reason enums.
//
// Each business module lives in its own file:
//   - health.go     (Phase 1)
//   - namespace.go   (Phase 3)
//   - skill.go       (Phase 4)
//   - ...
//
// ProviderSet aggregates every usecase constructor in this package. wire uses
// it to build the dependency graph automatically; manual callers (e.g. tests)
// can still construct usecases directly via NewXxxUsecase.

package biz

import "github.com/google/wire"

// ProviderSet lists all usecase providers in the biz layer.
//
// Adding a new module: append its NewXxxUsecase constructor here.
var ProviderSet = wire.NewSet(
	NewHealthUsecase,
	NewAuthUsecase,
	NewSkillUsecase,
	// Namespace migration intentionally skipped. Auth is the first Casdoor-native module.
	// TODO(Phase 4): NewAgentUsecase,
	// ...
)

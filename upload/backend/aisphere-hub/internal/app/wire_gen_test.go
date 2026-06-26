// wire_gen_test.go — Smoke test that exercises the generated wireApp function.
//
// This test does NOT validate business logic; it only ensures that:
//   1. wireApp can be called without panicking (i.e. the dependency graph
//      is complete and there are no missing providers).
//   2. Every expected service is non-nil in the returned AppDeps.
//
// When you add a new module to AppDeps, add an assertion for its field here.
// This catches the common mistake of "I added the field to AppDeps but forgot
// to add the constructor to ProviderSet".

//go:build !wireinject
// +build !wireinject

package app

import (
	"context"
	"testing"

	kitconfig "github.com/actionlab-ai/aisphere-kit/config"
	kitstarter "github.com/actionlab-ai/aisphere-kit/starter"
)

func TestWireApp_AssemblesAllDeps(t *testing.T) {
	ctx := context.Background()

	// Use Default() config with features DB/Cache/S3/etc OFF so NewRuntime
	// doesn't try to connect to anything. The health repo will see nil
	// rt.SQL/Redis/S3 and return "degraded" status, which is fine — we
	// only care that wire assembles the deps without error.
	cfg := kitconfig.Default()
	cfg.App.Name = "test"
	cfg.Features.DB = false
	cfg.Features.Cache = false
	cfg.Features.S3 = false
	cfg.Features.Authn = false
	cfg.Features.Authz = false
	cfg.Features.Audit = false
	cfg.Features.Permission = false
	cfg.Features.Session = false
	cfg.Features.Metrics = false

	rt, cleanup, err := kitstarter.NewRuntime(ctx, cfg)
	if err != nil {
		t.Fatalf("NewRuntime: %v", err)
	}
	defer cleanup()

	deps, depsCleanup, err := wireApp(ctx, cfg, rt)
	if err != nil {
		t.Fatalf("wireApp: %v", err)
	}
	defer depsCleanup()

	if deps == nil {
		t.Fatal("wireApp returned nil AppDeps")
	}

	// Assert every wired service is non-nil. Add a new line per module.
	if deps.Health == nil {
		t.Error("deps.Health is nil; check service.ProviderSet and AppDeps.Health field")
	}
	if deps.Auth == nil {
		t.Error("deps.Auth is nil; check service.ProviderSet and AppDeps.Auth field")
	}
	// TODO(Phase 3): if deps.Namespace == nil { t.Error("deps.Namespace is nil") }
	if deps.Skill == nil {
		t.Error("deps.Skill is nil; check service.ProviderSet and AppDeps.Skill field")
	}
}

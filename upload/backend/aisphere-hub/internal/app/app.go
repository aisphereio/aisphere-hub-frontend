// Package app is the composition root for the kratos+kit backend.
//
// NewApp is called by aisphere-kit-kratos/starter.Serve after the kit Runtime
// has been initialized. It is responsible for:
//
//  1. Calling wireApp(cfg, rt) to auto-wire all business modules into AppDeps.
//     wireApp returns a struct holding every constructed service + a cleanup
//     function. wire handles the dependency graph: NewRuntimeData(rt) ->
//     NewXxxRepo(data) -> NewXxxUsecase(repo) -> NewXxxService(uc).
//  2. Constructing the kratos HTTP server via kitkratosx.NewHTTPServer, which
//     attaches the default middleware chain (recovery, request-id, authn,
//     authz, metrics, audit) and /livez + /readyz automatically.
//  3. Iterating over deps and calling each service's RegisterHTTPServer(srv)
//     to mount its routes.
//  4. Returning a *kratos.App whose lifecycle (Run + graceful shutdown) is
//     managed by the starter.
//
// ADDING A NEW MODULE: see PHASE2-C-ARCHITECTURE.md, section "Adding a new
// module in 4 steps". In short: write biz/data/service files + append one
// entry to each layer's ProviderSet + run `make wire`. This file does NOT
// need to change for new modules (unless they need cross-module wiring).

package app

import (
	"context"
	"fmt"

	kitkratosx "github.com/actionlab-ai/aisphere-kit-kratos/kratosx"
	kitkratosmw "github.com/actionlab-ai/aisphere-kit-kratos/middleware"
	kitconfig "github.com/actionlab-ai/aisphere-kit/config"
	kitstarter "github.com/actionlab-ai/aisphere-kit/starter"
	"github.com/go-kratos/kratos/v3"

	"aisphere-hub/internal/service"
)

// AppDeps is the container of all wired business services. wireApp returns
// this struct; app.NewApp iterates over its fields to register routes.
//
// Every field is a pointer to a service struct that implements:
//
//	RegisterHTTPServer(*khttp.Server)
//
// Adding a new module: add a field here of type *service.XxxService.
type AppDeps struct {
	Health *service.HealthService
	Auth   *service.AuthService
	Skill  *service.SkillService
	// Namespace migration intentionally skipped. Auth is the first Casdoor-native module.
	// TODO(Phase 3): Namespace *service.NamespaceService
	// TODO(Phase 4): Agent *service.AgentService
	// ...
}

// NewApp constructs the kratos application. It is invoked by
// kratosstarter.Serve after the kit Runtime has been initialized.
//
// Signature must match kratosstarter.AppFactory:
//
//	func(ctx context.Context, cfg *kitconfig.Config, rt *kitstarter.Runtime) (*kratos.App, func(), error)
func NewApp(ctx context.Context, cfg *kitconfig.Config, rt *kitstarter.Runtime) (*kratos.App, func(), error) {
	if cfg == nil {
		return nil, nil, fmt.Errorf("kit config is nil")
	}
	if rt == nil {
		return nil, nil, fmt.Errorf("kit runtime is nil")
	}

	// Auto-wire every business module. wireApp is implemented in wire.go
	// (wireinject build tag) and generated into wire_gen.go (!wireinject).
	// The generated function calls every NewXxxRepo/Usecase/Service in
	// topological order and returns the assembled AppDeps + cleanup func.
	deps, depsCleanup, err := wireApp(ctx, cfg, rt)
	if err != nil {
		return nil, nil, fmt.Errorf("wire app: %w", err)
	}

	// Build the HTTP server. kitkratosx.NewHTTPServer reads cfg.Server.HTTP
	// (addr, timeout) and attaches the default middleware chain + /livez
	// + /readyz automatically.
	httpSrv := kitkratosx.NewHTTPServer(cfg, rt,
		kitkratosx.WithMiddlewares(
			kitkratosmw.WithChainAuthnSkip(
				kitkratosmw.SkipOperationPrefixes(
					"/api.health.v1.HealthService/Check",
					"/api.auth.v1.AuthService/LoginURL",
					"/api.auth.v1.AuthService/Exchange",
					"/api.auth.v1.AuthService/Refresh",
					"/api.auth.v1.AuthService/LogoutURL",
				),
			),
			kitkratosmw.WithChainAuditSkip(
				kitkratosmw.SkipOperationPrefixes(
					"/api.health.v1.HealthService/Check",
				),
			),
		),
	)

	// gRPC server is intentionally disabled in Phase 1. Enable it once any
	// business module requires gRPC streaming or RPC-only operations that
	// do not map cleanly onto REST.
	//
	// grpcSrv := kitkratosx.NewGRPCServer(cfg, rt)

	// Register HTTP routes for every wired module. Add a new module by:
	//   1. Adding a field to AppDeps.
	//   2. Appending its constructor to service.ProviderSet.
	//   3. Calling deps.Xxx.RegisterHTTPServer(httpSrv) here.
	//
	// This block is the ONLY place that grows linearly with module count;
	// it stays mechanical and low-risk.
	deps.Health.RegisterHTTPServer(httpSrv)
	deps.Auth.RegisterHTTPServer(httpSrv)
	deps.Skill.RegisterHTTPServer(httpSrv)
	// TODO(Phase 3): deps.Namespace.RegisterHTTPServer(httpSrv)
	// TODO(Phase 4): deps.Agent.RegisterHTTPServer(httpSrv)

	// Build the kratos App. kratos.New wires the servers together and
	// returns an object whose Run() blocks until SIGINT/SIGTERM.
	app := kratos.New(
		kratos.Context(ctx),
		kratos.Name(cfg.App.Name),
		kratos.Server(httpSrv),
		// kratos.Server(grpcSrv),
	)

	// Cleanup is invoked by the starter after app.Run() returns. We chain
	// the deps cleanup (which closes per-module resources created by wire)
	// ahead of the runtime cleanup (handled by the starter separately).
	cleanup := func() {
		if depsCleanup != nil {
			depsCleanup()
		}
	}

	return app, cleanup, nil
}

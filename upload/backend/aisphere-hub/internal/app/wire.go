//go:build wireinject
// +build wireinject

// wire.go — Wire injector definition (only compiled when build tag "wireinject"
// is set, i.e. when running `wire ./...` to (re)generate wire_gen.go).
//
// To regenerate:  make wire   (or `go run github.com/google/wire/cmd/wire ./internal/app`)
// To clean regen:  make clean-wire
//
// Do NOT edit wire_gen.go by hand. It is overwritten on every `wire` run.

package app

import (
	"context"

	kitconfig "github.com/actionlab-ai/aisphere-kit/config"
	kitstarter "github.com/actionlab-ai/aisphere-kit/starter"
	"github.com/google/wire"

	"aisphere-hub/internal/biz"
	"aisphere-hub/internal/data"
	"aisphere-hub/internal/service"
)

// wireApp is the injector entry point. wire.Build receives every layer's
// ProviderSet plus a struct provider for AppDeps (so wire knows how to
// assemble the output struct from individual service providers).
//
// The signature is the contract app.NewApp relies on:
//
//	func(ctx, cfg *kitconfig.Config, rt *kitstarter.Runtime) (*AppDeps, func(), error)
//
// Adding a new module does NOT require touching this function — just append
// the constructor to the relevant ProviderSet in biz/data/service, add a
// field to AppDeps, and re-run `make wire`.
func wireApp(ctx context.Context, cfg *kitconfig.Config, rt *kitstarter.Runtime) (*AppDeps, func(), error) {
	panic(wire.Build(
		data.ProviderSet,
		biz.ProviderSet,
		service.ProviderSet,
		// Tell wire to construct *AppDeps by matching each field to a
		// provider of the same type. "*" means "all fields"; wire will
		// fail at generation time if any field has no matching provider.
		wire.Struct(new(AppDeps), "*"),
	))
}

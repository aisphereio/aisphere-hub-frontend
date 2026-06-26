# aisphere-hub backend (kratos+kit) Makefile
#
# Targets:
#   init       - install code generators (buf, protoc-gen-go, -go-grpc, -go-http, -openapi, wire)
#   api        - generate api/*.pb.go from api/**/*.proto
#   wire       - regenerate internal/app/wire_gen.go from wire.go
#   build      - compile all Go packages into ./bin/
#   run        - run the kratos+kit entry point locally
#   test       - run all unit tests
#   tidy       - go mod tidy
#   clean      - remove generated files and binaries
#   clean-wire - remove wire_gen.go only (force regen on next build)
#
# Windows note: this Makefile is invoked via `make` from a shell that has
# Go's bin directory on PATH. On Windows use Git Bash or WSL; `make` is
# available via `choco install make` if not present.

VERSION ?= $(shell git describe --tags --always --dirty 2>/dev/null || echo dev)
GO      ?= go

.PHONY: init api wire build run test tidy clean clean-wire help

help:
	@echo "Available targets:"
	@echo "  init        Install buf + protoc + wire generators"
	@echo "  api         Generate api/*.pb.go from proto files"
	@echo "  wire        Regenerate internal/app/wire_gen.go"
	@echo "  build       Compile all packages"
	@echo "  run         Run the kratos+kit entry point"
	@echo "  test        Run unit tests"
	@echo "  tidy        go mod tidy"
	@echo "  clean       Remove generated files and binaries"
	@echo "  clean-wire  Remove wire_gen.go only"

init:
	$(GO) install github.com/bufbuild/buf/cmd/buf@latest
	$(GO) install google.golang.org/protobuf/cmd/protoc-gen-go@latest
	$(GO) install google.golang.org/grpc/cmd/protoc-gen-go-grpc@latest
	$(GO) install github.com/go-kratos/kratos/cmd/protoc-gen-go-http/v3@latest
	$(GO) install github.com/google/gnostic/cmd/protoc-gen-openapi@latest
	$(GO) install github.com/google/wire/cmd/wire@v0.7.0
	@echo "All generators installed. Verify with: buf --version && wire help"

api:
	buf dep update
	buf generate --template buf.gen.yaml
	@echo "API code generated under api/"

wire:
	$(GO) run -mod=mod github.com/google/wire/cmd/wire@v0.7.0 ./internal/app/
	@echo "wire_gen.go regenerated"

build:
	mkdir -p bin/
	$(GO) build -ldflags "-X main.Version=$(VERSION)" -o ./bin/ ./cmd/aispherehub

run:
	$(GO) run ./cmd/aispherehub

test:
	$(GO) test ./...

tidy:
	$(GO) mod tidy

clean:
	rm -rf bin/
	find api -name '*.pb.go' -delete
	find api -name '*_grpc.pb.go' -delete
	find api -name '*_http.pb.go' -delete
	rm -f api/openapi.yaml
	rm -f internal/app/wire_gen.go

clean-wire:
	rm -f internal/app/wire_gen.go
	@echo "wire_gen.go removed; run 'make wire' to regenerate"

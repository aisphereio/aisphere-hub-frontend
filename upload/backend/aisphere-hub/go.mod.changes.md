# go.mod changes — apply manually (do NOT overwrite the existing go.mod)

## Required new imports

Add these to the `require (...)` block:

```
github.com/actionlab-ai/aisphere-kit v0.1.0-pg-fix
github.com/actionlab-ai/aisphere-kit-kratos v0.1.0
github.com/go-kratos/kratos/v3 v3.0.0-20260515082355-1ddb58e407c5
```

## Required replace directives (local dev mode)

Add these to the `replace (...)` block (create one if missing). Adjust the
relative paths to match your local checkout layout:

```
replace (
    github.com/actionlab-ai/aisphere-kit => ../aisphere-kit
    github.com/actionlab-ai/aisphere-kit-kratos => ../aisphere-kit-kratos

    // kratos v3 currently ships as pseudo-versions; pin to a known-good one.
    github.com/go-kratos/kratos/v3 => github.com/go-kratos/kratos/v3 v3.0.0-20260515082355-1ddb58e407c5
)
```

## Required import path comment

If your go.mod currently uses module path
`github.com/actionlab-ai/aisphere-hub/backend`, you can keep it as-is.
All new code under cmd/aispherehub, internal/app, api/ uses that module path.

## After editing go.mod

```bash
go mod tidy
go build ./cmd/aispherehub
```

If `go mod tidy` fails to resolve the kratos pseudo-version, run:

```bash
go get github.com/go-kratos/kratos/v3@v3.0.0-20260515082355-1ddb58e407c5
go mod tidy
```

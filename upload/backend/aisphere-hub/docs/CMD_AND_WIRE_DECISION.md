# CMD 与 Wire 统一决策

## 最终入口

本项目只保留一个运行入口：

```text
cmd/aispherehub
```

旧 Kratos 模板入口 `cmd/aisphere-hub` 已删除。后续不要再恢复 `cmd/aisphere-hub/wire.go` 或 `wire_gen.go`。

## 启动

```bash
go run ./cmd/aispherehub
```

## Wire

Wire 只生成：

```text
internal/app/wire_gen.go
```

不会再生成 `cmd/*/wire_gen.go`。

Makefile 使用固定版本：

```bash
go run -mod=mod github.com/google/wire/cmd/wire@v0.7.0 ./internal/app/
```

第一次执行会下载 Wire 及其依赖，并写入 go.sum；之后会复用本地 module cache，不需要每次手工 `go get`。

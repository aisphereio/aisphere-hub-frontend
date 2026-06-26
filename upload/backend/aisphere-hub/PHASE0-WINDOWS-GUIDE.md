# Phase 0 协同操作指南（Windows）

> 这份指南告诉你**你**在 Windows 上要做的事，以及做完后**怎么反馈给我**。
> 我（Super Z）会基于你的反馈继续 Phase 1。

## 你需要做的事（按顺序）

### Step 1: 把 kit 和 kit-kratos 放到本地

把两个仓库 clone 到你 Windows 工作目录的**同级**：

```
C:\code\aisphere-hub\backend\         ← 这个就是要改造的 backend
C:\code\aisphere-hub\aisphere-kit\    ← 你刚改好的 pg-fix 版
C:\code\aisphere-hub\aisphere-kit-kratos\
```

> 如果你的目录布局不一样，调整 `go.mod` 里的 `replace` 相对路径即可。

### Step 2: 解压骨架文件

把 `/home/z/my-project/download/backend-kratos-skeleton.zip` 下载下来，解压到 `C:\code\aisphere-hub\backend\`，文件会落到：

```
backend\
├── api\health\v1\health.proto          ← 新增
├── cmd\aispherehub\main.go             ← 新增（新入口）
├── configs\config.kratos.yaml          ← 新增
├── internal\app\app.go                 ← 新增（组合根）
├── buf.yaml                            ← 新增
├── buf.gen.yaml                        ← 新增
├── Makefile                            ← 新增（或与现有合并）
├── go.mod.changes.md                   ← 新增（参考文档）
└── .gitignore.append                   ← 新增（追加到现有 .gitignore）
```

旧的 `cmd/skillhub/`、`internal/api/`、`internal/service/` 等**全部保留不动**，新旧并存。

### Step 3: 应用 go.mod 改动

打开 `go.mod.changes.md`，按说明修改 `backend/go.mod`：

1. 在 `require (...)` 块加三个新依赖
2. 加 `replace (...)` 块指向本地 kit 和 kit-kratos
3. 命令行执行：

```powershell
cd C:\code\aisphere-hub\backend
go mod tidy
```

如果 `go mod tidy` 报错找不到 kratos 包，单独拉一下：

```powershell
go get github.com/go-kratos/kratos/v3@v3.0.0-20260515082355-1ddb58e407c5
go mod tidy
```

### Step 4: 安装代码生成工具

```powershell
cd C:\code\aisphere-hub\backend
make init
```

或者手动逐条执行（如果没装 make）：

```powershell
go install github.com/bufbuild/buf/cmd/buf@latest
go install google.golang.org/protobuf/cmd/protoc-gen-go@latest
go install google.golang.org/grpc/cmd/protoc-gen-go-grpc@latest
go install github.com/go-kratos/kratos/cmd/protoc-gen-go-http/v3@latest
go install github.com/google/gnostic/cmd/protoc-gen-openapi@latest
```

确认 `%GOPATH%\bin`（通常是 `C:\Users\你\go\bin`）在 PATH 里。验证：

```powershell
buf --version
protoc-gen-go --version
```

### Step 5: 生成 proto 代码（关键验证步骤）

```powershell
cd C:\code\aisphere-hub\backend
make api
```

或者手动：

```powershell
buf dep update
buf generate --template buf.gen.yaml
```

**预期产物**：

```
api\health\v1\
├── health.proto              ← 你的源文件
├── health.pb.go              ← protoc-gen-go 生成
├── health_grpc.pb.go         ← protoc-gen-go-grpc 生成
└── health_http.pb.go         ← protoc-gen-go-http 生成
api\openapi.yaml              ← protoc-gen-openapi 生成
```

### Step 6: 写一个空的 HealthService 实现（让骨架能编译）

我**没有**在骨架包里写 `internal/service/health.go`，因为：
1. 这个文件需要 import 生成的 `healthv1` 包
2. 在你跑完 `make api` 之前无法 import（包还不存在）
3. 这是个非常适合你跑完 `make api` 之后**立刻验证编译**的环节

跑完 `make api` 后，**告诉我**，我会立刻产出 `internal/service/health.go` 让骨架能编译通过。

### Step 7: 反馈给我

把以下信息反馈给我，我就启动 Phase 1 收尾：

1. `make api` 是否成功？如果失败，**完整**贴出报错（特别是 buf 报的错）
2. 生成的文件列表（`dir api\health\v1\` 的输出）
3. 当前 `go.mod` 里 kratos 和 kit 的实际版本（`go list -m all | findstr kratos` 和 `go list -m all | findstr aisphere-kit`）
4. `go build ./...` 是否通过？如果失败贴报错

---

## 可能遇到的问题

### Q1: `buf dep update` 报网络错误

中国境内访问 `buf.build` 可能慢。两种解决方案：

**A. 配置 GOPROXY 后重试**：
```powershell
$env:GOPROXY = "https://goproxy.cn,direct"
buf dep update
```

**B. 离线模式**：把 `google/api/annotations.proto` 和 `google/api/http.proto` 手动下载到 `api/third_party/google/api/`，然后修改 `buf.yaml` 不依赖 BSR：

```yaml
# buf.yaml
version: v2
modules:
  - path: api
# 删除 deps 段
```

然后在 `api/health/v1/health.proto` 的 import 改成本地路径：
```proto
import "third_party/google/api/annotations.proto";
```

告诉我你选哪种，我给你适配。

### Q2: `protoc-gen-go-http` 找不到

kratos v3 的 `protoc-gen-go-http` 还没正式 tag，可能装不到。两种方案：

**A. 用最新 main 分支**：
```powershell
go install github.com/go-kratos/kratos/cmd/protoc-gen-go-http/v3@latest
```

**B. 用 kratos v2 的插件兼容**（HTTP 注解格式一样）：
```powershell
go install github.com/go-kratos/kratos/cmd/protoc-gen-go-http/v2@latest
```

如果 v2 装上了，需要把 `buf.gen.yaml` 里的 `protoc-gen-go-http` 改成 `protoc-gen-go-http-v2`（plugin name 不同）。告诉我装的是哪个版本，我适配配置。

### Q3: `go build` 报 `import cycle` 或 `undefined: app.NewApp`

我骨架里的 `internal/app/app.go` 引用了 `api/health/v1` 包来强制使用生成代码。在你跑完 `make api` 之前它会编译失败。**这是预期的** — 跑完 `make api` 后告诉我，我立刻给一个最小化的 `internal/service/health.go` 让它编译通过。

### Q4: `go mod tidy` 拉不下 kratos

试这个：
```powershell
$env:GOPROXY = "https://goproxy.cn,direct"
$env:GOSUMDB = "off"
go mod tidy
```

---

## 我会在你反馈后做的事

### 假设你 `make api` 成功

我立刻产出：
1. `internal/service/health.go` — 最小化 HealthService 实现
2. （如有必要）修补 `internal/app/app.go` 让它正确注册 health handler
3. `internal/biz/health.go` + `internal/data/health.go` — 演示 kratos 4 层结构（即使 health 这么简单也按 4 层走，给后续模块做模板）

然后你 `go build ./cmd/aispherehub` 应该通过，`go run ./cmd/aispherehub` 应该能起来，访问 `http://localhost:8848/livez`、`http://localhost:8848/readyz`、`http://localhost:8848/v3/aihub/health` 应该都有响应。这就是 **Phase 1 完成**。

### 假设你 `make api` 失败

我根据你的报错调整 `buf.yaml` / `buf.gen.yaml` / `health.proto`，给你新的 patch 文件，你重新跑。

---

## 我们俩的节奏

```
[你] Step 1-4 装环境         → 反馈"环境就绪"
[我] 等待
[你] Step 5 make api          → 反馈成功/失败
[我] 产出 service/biz/data 代码 → 发给你
[你] go build / go run        → 反馈启动结果
[我] 诊断 → Phase 1 完成
[我] 进入 Phase 2 中间件迁移方案
```

每次反馈请包含**完整的命令输出**（不要省略报错），这样我能精准定位问题。

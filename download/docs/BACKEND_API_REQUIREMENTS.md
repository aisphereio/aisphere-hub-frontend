# SkillHub 后端接口需求规范 — 缺失接口补充

> 本文档列出前端在全面排查中识别出的、当前后端（`aisphere-hub/api/skill/v1/skill.proto` + `auth/v1/auth.proto`）尚未提供的接口。
>
> **复用原则**：后端已有的接口，前端已直接复用，不再重复定义。
> **新增原则**：所有新增接口均沿用现有的 RESTful 风格（`/v3/aihub/...`），使用 protobuf 描述、kratos 实现，遵循 aisphere-kit 的 access guard + permission manager 模式。

---

## 1. SkillSet Service（全新）

后端目前完全缺失 SkillSet（skill 分组集合）模块。前端已基于 RESTful 约定调用 `/v3/aihub/skillsets/...`，需新增 `SkillSetService`。

### 1.1 数据模型

```protobuf
message SkillSet {
  int64 id = 1;
  string name = 2;              // 全局唯一 ID，资源 ID 规则：[a-z0-9][a-z0-9_-]{0,62}
  string display_name = 3;
  string description = 4;
  string owner_id = 5;
  string org_id = 6;
  string project_id = 7;
  string visibility = 8;        // private | public
  map<string, string> labels = 9;
  repeated SkillSetMember members = 10;
  int64 download_count = 11;
  google.protobuf.Timestamp create_time = 12;
  google.protobuf.Timestamp update_time = 13;
}

message SkillSetMember {
  string skill_name = 1;
  string version = 2;           // 可选：锁定到具体版本；空表示跟随 stable label
  string label = 3;             // 可选：stable / latest / canary / 自定义
  bool required = 4;            // 是否必需（runtime 解析时若缺失则报错）
  int32 order = 5;              // 在 SkillSet 内的展示顺序
}
```

### 1.2 Service 定义

```protobuf
service SkillSetService {
  // 创建 SkillSet
  rpc CreateSkillSet(CreateSkillSetRequest) returns (SkillSet) {
    option (google.api.http) = {
      post: "/v3/aihub/skillsets"
      body: "*"
    };
  }

  // 更新 SkillSet 元信息（不含 members）
  rpc UpdateSkillSet(UpdateSkillSetRequest) returns (SkillSet) {
    option (google.api.http) = {
      put: "/v3/aihub/skillsets/{name}"
      body: "*"
    };
  }

  // 列出 SkillSet
  rpc ListSkillSets(ListSkillSetsRequest) returns (ListSkillSetsResponse) {
    option (google.api.http) = {
      get: "/v3/aihub/skillsets"
    };
  }

  // 获取单个 SkillSet（含 members）
  rpc GetSkillSet(GetSkillSetRequest) returns (SkillSet) {
    option (google.api.http) = {
      get: "/v3/aihub/skillsets/{name}"
    };
  }

  // 删除 SkillSet（仅删除分组本身，不删 skills）
  rpc DeleteSkillSet(DeleteSkillSetRequest) returns (google.protobuf.Empty) {
    option (google.api.http) = {
      delete: "/v3/aihub/skillsets/{name}"
    };
  }

  // 添加 skill 到 SkillSet（若已存在则更新）
  rpc BindSkillSetMember(BindSkillSetMemberRequest) returns (SkillSetMember) {
    option (google.api.http) = {
      post: "/v3/aihub/skillsets/{name}/members"
      body: "*"
    };
  }

  // 更新成员属性（label/required/order）
  rpc UpdateSkillSetMember(UpdateSkillSetMemberRequest) returns (SkillSetMember) {
    option (google.api.http) = {
      put: "/v3/aihub/skillsets/{name}/members/{skill_name}"
      body: "*"
    };
  }

  // 从 SkillSet 中移除 skill
  rpc UnbindSkillSetMember(UnbindSkillSetMemberRequest) returns (google.protobuf.Empty) {
    option (google.api.http) = {
      delete: "/v3/aihub/skillsets/{name}/members/{skill_name}"
    };
  }

  // 反查：列出包含指定 skill 的所有 SkillSet
  rpc ListSkillSetsOfSkill(ListSkillSetsOfSkillRequest) returns (ListSkillSetsOfSkillResponse) {
    option (google.api.http) = {
      get: "/v3/aihub/skills/{name}/skillsets"
    };
  }
}
```

### 1.3 请求 / 响应消息

```protobuf
message CreateSkillSetRequest {
  string name = 1 [(google.api.field_behavior) = REQUIRED];
  string display_name = 2;
  string description = 3;
  string visibility = 4;
  map<string, string> labels = 5;
}

message UpdateSkillSetRequest {
  string name = 1 [(google.api.field_behavior) = REQUIRED];
  string display_name = 2;
  string description = 3;
  string visibility = 4;
  map<string, string> labels = 5;
}

message ListSkillSetsRequest {
  int32 page_size = 1;
  string page_token = 2;
  string q = 3;                 // 模糊匹配 name / display_name / description
  string visibility = 4;
  string owner_id = 5;
}

message ListSkillSetsResponse {
  repeated SkillSet skillsets = 1;
  string next_page_token = 2;
}

message GetSkillSetRequest {
  string name = 1 [(google.api.field_behavior) = REQUIRED];
}

message DeleteSkillSetRequest {
  string name = 1 [(google.api.field_behavior) = REQUIRED];
}

message BindSkillSetMemberRequest {
  string name = 1 [(google.api.field_behavior) = REQUIRED];
  string skill_name = 2 [(google.api.field_behavior) = REQUIRED];
  string version = 3;
  string label = 4;
  bool required = 5;
  int32 order = 6;
}

message UpdateSkillSetMemberRequest {
  string name = 1 [(google.api.field_behavior) = REQUIRED];
  string skill_name = 2 [(google.api.field_behavior) = REQUIRED];
  string version = 3;
  string label = 4;
  bool required = 5;
  int32 order = 6;
}

message UnbindSkillSetMemberRequest {
  string name = 1 [(google.api.field_behavior) = REQUIRED];
  string skill_name = 2 [(google.api.field_behavior) = REQUIRED];
}

message ListSkillSetsOfSkillRequest {
  string name = 1 [(google.api.field_behavior) = REQUIRED];
}

message ListSkillSetsOfSkillResponse {
  repeated string skillsets = 1;
}
```

### 1.4 权限模型（与现有 Skill 模块对齐）

| Action                  | Resource                    | 说明                          |
|-------------------------|-----------------------------|-------------------------------|
| `skillset.list`         | `aihub:skillset:*`          | 列出 SkillSet                 |
| `skillset.read`         | `aihub:skillset:{name}`     | 查看单个 SkillSet             |
| `skillset.create`       | `aihub:skillset:*`          | 创建 SkillSet                |
| `skillset.update`       | `aihub:skillset:{name}`     | 更新元信息                    |
| `skillset.delete`       | `aihub:skillset:{name}`     | 删除 SkillSet                |
| `skillset.member.bind`  | `aihub:skillset:{name}`     | 添加成员                      |
| `skillset.member.update`| `aihub:skillset:{name}`     | 修改成员属性                  |
| `skillset.member.unbind`| `aihub:skillset:{name}`     | 移除成员                      |

### 1.5 数据库迁移示例

```sql
CREATE TABLE IF NOT EXISTS aihub_skillsets (
  id BIGSERIAL PRIMARY KEY,
  name VARCHAR(128) NOT NULL,
  display_name VARCHAR(256) NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  owner_id VARCHAR(128) NOT NULL DEFAULT '',
  org_id VARCHAR(128) NOT NULL DEFAULT '',
  project_id VARCHAR(128) NOT NULL DEFAULT '',
  visibility VARCHAR(32) NOT NULL DEFAULT 'private',
  labels JSONB NOT NULL DEFAULT '{}'::jsonb,
  download_count BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  CONSTRAINT uq_aihub_skillsets_name UNIQUE (name)
);

CREATE TABLE IF NOT EXISTS aihub_skillset_members (
  id BIGSERIAL PRIMARY KEY,
  skillset_name VARCHAR(128) NOT NULL,
  skill_name VARCHAR(128) NOT NULL,
  version VARCHAR(64) NOT NULL DEFAULT '',
  label VARCHAR(32) NOT NULL DEFAULT '',
  required BOOLEAN NOT NULL DEFAULT false,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  CONSTRAINT uq_aihub_skillset_members_skillset_skill UNIQUE (skillset_name, skill_name)
);

CREATE INDEX idx_aihub_skillset_members_skillset ON aihub_skillset_members(skillset_name);
CREATE INDEX idx_aihub_skillset_members_skill ON aihub_skillset_members(skill_name);
```

---

## 2. Skill 文件 CRUD 接口（在现有 SkillService 上扩展）

后端目前只有 `ListSkillVersionFiles` 和 `GetSkillVersionFile`，前端只能查看文件，无法编辑、创建、删除、重命名。需扩展 `SkillService`。

> **设计约束**：所有写操作只能作用于 `status=draft` 的版本。已 published / online 的版本不可直接编辑，需通过 `EnsureDraftVersion` 派生一个草稿版本后才能修改。

### 2.1 新增 RPC

```protobuf
service SkillService {
  // ... existing RPCs ...

  // 创建/更新单个文本文件（PUT 语义：存在则覆盖，不存在则创建）
  rpc SaveSkillVersionFile(SaveSkillVersionFileRequest) returns (SkillFile) {
    option (google.api.http) = {
      put: "/v3/aihub/skills/{name}/versions/{version}/files/{path=**}"
      body: "*"
    };
  }

  // 新建空文件或目录
  rpc CreateSkillVersionFile(CreateSkillVersionFileRequest) returns (SkillFile) {
    option (google.api.http) = {
      post: "/v3/aihub/skills/{name}/versions/{version}/files"
      body: "*"
    };
  }

  // 删除文件或目录（删除目录时递归删除其下文件）
  rpc DeleteSkillVersionFile(DeleteSkillVersionFileRequest) returns (google.protobuf.Empty) {
    option (google.api.http) = {
      delete: "/v3/aihub/skills/{name}/versions/{version}/files/{path=**}"
    };
  }

  // 重命名 / 移动文件或目录
  rpc RenameSkillVersionFile(RenameSkillVersionFileRequest) returns (SkillFile) {
    option (google.api.http) = {
      post: "/v3/aihub/skills/{name}/versions/{version}/files/{path=**}:rename"
      body: "*"
    };
  }

  // 确保存在一个可编辑的草稿版本；如果当前已是草稿版本则原样返回，
  // 否则基于 base_version（或 stable）派生一个新的草稿版本。
  rpc EnsureDraftVersion(EnsureDraftVersionRequest) returns (EnsureDraftVersionResponse) {
    option (google.api.http) = {
      post: "/v3/aihub/skills/{name}/versions:ensure-draft"
      body: "*"
    };
  }
}
```

### 2.2 请求 / 响应消息

```protobuf
message SaveSkillVersionFileRequest {
  string name = 1 [(google.api.field_behavior) = REQUIRED];
  string version = 2 [(google.api.field_behavior) = REQUIRED];
  string path = 3 [(google.api.field_behavior) = REQUIRED];
  string content = 4;
  string commit_msg = 5;
}

message CreateSkillVersionFileRequest {
  string name = 1 [(google.api.field_behavior) = REQUIRED];
  string version = 2 [(google.api.field_behavior) = REQUIRED];
  string path = 3 [(google.api.field_behavior) = REQUIRED];
  string type = 4;              // "file" | "dir"
  string content = 5;
}

message DeleteSkillVersionFileRequest {
  string name = 1 [(google.api.field_behavior) = REQUIRED];
  string version = 2 [(google.api.field_behavior) = REQUIRED];
  string path = 3 [(google.api.field_behavior) = REQUIRED];
}

message RenameSkillVersionFileRequest {
  string name = 1 [(google.api.field_behavior) = REQUIRED];
  string version = 2 [(google.api.field_behavior) = REQUIRED];
  string path = 3 [(google.api.field_behavior) = REQUIRED];   // 旧路径
  string new_path = 4 [(google.api.field_behavior) = REQUIRED];
}

message EnsureDraftVersionRequest {
  string name = 1 [(google.api.field_behavior) = REQUIRED];
  string base_version = 2;      // 可选；不指定时优先使用 stable，再回退到 latest
}

message EnsureDraftVersionResponse {
  string version = 1;
  bool created = 2;             // true 表示新派生了一个草稿；false 表示复用已有的草稿
}
```

### 2.3 业务规则

1. **版本状态校验**：写操作（Save/Create/Delete/Rename）执行前，必须校验 `version.status == "draft"`。否则返回 `FAILED_PRECONDITION: version is not draft`。
2. **路径合法性**：`path` 必须为相对路径（不能以 `/` 开头），不能包含 `..`，路径段不能为空。
3. **路径冲突**：
   - `CreateSkillVersionFile` 创建目录时，若已有同名文件/目录，返回 `ALREADY_EXISTS`。
   - `RenameSkillVersionFile` 目标路径若已存在，返回 `ALREADY_EXISTS`。
4. **目录删除**：`DeleteSkillVersionFile` 删除目录时，必须递归删除目录下所有文件（DB 事务）。
5. **重计算校验和**：每次 Save/Create/Delete/Rename 后，必须重新计算 version 的 `md5` / `sha256` / `size_bytes`，并更新 `updated_at`。
6. **审计**：所有写操作必须经 `access.Guard` 校验并 emit audit 事件。
7. **权限**：复用现有 `skill.update` action，不再新增。

### 2.4 数据库迁移

无需新建表，复用 `aihub_skill_files`。可补一个 partial index 加速 draft 版本的文件列举：

```sql
CREATE INDEX IF NOT EXISTS idx_aihub_skill_files_draft
  ON aihub_skill_files(skill_name, version)
  WHERE deleted_at IS NULL;
```

---

## 3. Auth Service 补充说明

`auth.proto` 中已经定义了 `Refresh` 和 `LogoutURL`，但当前 service 实现（`internal/service/auth.go`）需要确认：

1. **`/v3/auth/refresh`**：前端 `client.ts` 已实现 401 自动 refresh 逻辑（`refreshAccessToken()`），需要后端同时接受 `refreshToken` (camelCase) 和 `refresh_token` (snake_case)。前端已发送两份字段，请保持兼容。
2. **`/v3/auth/logout`**：前端登出时浏览器会跳转到 `/v3/auth/logout?post_logout_redirect_uri=...&id_token_hint=...`，需要后端注册一个 302 路由（类似 `/v3/auth/login`）调用 Casdoor 的 end_session_endpoint。
3. **`/v3/auth/me`**：建议返回结构包含 `principal` 字段（嵌套对象），同时为了向后兼容，也平铺关键字段（`subjectId`, `displayName`, `email`, `roles`, `groups`, `avatar`, `orgId`, `projectId`, `namespaces`, `permissions`）。

---

## 4. 用户偏好持久化（可选，未来增强）

如果需要在前端持久化用户偏好（主题、语言、最近访问的 Skill / SkillSet），建议新增：

```protobuf
service UserPrefsService {
  rpc GetUserPrefs(GetUserPrefsRequest) returns (UserPrefs) {
    option (google.api.http) = { get: "/v3/aihub/user/prefs" };
  }
  rpc UpdateUserPrefs(UpdateUserPrefsRequest) returns (UserPrefs) {
    option (google.api.http) = { put: "/v3/aihub/user/prefs" body: "*" };
  }
}

message UserPrefs {
  string theme = 1;             // light | dark | system
  string locale = 2;            // zh | en
  string default_namespace = 3;
  repeated string recent_skills = 4;
  repeated string recent_skillsets = 5;
  google.protobuf.Timestamp update_time = 6;
}
```

> 当前实现：前端用 `localStorage`，无需后端。如需多端同步，再按此规范实现。

---

## 5. 验收 Checklist

- [ ] `proto/skillset/v1/skillset.proto` 已生成
- [ ] `SkillSetService` 实现并注册到 HTTP/gRPC server
- [ ] 数据库迁移 `000005_create_aihub_skillsets.sql` 已应用
- [ ] Skill 文件 CRUD RPC 已加入 `skill.proto` 并实现
- [ ] 写操作均校验 `version.status == "draft"`
- [ ] 写操作均经 `access.Guard` 校验并审计
- [ ] `/v3/auth/logout` 注册为 302 路由
- [ ] `/v3/auth/me` 返回 `principal` 嵌套对象 + 平铺字段
- [ ] 单元测试：CRUD、权限、状态机、并发
- [ ] 集成测试：前端 e2e 跑通"新建 skill → 编辑文件 → 保存 → 提交 → 发布"完整链路

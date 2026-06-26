# Worklog — SkillHub Console 全面优化

---
Task ID: ALL
Agent: main
Task: 全面排查并优化前端 SkillHub Console，重点是 Skill 编辑器、SkillSet 分组、用户信息、登录/退出

## Work Log

### 1. 前端代码迁移与依赖安装
- 解压 `front.zip`，迁移所有 src/* 文件到 `/home/z/my-project/src/`
- 安装缺失的依赖：`@uiw/react-codemirror`、`@codemirror/*`、`remark-gfm`
- 修复 `tsconfig.json` 排除 upload/examples/skills/mini-services 目录
- 通过 `bunx tsc --noEmit` 验证 TypeScript 编译通过

### 2. API/Types 扩展（`src/lib/api/`）
- `types.ts`：为 `Skill` 类型新增 `skillsets` 字段（之前导致 TypeScript 报错）
- `client.ts` 重写：
  - 新增 `getRefreshToken`、`getIdToken`、`getTokenExpiresAt`、`isTokenExpiring`
  - 新增 `registerRefreshFn` + `refreshAccessToken` 实现 401 自动 refresh（带去重，避免并发风暴）
  - 新增 `onAuthEvent` + `emitAuth` 事件机制（用于 401 强制登出通知）
  - `request()` 在 401 时自动尝试 refresh 一次再重试
- `index.ts`：
  - `authApi` 扩展：`login`、`refresh`、`logoutUrl`、`logout` 方法
  - `skillApi` 新增文件 CRUD：`saveFile`、`createFile`、`deleteFile`、`renameFile`、`ensureDraftVersion`
  - `skillSetApi` 重写为 RESTful `/v3/aihub/skillsets/...` 风格，新增 `updateMember`、`skillSetOfSkill`

### 3. Hooks 扩展（`src/hooks/`）
- `use-skills.ts` 新增 hooks：`useSaveSkillFile`、`useCreateSkillFile`、`useDeleteSkillFile`、`useRenameSkillFile`、`useEnsureDraftVersion`
- `use-skillsets.ts` 新增 hooks：`useSkillSetUpdateMember`、`useSkillSetsOfSkill`，bind/unbind 失效 skills list 缓存
- `use-auth.ts` 重写：
  - 模块加载时注册 refresh 实现
  - `useLogout` 改为异步函数，先清本地 token 再跳后端 `/v3/auth/logout`
  - 新增 `useAuthEvents` 订阅强制登出事件
  - 新增 `useAuthCallback` 用于 OAuth callback 流程

### 4. Auth 流程优化（`src/app/auth/callback/`、`src/components/auth/login-page.tsx`）
- `callback/page.tsx`：处理 id_token 和 expires_in，加入 error 状态显示
- `login-page.tsx`：使用新的 `authApi.login`，保留 next 参数到 state，登录后跳回原页面

### 5. Skill Editor 完全重写（`src/components/editor/skill-editor.tsx`）
核心新增能力：
- **可编辑 CodeEditor**：移除 `readOnly` 硬编码，根据 `isVersionEditable` 自动切换
- **保存功能**：
  - 顶部 "Save All" 按钮，显示未保存数量徽章
  - 文件 tab 内联 "Save" 按钮 + breadcrumb 中的保存按钮
  - dirty 状态用 React Query 缓存对比，避免 setState-in-effect 反模式
  - 离开页面前 `beforeunload` 警告
- **文件 CRUD**：
  - FileTree 加入新建文件/目录、重命名、删除按钮（hover 显示）
  - 行内输入框创建/重命名（Enter 确认 / Esc 取消）
  - 删除前 ConfirmDialog 确认
- **草稿版本管理**：
  - 自动选中 draft/submitted 版本
  - 不可编辑版本显示黄色 banner + "Create draft to edit" 按钮
  - 调用 `ensureDraftVersion` API 自动派生草稿
- **漂亮的 Markdown 预览**：
  - 三种模式：Edit / Preview / Split View
  - 使用 `remark-gfm` 支持 GFM（表格、任务列表等）
  - Tailwind Typography (prose) 自定义样式，匹配 violet 主题
  - 外链自动 `target="_blank" rel="noopener"`
  - 代码块、引用块、行内代码 violet 主题色

### 6. FileTree 重写（`src/components/editor/file-tree.tsx`）
- 接受 `editable`、`onCreateFile`、`onDeleteNode`、`onRenameNode` 回调
- 目录悬停显示 `FilePlus` + `FolderPlus` + DropdownMenu（重命名/删除）
- 文件悬停显示 `Pencil` + `Trash2` 按钮
- 行内 Input 支持创建/重命名

### 7. 用户个人信息面板（`src/components/layout/user-panel-sheet.tsx` 新建）
- 右侧 Sheet 弹出，展示完整 principal 信息
- 头像（Avatar 组件，fallback 显示 initials）
- 身份徽章：subjectType + roles + groups
- Detail rows：subjectId（可复制）、email、organization、project、token expires
- Namespaces badges
- Permissions 列表（最多展示 50 个，超出折叠）
- Quick actions：Manage API Tokens（跳转 IAM）、Sign out

### 8. Sidebar 升级（`src/components/layout/sidebar.tsx`）
- 用户头像可点击打开 UserPanelSheet
- 显示 displayName（fallback username）+ role badge + @username
- 接入 `onOpenProfile` prop
- 监听 `skillhub:navigate` 全局事件，支持外部编程式导航（如 UserPanel → IAM）
- 移动端 sidebar 也接入 onOpenProfile

### 9. AppShell 升级（`src/components/layout/app-shell.tsx`）
- 使用新的 `useMe` hook 替代手动 fetch
- 使用异步 `useLogout` 调用后端 logout
- 监听 `onAuthEvent`，401 时自动翻转 authed 状态
- 监听 `storage` + `focus` 事件，多 tab 同步登录状态
- 集成 UserPanelSheet

### 10. SkillSet 成员管理升级（`src/components/skillsets/skillset-member-list.tsx`）
- 使用新的 `useSkillSetBind`/`useSkillSetUnbind`/`useSkillSetUpdateMember` hooks
- 添加搜索框过滤 quick-pick skills
- Required 列改为 Switch，可直接切换
- Order 列加入 ↑ / ↓ 按钮，可调整顺序
- 所有 toast 反馈走 i18n

### 11. SkillSet Detail Sheet 修复
- Tab 标题 i18n key 修正（避免使用 `skillset.detail.tabOverview` 等不存在 key）

### 12. i18n 扩展（`src/lib/i18n.tsx`）
- 为 en 和 zh 字典各新增 ~40 个 key：
  - `user.*`（用户面板相关）
  - `editor.*`（编辑器文件 CRUD、保存、草稿、预览模式相关）
  - `skillset.tab*`（SkillSet detail tabs）
- 清理了占位符 i18n key（如 `'editor.delete': 'editor.delete'`）

### 13. 后端接口需求规范文档（`/home/z/my-project/download/docs/BACKEND_API_REQUIREMENTS.md`）
完整列出缺失的后端接口规范：
- **SkillSetService**（全新）：8 个 RPC + 数据模型 + 权限模型 + 数据库迁移 SQL
- **Skill 文件 CRUD**：5 个 RPC（SaveFile/CreateFile/DeleteFile/RenameFile/EnsureDraftVersion）+ 业务规则
- **Auth Service 补充**：refresh snake_case 兼容、logout 302 路由、me 返回 principal 嵌套对象
- **UserPrefsService**（可选，未来增强）
- 验收 Checklist

### 14. 验证
- ✅ `bunx tsc --noEmit` 通过（0 错误）
- ✅ `bun run lint` 通过（除 upload/front 示例外 0 错误）
- ✅ `bun run build` 生产构建成功（47s 编译 + 静态生成 5 页面）
- ✅ `bun .next/standalone/server.js` 启动成功，HTTP 200 响应
- ✅ 登录页面 HTML 完整渲染（含所有装饰元素、Casdoor 按钮、Sparkles 图标）
- ⚠️ 沙盒容器内存限制导致 dev server 编译时被 OOM kill，但生产构建产物可正常运行

## Stage Summary
- **核心交付物**：
  - 完整重写的 Skill Editor（可编辑、文件 CRUD、保存、漂亮预览）
  - SkillSet 完整分组能力（前端 + 后端规范）
  - 用户个人信息面板（头像、身份、权限、Token 管理）
  - 优化的登录/退出流程（token refresh、401 自动登出、后端 logout）
  - 后端接口需求规范文档
- **代码质量**：TypeScript 0 错误，ESLint 0 错误，生产构建成功
- **沙盒限制说明**：开发环境内存有限，dev server 在编译大页面时会被 OOM kill；用户本地环境无此限制

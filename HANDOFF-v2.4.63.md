# OnePick v2.4.63 交接文档

更新时间：2026-08-04
工作目录：`/opt/docker/onepick`
分支：`main`
基线 HEAD：`438eaee4d3f7ffc24ba8ca127fd767658e11a266`

## 1. 当前状态

- 工作树包含 **未提交** 的 v2.4.63 候选改动。
- **未推送 Gitea、未同步 GitHub、未部署生产**。
- 生产容器 `onepick-tools` 仍运行旧版，最近检查：`running`、重启次数 `0`。
- 已构建候选镜像：`onepick-onepick-tools:latest`，最新镜像 ID：`sha256:82d3b8fc518791b29cbc022b6c0764cc233c2479973049838dccdcabbf983868`。
- 最终三路独立复审批次 `deleg_64acce95` 已返回：正确性与安全复审均要求继续修改；构建/性能复审超时。
- **全部发布阻断项已修复，最终独立复审通过：**
  1. CookieCloud/YouTube 并发复审：PASS，无 blocker。
  2. 构建/性能复审：PASS，无 blocker。
  3. 代理安全复审：`maskProxyUrl` 已剥离 path/query/hash；代理条目 ID 使用认证密钥 HMAC，并兼容 `ONEPICK_ADMIN_PASSWORD`；无密钥时 fail closed。最终复审 `deleg_8687055b`：PASS，无 blocker。
- 宿主机与最终镜像内全量测试、CookieCloud 9 项测试、依赖审计及 diff 检查均通过。
- 可以提交并推送私有 Gitea 和公开 GitHub；**生产部署仍须 Hugh 单独授权**。

## 2. 已落实的主要修复

### YouTube Cookie 生命周期

- CookieCloud 候选必须通过真实视频验证后才能晋升 master。
- yt-dlp 使用 master 的独立临时副本，避免 `yt-dlp --cookies` 原地回写共享 master。
- runtime 请求清理不再写回 master，消除与 promotion 的 TOCTOU 回滚竞态。
- master 仅在内容 SHA 与已验证 status 一致时可用；损坏内容会被拒绝，而不是由旧请求覆盖。
- 普通解析、浏览器下载信息、实际 yt-dlp 下载和 ZIP 下载均接入 YouTube 凭据恢复，最多恢复并重试一次。

### 代理链

- 代理端点按协议、主机、端口去重；只更换用户名不视为独立备用端点。
- YouTube bot-check、明确网络/限流故障允许切换真正不同的备用代理；私密、删除等内容错误不切换。
- yt-dlp 实际下载使用与解析一致的代理链。
- 已修复 `planProxyChain()` 返回字符串而下载代码按对象读取导致实际直连的问题。
- 下载成功后调用 `markPrimaryProxyUsed()`，冷却轮换能够生效。
- `/api/runtime` 和 `/api/config` 均只返回脱敏代理 DTO，不再向普通 API Token 暴露原始代理凭据。
- 配置页使用脱敏占位符；主代理留空表示保留。新增备用代理可提交，现有值不回传浏览器。

### CookieCloud 并发

- 同步任务完成后只在当前配置身份与启动配置一致时更新 lastResult。
- `syncCookieCloudToFiles()` 增加提交前 `canCommit` 检查；配置已删除/替换的旧在途请求不会写 Cookie 文件或推广 YouTube master。

### 前端与安全

- 登录、查看 Token、修改账户不再把稳定 API Token 写入 `localStorage`；网页会话依赖 HttpOnly Cookie。
- yt-dlp 下载在发起 fetch 前直接交给浏览器原生下载，避免大文件先完整处理一次、取消后再处理第二次。
- 普通远程文件：已知且不超过 100 MiB 才走 Blob 进度下载；大文件或未知大小改为原生下载，降低内存峰值。
- 代理配置写入使用同目录临时文件后原子替换，并及时失效 runtime cache。

## 3. 主要改动文件

- `src/server.js`
- `src/parsers/shared.js`
- `src/youtube-cookie-store.js`
- `src/youtube-credential-recovery.js`
- `src/cookiecloud.js`
- `src/cookiecloud-state.js`（新增）
- `src/ytdlp-execution.js`（新增）
- `public/app.js`
- `public/env.js`
- `public/login.html`
- `public/index.html`
- `public/browser-download-policy.js`（新增）
- `scripts/test-cookiecloud.js`
- `scripts/test-parser-policy.js`
- `scripts/test-security-hardening.js`
- `scripts/test-youtube-cookie-lifecycle.js`
- `scripts/test-youtube-credential-recovery.js`
- `scripts/test-browser-download-policy.js`（新增）
- `scripts/test-cookiecloud-state.js`（新增）
- `scripts/test-proxy-policy.js`（新增）
- `scripts/test-ytdlp-execution.js`（新增）
- `package.json`、`package-lock.json`

## 4. 已取得的验证证据

宿主机最后一轮：

```bash
node scripts/test-cookiecloud.js
node --check src/server.js
node --check public/env.js
npm test
npm audit --omit=dev --audit-level=low
git diff --check
```

结果：

- CookieCloud：`ALL 9 CHECKS PASSED`
- 全量 `npm test`：通过
- `npm audit`：`found 0 vulnerabilities`
- Node 语法检查：通过
- `git diff --check`：通过

候选镜像：

```bash
docker compose build onepick-tools
docker run --rm --entrypoint sh onepick-onepick-tools:latest -lc 'npm test && node scripts/test-cookiecloud.js'
```

结果：构建成功，镜像内全量测试和 CookieCloud 9 项测试全部通过。

敏感 URL 增量扫描：

```text
credential_url_hits=0
```

## 5. 后续必须按顺序执行

### A. 收取最终独立复审

1. 获取 `deleg_64acce95` 三个任务的 consolidated results。
2. 若存在 blocker/important：先建立确定性 RED 测试，再做最小修复。
3. 修复后重新执行宿主机全量门禁和镜像内测试。

### B. 最终真实验证（仍在 dev/候选环境，不切生产）

1. 以候选镜像启动隔离测试容器或临时端口，不能替换生产容器。
2. 使用临时短期会话 Cookie 验证：
   - `/api/runtime` 不包含代理原始 URL/凭据；
   - `/api/config` 仅含 `urlMasked`、`backupsMasked` 等脱敏字段；
   - 环境配置页面能加载，代理留空保存不会清空主代理；
   - 新增备用代理保存后数量正确；
   - yt-dlp 下载只产生一次服务端任务；
   - YouTube 失败能区分 bot-check、网络出口、内容不可用。
3. 做一次真实非 YouTube 下载，验证代理 argv、下载成功和历史记录。
4. YouTube 真实验证若仍出现 `Sign in to confirm you’re not a bot`，应报告为 Cookie 与当前出口组合被风控，不得描述为代码测试失败或“Cookie 文件缺失”。
5. 临时 Token、测试容器、临时文件用完立即删除。

### C. 发布门禁

所有门禁通过后再执行：

1. `git diff --check`
2. `npm test`
3. `npm audit --omit=dev --audit-level=low`
4. 敏感信息扫描（diff、待提交文件、公开仓库）
5. 检查 `git status --short`，确认只包含预期代码/测试文件
6. 提交到本地 Gitea `main`
7. 同步干净文件到 `/tmp/onepick-github-public`，再次扫描；不得同步运行数据、Cookie、代理原始地址、Token、备份
8. 提交并推送公开 GitHub
9. 如需 GHCR 多架构镜像，确认 CI/构建成功

### D. 生产部署（必须先获 Hugh 明确授权）

部署前报告：

- 影响：重建并短暂重启 `onepick-tools`，端口 3877 有短暂中断。
- 回滚：保留当前生产镜像 ID `sha256:920a1dc210462644241aff1f5444692768843dc44361f998f15ee7e002196421`，失败时恢复旧镜像/旧容器配置。
- 窗口：建议低峰，预计数分钟。

授权后：

1. 备份生产必要配置（不得把凭据写入交接或日志）。
2. `docker compose up -d --build` 或使用已验证候选镜像切换。
3. 检查容器状态、restart count、端口和日志。
4. 用临时短期会话验证主页、`/api/runtime`、`/api/config`、一次解析和一次真实下载。
5. 验证代理配置和 CookieCloud 配置未被清空。
6. 通知 Hugh 上线结果。

## 6. 不要混入本次发布的事项

以下应另开任务，不应在 v2.4.63 发布前临时扩大范围：

- 私有 Gitea 历史中运行配置/旧临时 Token 的历史改写；这是破坏性操作，需 Hugh 单独授权。
- CookieCloud 密码静态加密与密钥生命周期迁移。
- 长期 API Token 查询参数兼容路径的完整迁移；油猴和 iOS 快捷指令依赖，需版本化迁移。
- 历史记录同步 I/O 优化或改 SQLite。
- ffmpeg creation-time remux 范围优化。

## 7. 安全红线

- 不输出或提交 Cookie、Token、密码、私钥、代理原始认证 URL。
- 不使用 Telegram `getUpdates` 排查。
- 不直接修改生产容器内代码。
- 未获得生产部署授权前，不替换或重启生产容器。
- 未完成最终复审和真实验证前，不提交、推送或部署。

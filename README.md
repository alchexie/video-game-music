# Video Game Music

游戏音乐浏览播放站点，使用 `pnpm workspace` 管理前后端、共享包和资源工具。

## 结构

- `apps/web`：Vue 3 + Vite + Element Plus 前端
- `apps/api`：Fastify API，负责专辑、搜索、播放流和后台接口
- `packages/shared`：共享类型、校验和纯函数
- `packages/core`：SQLite、导入、媒体解析、COS 同步核心逻辑
- `tools/media-importer`：本地资源入库 CLI
- `tools/media-sync`：腾讯云 COS 同步 CLI

## 本地开发

1. 复制 `.env.example` 为 `.env`
2. 明确填写 `MEDIA_LIBRARY_ROOT`，否则无法导入音频库
3. 安装依赖：`pnpm install`
4. 启动前后端：`pnpm dev`


## 资源导入

- 执行入库：`pnpm import:init`
- 上传 COS：`pnpm sync:cos`

开发环境下，播放器通过 API 直接读取 `MEDIA_LIBRARY_ROOT` 下的本地文件，不需要先上传资源。

# Project

`GPT Image Playground` 是一个面向 OpenAI / GPT Image 工作流的本地优先图片生成与编辑工作台。  
当前仓库以前端为主，技术栈为 `React 19 + TypeScript + Vite + Zustand`，核心能力包括图片生成与编辑、任务画廊、本地持久化、供应商配置、协议兼容与导入导出。

# Code Style

本文件只保留代码规范摘要，详细规则统一见 [docs/code-style.md](./docs/code-style.md)。

- 使用 TypeScript，保持类型边界清晰、命名明确、职责单一。
- 优先按功能和领域拆分模块，避免巨型文件和重复实现。
- 前端的页面、状态、接口适配、共享组件要分层组织。
- 出错时优先显式报错，不要用静默兜底掩盖问题。

# Commands

常用命令如下：

```bash
npm install
npm run dev
npm run build
npm run preview
```

补充说明：

- 当前 `package.json` 中没有独立的 `test` 脚本。
- `npm run build` 会执行 `tsc -b && vite build`。

# Architecture

当前推荐按以下结构理解项目：

```text
.
├─ AGENTS.md
├─ CLAUDE.md
├─ docs/
│  ├─ code-style.md
│  └─ images/
├─ public/
├─ src/
│  ├─ app/                      应用级骨架组件
│  ├─ features/                 按功能拆分的业务 UI 模块
│  │  ├─ gallery/
│  │  ├─ input/
│  │  ├─ settings/
│  │  └─ viewer/
│  ├─ hooks/                    自定义 hooks
│  ├─ lib/                      基础能力与适配层
│  │  ├─ api/                   Images / Responses 协议实现
│  │  ├─ db.ts                  IndexedDB 访问
│  │  ├─ devProxy.ts            本地代理辅助
│  │  └─ size.ts                尺寸计算与规整
│  ├─ shared/
│  │  └─ components/            通用组件
│  ├─ store/                    Zustand 状态、任务工作流、导入导出等实现
│  ├─ App.tsx                   应用根组件
│  ├─ main.tsx                  入口
│  ├─ store.ts                  Store 统一导出入口
│  └─ types.ts                  全局类型定义
├─ package.json
└─ README.md
```

架构约束：

- `src/features/*` 放业务模块。
- `src/shared/components` 只放跨模块复用的通用组件。
- `src/store/*` 放状态、任务编排、缓存、导入导出等逻辑实现。
- `src/lib/api/*` 放协议适配与请求编排；`src/lib/api.ts` 仅作为统一导出入口。

# Important Notes

- 与用户沟通默认使用中文。
- 同目录下若同时存在 `AGENTS.md` 与 `CLAUDE.md`，两者内容必须保持一致；修改其一时必须同步修改另一份。
- 前后端代码职责以及目录结构需要合理分层。
- 后端若后续接入，需重点做好实体类、接口定义、服务层、数据访问层、数据库连接与配置层的分层，避免把业务逻辑、路由逻辑和数据库细节混写。
- 前端需重点做好页面层、功能模块层、api 适配层、store 层、shared 组件层的分层，避免把 UI、状态和协议细节堆在同一文件。
- 不论前端还是后端，都必须注意组件、模块和函数的拆分与复用，特别是前端；不要把全部内容写到一个文件里。
- 目录结构发生明显调整时，要同步更新 `README.md`、`docs/code-style.md`、`AGENTS.md` 与 `CLAUDE.md`。

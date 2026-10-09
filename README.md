# 🐺 Wolf-Notes

**Remember every round. Keep private information private. Make sense of the table.**

狼人杀 / 谁是卧底本地优先记录工具。把发言、角色、事件和推理整理成可回顾的对局线索，而不是在游戏过程中不断翻找零散便签。

**[🐺 Open Wolf-Notes](https://seiya058904.github.io/Wolf-Notes/)** · [During play](#during-a-game) · [AI boundary](#ai-assisted-reasoning-on-your-terms) · [Development](#run-and-test-locally) · [Attribution](#upstream-and-license)

## During a game

1. Set up players and the current mode.
2. Capture speeches and events as day/night rounds advance.
3. Separate public deductions from private information; revisit notes or export them later.

| During play | What Wolf-Notes records |
| --- | --- |
| **Speak / 发言** | 按轮次整理玩家陈述；标注未发言、滑水、无遗言等情况 |
| **Track / 事件** | 昼夜轮次、公开事件、角色信息和全局备注 |
| **Keep separate / 私密信息** | 根据游戏模式区分公开信息与私人记录 |
| **Reflect / 复盘** | 可编辑模板、笔记导出与整局重置 |
| **Change modes / 切换模式** | 狼人杀与“谁是卧底”的不同记录流程 |

提供桌面与移动端布局，以及星空/简洁白色两类视觉主题。

## AI-assisted reasoning, on your terms

Wolf-Notes 可以根据局内记录整理**策略提示词**，由使用者复制到自己的第三方 AI 服务中分析。

**本项目不会自动调用 AI API**，也不要求输入 AI 服务密钥。自动生成提示词与“应用直接替你判断”是两回事，任何推理结论都应由玩家自行核实。

对局状态保存在浏览器本地存储中；清除站点数据前请先导出重要记录。

## Run and test locally

需要 Node.js 22.12+，从仓库根目录执行：

```bash
npm ci
npm run dev
```

普通开发服务仅监听 `127.0.0.1:8080`。只有在明确可信的局域网调试场景下才使用 `npm run dev:lan`，结束后关闭服务。

```bash
npm test
npm run build:all
npm run test:browser
npm run test:docs
```

浏览器脚本需要能找到 Playwright/Chromium 环境，具体设置见 [`AGENTS.md`](AGENTS.md)。站点文档使用 VitePress；其已验证的 Vite/VitePress 版本约束和安全覆盖策略不能被普通依赖更新顺手推翻。

## Source map

- [`src/lib/gameSession.js`](src/lib/gameSession.js) — 会话持久化、迁移和轮次状态。
- [`src/views/`](src/views/) — 首页、准备、记录面板与卧底模式。
- [`src/composables/`](src/composables/) — 界面与状态协调。
- [`docs/`](docs/) — 项目文档。
- [`test/`](test/) — 自动化回归。

**Tech:** Vue 3, Pinia, Element Plus, Vite / VitePress。

## Upstream and license

This is an **unofficial derivative** of [syhy0612/lrsNotes](https://github.com/syhy0612/lrsNotes), originally developed by **双叶 / Double Leaves**. The derivative extends round recording, information organization and prompt generation; it is not an official upstream release.

本项目基于原项目二次开发，保留原作者版权声明和 [MIT License](LICENSE)。


## 许可证

[MIT License](LICENSE)

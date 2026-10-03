# 🐺 Wolf-Notes

> An unofficial derivative project based on `syhy0612/lrsNotes`.
>
> 本项目是基于 `syhy0612/lrsNotes` 改进的非官方衍生版本。

Wolf-Notes is a local-first werewolf game notebook for recording speeches by day/night rounds, public events, private information, and overall notes. It can generate AI strategy prompts for users to copy into a third-party AI service; it does not call an AI API directly.

狼人杀本地优先记录台：按昼夜轮次记录发言、公共信息、非公开信息和整体备注，并生成可复制到第三方 AI 服务的策略提示词；本项目不直接调用 AI API。

Online demo: [GitHub Pages](https://seiya058904.github.io/Wolf-Notes/)

在线使用：[GitHub Pages](https://seiya058904.github.io/Wolf-Notes/)

## Features

- Multi-round speech records with automatic saving
- Status markers for no speech, low-information speech, and no last words
- Editable role, event, and note templates
- AI strategy prompt generation
- Responsive desktop and mobile layouts
- Starry and plain-white background themes
- Werewolf and “Undercover” recording modes
- Note export and full-game reset

## 功能

- 多轮发言记录与自动保存
- 未发言、滑水、无遗言等状态标记
- 可编辑的身份、事件和备注模板
- AI 策略提示词生成
- 桌面端与移动端布局
- 星空与纯白背景主题
- 狼人杀与“谁是卧底”记录模式
- 笔记导出与整局重置

## Local development / 本地开发

Use Node.js 20.19+ or 22.12+ and install the lockfile with `npm ci`.
`npm run dev` listens only on `127.0.0.1:8080`; `npm run docs:dev` and
`npm run docs:preview` listen only on `127.0.0.1:3000`.
For an explicitly trusted LAN debugging session, use `npm run dev:lan` or
`npm run docs:dev:lan`. Stop the development server when finished.

开发和文档预览默认只允许本机访问。确需可信局域网调试时，显式使用带 `:lan`
后缀的命令；使用完毕后关闭开发服务。生产静态站点的地址和存档格式保持不变。

VitePress is pinned to `2.0.0-alpha.20`: the maintained upstream prerelease
supports Vite 8, while the latest 1.x stable still depends on unsupported Vite 5.
CI checks application and documentation builds and the canary security regression.
This is a documentation toolchain prerelease, not a product release.

Run `npm test`, `npm run build:all`, and `npm run test:browser` for validation.
The security test creates only a nonsensitive temporary canary outside the served
root and exercises the app and docs dev servers; it never requests real user files.

## Source and Acknowledgements

This project is a secondary development of [syhy0612/lrsNotes](https://github.com/syhy0612/lrsNotes), extending it with multi-round speech records, day/night flow, public and private information management, and AI strategy prompt generation.

本项目基于 [syhy0612/lrsNotes](https://github.com/syhy0612/lrsNotes) 二次开发，并在其基础上扩展了多轮发言记录、昼夜流程、公开与非公开信息管理以及 AI 策略提示词生成功能。

The original project was created by 双叶 / Double Leaves and released under the MIT License. This repository preserves the original copyright notice and license.

原项目由双叶 / Double Leaves 开发，并以 MIT License 开源。本仓库保留原项目的版权声明与许可证。

## License

[MIT License](LICENSE)

## 许可证

[MIT License](LICENSE)

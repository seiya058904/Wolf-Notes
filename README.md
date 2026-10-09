<h1 align="center">🐺 Wolf-Notes</h1>

<p align="center">
  <strong>Every word leaves a trace. Keep the whole game in view.</strong>
</p>

<p align="center">
  A local-first notebook for Werewolf and Who Is the Undercover.<br>
  Record the table, follow the rounds, and turn scattered clues into a coherent case file.
</p>

<p align="center">
  <a href="https://seiya058904.github.io/Wolf-Notes/"><strong>▶ Open Wolf-Notes</strong></a>
  &nbsp;·&nbsp;
  <a href="#choose-your-mode">🎭 Game Modes</a>
  &nbsp;·&nbsp;
  <a href="#inside-the-notebook">📓 Features</a>
  &nbsp;·&nbsp;
  <a href="#ai-strategy-prompts">🧠 AI Prompts</a>
  &nbsp;·&nbsp;
  <a href="#run-locally">⚙️ Development</a>
</p>

<p align="center">
  <sub>ROUND-BY-ROUND NOTES &nbsp;·&nbsp; PUBLIC &amp; PRIVATE CLUES &nbsp;·&nbsp; LOCAL SAVES &nbsp;·&nbsp; COPY-READY AI PROMPTS</sub>
</p>

---

> **The hardest part of deduction is remembering what everyone actually said.**
>
> Wolf-Notes keeps speeches, events, and suspicions in their proper context. It is a companion for the player at the table—not a replacement for their judgment.

<a id="choose-your-mode"></a>
## 🎭 Choose Your Mode

<table>
  <tr>
    <td width="50%" valign="top">
      <h3>🌙 Werewolf</h3>
      <p><sub>ROLES · NIGHT &amp; DAY · DEDUCTION</sub></p>
      <p>Set up a game, choose your seat and role, and build a record as the table moves from night to day. Keep spoken claims, public events, and information known only to you clearly distinguished.</p>
      <p><strong>Best for:</strong> multi-round reasoning, vote analysis, and reviewing how suspicions evolved.</p>
    </td>
    <td width="50%" valign="top">
      <h3>🕵️ Who Is the Undercover</h3>
      <p><sub>SPEECHES · ROLE TRACKING · OBSERVATIONS</sub></p>
      <p>Use a separate recording workspace to organize players' statements, track your observations, and revisit what was said during the game.</p>
      <p><strong>Best for:</strong> keeping a clear record as descriptions and deductions accumulate.</p>
    </td>
  </tr>
</table>

<a id="inside-the-notebook"></a>
## 📓 Inside the Notebook

<table>
  <tr>
    <td width="50%" valign="top">
      <h3>🌓 A Living Timeline</h3>
      <p>Move through the first night, first day, and subsequent rounds without losing the order of events. Return to earlier rounds whenever a new claim changes the picture.</p>
    </td>
    <td width="50%" valign="top">
      <h3>💬 Speech Records</h3>
      <p>Capture statements by player and round. Mark no speech, low-information speech, or missing last words instead of leaving an unexplained blank.</p>
    </td>
  </tr>
  <tr>
    <td width="50%" valign="top">
      <h3>🔐 Public vs. Private</h3>
      <p>Separate shared events from your role-specific knowledge and private notes. When your role changes, retained private information can be flagged for review rather than silently treated as current fact.</p>
    </td>
    <td width="50%" valign="top">
      <h3>🗳️ Decisions &amp; Evidence</h3>
      <p>Record votes, eliminations, role claims, and overall deductions. Templates and a vote helper make common events easier to capture consistently.</p>
    </td>
  </tr>
  <tr>
    <td width="50%" valign="top">
      <h3>📋 Copy &amp; Review</h3>
      <p>Prepare a readable account of the match for later analysis. Keep your notes editable, revisit your assumptions, or start a new game when you are ready.</p>
    </td>
    <td width="50%" valign="top">
      <h3>🌌 Your Reading Space</h3>
      <p>Desktop and mobile-friendly layouts, configurable backgrounds—including a starry scene and plain white—and an interface designed around quick note-taking.</p>
    </td>
  </tr>
</table>

### 🔎 A Match, Step by Step

1. **Set the scene** — Select a Werewolf configuration, your seat, and your role; enter the information you already know.
2. **Record what happens** — Follow the night/day timeline and keep each player's words with the right round.
3. **Separate evidence from suspicion** — Distinguish public events, private knowledge, and your own interpretations.
4. **Revisit the case** — Review earlier claims, produce a strategy prompt if useful, and preserve important notes before resetting.

<a id="ai-strategy-prompts"></a>
## 🧠 AI Strategy Prompts — Without Automatic AI Calls

Wolf-Notes can assemble a structured **Werewolf strategy prompt** from your recorded game. You decide whether to copy that text and paste it into an AI service of your choice.

<p align="center"><code>RECORD &nbsp;→&nbsp; ORGANIZE &nbsp;→&nbsp; REVIEW &nbsp;→&nbsp; COPY &nbsp;→&nbsp; ASK YOUR AI</code></p>

The generated prompt can distinguish player statements, public events, private knowledge, uncertain notes, and the questions you want to reason through. Options also allow earlier rounds to be condensed when the record becomes long.

> [!IMPORTANT]
> **You control what leaves your browser.** The application does **not** directly call an AI API or require an AI API key. However, a prompt you choose to copy **may contain your role, hidden information, and private notes**. Review the complete text before sharing it with a third-party service. AI conclusions are suggestions, not verified game facts.

## 💾 Local Data & Session Safety

Wolf-Notes stores game records in your browser's `localStorage`. For Werewolf, a saved session can be resumed from the home screen; starting a new one does not replace the previous session until the new setup is confirmed.

- **No automatic cloud synchronization** of game records is provided by this note-taking workflow.
- **Concurrent edits are guarded:** when another tab has updated the same Werewolf session, a stale save is rejected rather than silently overwriting the newer record.
- **Browser storage is not a permanent backup.** Clearing site data, switching browser profiles, or using private-browsing mode may make your notes unavailable. Copy out anything important before resetting or clearing storage.

<a id="run-locally"></a>
## 🚀 Run Locally

Wolf-Notes is built with **Vue 3, Pinia, Element Plus, and Vite**. The interface is primarily in Chinese; this repository README is in English.

Use **Node.js 22.12+** and the committed lockfile. From the repository root:

```bash
npm ci
npm run dev
```

The development server listens on `127.0.0.1:8080`. Open **http://127.0.0.1:8080/Wolf-Notes/**. For intentionally trusted LAN debugging, `npm run dev:lan` is available; do not expose the dev server by default.

<details>
<summary><strong>🛠️ Tests, documentation &amp; project structure</strong></summary>

### Verification

```bash
npm test              # Node.js regression tests
npm run build         # Production application build
npm run build:all     # Application + VitePress documentation build
npm run test:browser  # Browser session/concurrency checks (after build)
npm run test:docs     # Documentation browser checks (after docs build)
```

Browser checks require an available Playwright/Chromium installation. Documentation uses **VitePress 1.6.4** with the repository's pinned Vite compatibility setup; see [`AGENTS.md`](AGENTS.md) before changing build dependencies.

### Source map

```text
src/lib/gameSession.js       Session schema, round flow, migrations, and prompts
src/views/                Home, setup, Werewolf, and Undercover views
src/components/           Game boards, player controls, and note panels
src/composables/          View state and UI coordination
src/stores/               Game-mode state
test/                     Regression tests
docs/                     Optional VitePress documentation
```

The app switches between views without an active Vue Router. Keep local save compatibility and public/private information boundaries intact when developing new features.

</details>

<a id="upstream-and-license"></a>
## 📜 Upstream & License

Wolf-Notes is an **unofficial derivative** of [syhy0612/lrsNotes](https://github.com/syhy0612/lrsNotes), originally created by **双叶 / Double Leaves**. This project extends its note-taking workflow with round-based records, clearer information organization, and copy-ready AI strategy prompts. It is not an official upstream release.

The original copyright notice and the **[MIT License](LICENSE)** are preserved. Retain the upstream attribution when reusing or distributing the software.

---

<p align="center">
  <sub>KEEP THE ROUNDS. FOLLOW THE CLUES. MAKE YOUR OWN CALL.</sub><br>
  <sub>Wolf-Notes · A clearer record for a complicated table.</sub>
</p>

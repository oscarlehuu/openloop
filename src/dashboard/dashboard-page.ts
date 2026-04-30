import { dashboardClientScript } from "./dashboard-client-script.js";
import { dashboardStyles } from "./dashboard-styles.js";

export function dashboardHtml(): string {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>OpenLoop Dashboard</title>
  <style>${dashboardStyles()}</style>
</head>
<body>
  <div class="app-shell">
    <header class="topbar">
      <div class="stack">
        <span class="eyebrow">OpenLoop local control</span>
        <h1>Projects, campaign runs, assets, captions.</h1>
        <p class="subtle">Local assets from this workspace. No cloud dashboard, no scheduling layer.</p>
      </div>
      <button id="refresh">Refresh</button>
    </header>
    <main class="layout">
      <aside class="rail">
        <div id="metrics" class="metric-grid"></div>
        <div class="rail-head"><h2>Projects</h2><span class="subtle">Registry</span></div>
        <input id="project-search" class="search" type="search" placeholder="Filter projects">
        <div id="projects"></div>
      </aside>
      <section class="workspace"><div id="details"></div></section>
    </main>
  </div>
  <script type="module">${dashboardClientScript()}</script>
</body>
</html>`;
}

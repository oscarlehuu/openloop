export function dashboardStyles(): string {
  return `
:root {
  color-scheme: dark;
  --bg: #101113;
  --surface: #17191c;
  --surface-2: #202327;
  --surface-3: #292d32;
  --line: #343a40;
  --line-soft: #262b30;
  --text: #f4efe6;
  --muted: #a9b0b3;
  --faint: #747d82;
  --accent: #e2bd61;
  --accent-2: #8bc6b5;
  --danger: #df7b6c;
  --ok: #8ccf8c;
  --shadow: 0 18px 50px rgba(0, 0, 0, 0.32);
}
* { box-sizing: border-box; }
body {
  margin: 0;
  min-width: 320px;
  background:
    linear-gradient(135deg, rgba(226, 189, 97, 0.08), transparent 32rem),
    radial-gradient(circle at 85% 8%, rgba(139, 198, 181, 0.08), transparent 28rem),
    var(--bg);
  color: var(--text);
  font-family: ui-rounded, "Avenir Next", "Segoe UI", sans-serif;
  letter-spacing: 0;
}
button, a.button {
  min-height: 36px;
  border: 1px solid var(--line);
  border-radius: 7px;
  background: var(--surface-2);
  color: var(--text);
  padding: 8px 12px;
  font: inherit;
  text-decoration: none;
  cursor: pointer;
}
button:hover, a.button:hover { border-color: var(--accent); }
button.primary, a.primary { background: var(--accent); color: #15130f; border-color: var(--accent); font-weight: 700; }
h1, h2, h3, p { margin: 0; }
h1 { font-size: clamp(24px, 3vw, 38px); line-height: 1.03; max-width: 760px; }
h2 { font-size: 22px; line-height: 1.2; }
h3 { font-size: 15px; line-height: 1.25; }
code { color: var(--accent); }
.app-shell { min-height: 100dvh; display: grid; grid-template-rows: auto 1fr; }
.topbar {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 18px;
  align-items: end;
  padding: 24px clamp(18px, 4vw, 42px) 20px;
  border-bottom: 1px solid var(--line-soft);
}
.eyebrow { color: var(--accent); font-size: 12px; font-weight: 800; text-transform: uppercase; }
.subtle { color: var(--muted); font-size: 14px; line-height: 1.45; }
.layout {
  display: grid;
  grid-template-columns: minmax(280px, 360px) minmax(0, 1fr);
  min-height: 0;
}
.rail {
  border-right: 1px solid var(--line-soft);
  padding: 18px;
  overflow: auto;
}
.workspace {
  padding: 22px clamp(18px, 3vw, 36px) 36px;
  overflow: auto;
}
.metric-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
  margin-bottom: 18px;
}
.metric, .panel, .project-card, .run-card, .slide-card {
  border: 1px solid var(--line-soft);
  background: color-mix(in srgb, var(--surface) 92%, transparent);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.03);
}
.metric { border-radius: 8px; padding: 14px; }
.metric strong { display: block; font-size: 26px; line-height: 1; margin-bottom: 6px; }
.panel { border-radius: 8px; padding: 18px; margin-bottom: 16px; }
.rail-head { display: flex; justify-content: space-between; align-items: center; gap: 12px; margin-bottom: 14px; }
.search {
  width: 100%;
  min-height: 42px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: #111315;
  color: var(--text);
  padding: 0 12px;
  font-size: 16px;
  margin-bottom: 14px;
}
.project-card {
  width: 100%;
  text-align: left;
  border-radius: 8px;
  padding: 14px;
  margin-bottom: 10px;
  background: var(--surface);
}
.project-card.active { border-color: var(--accent); background: linear-gradient(135deg, rgba(226, 189, 97, 0.12), var(--surface)); }
.path { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--faint); font-size: 12px; margin-top: 7px; }
.row { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.stack { display: grid; gap: 10px; }
.actions { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 14px; }
.badge, .status {
  display: inline-flex;
  align-items: center;
  min-height: 24px;
  border-radius: 999px;
  padding: 3px 9px;
  font-size: 12px;
  font-weight: 800;
  text-transform: uppercase;
}
.badge { background: var(--surface-3); color: var(--muted); }
.status-created { background: #41454b; color: #f3f0e8; }
.status-scanned { background: #31485b; color: #cde7f8; }
.status-planned { background: #4b4260; color: #ead9ff; }
.status-imaged { background: #4d4329; color: #ffe3a7; }
.status-rendered { background: #284c39; color: #c7f2d5; }
.run-list { display: grid; gap: 12px; }
.run-card { border-radius: 8px; padding: 15px; }
.run-card:hover { border-color: var(--line); background: var(--surface-2); }
.progress { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 5px; margin-top: 13px; }
.step { height: 7px; border-radius: 999px; background: var(--surface-3); }
.step.done { background: var(--accent); }
.detail-head {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: start;
  gap: 18px;
}
.run-meta { display: flex; flex-wrap: wrap; gap: 7px; margin-top: 11px; }
.copy-block {
  white-space: pre-wrap;
  background: #0d0f10;
  border: 1px solid var(--line-soft);
  border-radius: 8px;
  padding: 14px;
  color: var(--muted);
  overflow: auto;
}
.idea-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; margin-top: 12px; }
.idea { border: 1px solid var(--line-soft); border-radius: 8px; padding: 12px; background: #111315; }
.idea span { display: block; color: var(--faint); font-size: 12px; margin-bottom: 5px; text-transform: uppercase; }
.slide-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(190px, 1fr)); gap: 14px; }
.slide-card { border-radius: 8px; overflow: hidden; background: var(--surface); }
.slide-card img { width: 100%; aspect-ratio: 2 / 3; display: block; object-fit: cover; background: #0c0d0e; }
.slide-body { padding: 12px; display: grid; gap: 7px; }
.empty { border: 1px dashed var(--line); border-radius: 8px; padding: 18px; color: var(--muted); background: rgba(255, 255, 255, 0.02); }
@media (max-width: 900px) {
  .topbar, .detail-head { grid-template-columns: 1fr; }
  .layout { grid-template-columns: 1fr; }
  .rail { border-right: 0; border-bottom: 1px solid var(--line-soft); }
  .metric-grid, .idea-grid { grid-template-columns: 1fr; }
}
`;
}

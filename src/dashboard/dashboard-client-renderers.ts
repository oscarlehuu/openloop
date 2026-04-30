export function dashboardClientRenderersScript(): string {
  return `
function metric(label, value) {
  return \`<div class="metric"><strong>\${value}</strong><span class="subtle">\${label}</span></div>\`;
}

function projectButton(project) {
  const active = project.id === state.selectedProjectId ? " active" : "";
  const latest = project.campaigns[0]?.status ?? "empty";
  return \`
    <button class="project-card\${active}" data-project="\${escapeAttr(project.id)}">
      <div class="row"><h3>\${escapeHtml(project.name)}</h3><span class="badge">\${project.campaigns.length}</span></div>
      <div class="path">\${escapeHtml(project.path)}</div>
      <div class="run-meta">\${statusChip(latest)}</div>
    </button>\`;
}

function runCard(run) {
  return \`
    <article class="run-card">
      <div class="row">
        <div class="stack">
          <h3>\${escapeHtml(run.name)}</h3>
          <p class="subtle">\${escapeHtml(run.runId)}</p>
          <span class="badge">\${escapeHtml(run.workflowLabel ?? run.workflowId ?? "Social carousel")}</span>
        </div>
        \${statusChip(run.status)}
      </div>
      \${progress(run.status)}
      <div class="actions">
        <button data-run="\${escapeAttr(run.runId)}" class="primary">Open</button>
        <a class="button" href="\${run.previewUrl}" target="_blank">Preview</a>
      </div>
    </article>\`;
}

function ideaPanel(idea) {
  return \`
    <section class="panel">
      <h2>Campaign idea</h2>
      <div class="idea-grid">
        \${ideaItem("Angle", idea.angle)}
        \${ideaItem("Audience", idea.audience)}
        \${ideaItem("Promise", idea.promise)}
        \${ideaItem("CTA", idea.cta)}
      </div>
    </section>\`;
}

function ideaItem(label, value) {
  return \`<div class="idea"><span>\${escapeHtml(label)}</span>\${escapeHtml(value)}</div>\`;
}

function slideCard(slide) {
  const title = slide.title ?? slide.overlayText?.headline ?? humanizeRole(slide.role);
  return \`
    <article class="slide-card">
      <img src="\${slide.renderedSlideUrl}" onerror="this.src='\${slide.rawImageUrl}'" alt="">
      <div class="slide-body">
        <span class="badge">\${escapeHtml(slide.role)}</span>
        <h3>\${escapeHtml(title)}</h3>
        <p class="subtle">\${escapeHtml(slide.overlayText?.subtitle ?? "")}</p>
      </div>
    </article>\`;
}

function progress(status) {
  const index = STAGES.indexOf(status);
  return '<div class="progress">' + STAGES.map((_, step) => \`<span class="step \${step <= index ? "done" : ""}"></span>\`).join("") + "</div>";
}

function statusChip(status) {
  return \`<span class="status status-\${escapeAttr(status)}">\${escapeHtml(status)}</span>\`;
}

function selectedProject() {
  return state.projects.find((project) => project.id === state.selectedProjectId);
}

function formatDate(value) {
  return new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[char]));
}

function escapeAttr(value) {
  return escapeHtml(value).replace(/'/g, "&#39;");
}

function humanizeRole(role) {
  return String(role ?? "")
    .split(/[-_]/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
`;
}

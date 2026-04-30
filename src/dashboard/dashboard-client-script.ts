import { dashboardClientRenderersScript } from "./dashboard-client-renderers.js";

export function dashboardClientScript(): string {
  return `
const STAGES = ["created", "scanned", "planned", "imaged", "rendered"];
const state = { projects: [], selectedProjectId: null, selectedRunId: null, query: "" };
const $ = (id) => document.getElementById(id);

$("refresh").onclick = load;
$("project-search").oninput = (event) => {
  state.query = event.target.value.toLowerCase();
  render();
};

async function load() {
  const response = await fetch("/api/projects");
  const body = await response.json();
  state.projects = body.projects;
  state.selectedProjectId ||= state.projects[0]?.id ?? null;
  render();
}

function render() {
  renderMetrics();
  renderProjects();
  if (state.selectedRunId) renderRun(state.selectedRunId);
  else renderProject();
}

function renderMetrics() {
  const runs = state.projects.flatMap((project) => project.campaigns);
  const rendered = runs.filter((run) => run.status === "rendered").length;
  $("metrics").innerHTML = [
    metric("Projects", state.projects.length),
    metric("Campaigns", runs.length),
    metric("Rendered", rendered)
  ].join("");
}

function renderProjects() {
  const projects = state.projects.filter((project) =>
    [project.name, project.path, project.id].join(" ").toLowerCase().includes(state.query)
  );
  $("projects").innerHTML = projects.length
    ? projects.map(projectButton).join("")
    : '<div class="empty">No tracked projects.</div>';
  document.querySelectorAll("[data-project]").forEach((element) => {
    element.onclick = () => {
      state.selectedProjectId = element.dataset.project;
      state.selectedRunId = null;
      render();
    };
  });
}

function renderProject() {
  const project = selectedProject();
  if (!project) {
    $("details").innerHTML = '<div class="empty">No project selected.</div>';
    return;
  }
  const latest = project.campaigns[0];
  $("details").innerHTML = \`
    <section class="panel detail-head">
      <div class="stack">
        <span class="eyebrow">Tracked project</span>
        <h2>\${escapeHtml(project.name)}</h2>
        <p class="subtle">\${escapeHtml(project.path)}</p>
        <div class="run-meta">
          <span class="badge">\${project.campaigns.length} campaigns</span>
          \${latest ? '<span class="badge">latest ' + escapeHtml(formatDate(latest.createdAt)) + '</span>' : ""}
        </div>
      </div>
      <button id="copy-path">Copy path</button>
    </section>
    <section class="panel">
      <div class="row"><h2>Campaign runs</h2><span class="subtle">\${project.campaigns.length} total</span></div>
      <div class="run-list">\${project.campaigns.length ? project.campaigns.map(runCard).join("") : '<div class="empty">No campaign runs yet.</div>'}</div>
    </section>\`;
  $("copy-path").onclick = () => navigator.clipboard?.writeText(project.path);
  document.querySelectorAll("[data-run]").forEach((element) => {
    element.onclick = () => {
      state.selectedRunId = element.dataset.run;
      render();
    };
  });
}

async function renderRun(runId) {
  const response = await fetch("/api/runs/" + encodeURIComponent(runId));
  const run = await response.json();
  $("details").innerHTML = \`
    <section class="panel detail-head">
      <div class="stack">
        <button id="back-project">Back to project</button>
        <span class="eyebrow">Campaign run</span>
        <h2>\${escapeHtml(run.manifest.name)}</h2>
        <p class="subtle">\${escapeHtml(run.manifest.runId)}</p>
        <div class="run-meta">
          \${statusChip(run.manifest.status)}
          <span class="badge">\${escapeHtml(run.workflow?.label ?? run.manifest.workflowId ?? "Social carousel")}</span>
          <span class="badge">\${run.manifest.slidesCount} \${escapeHtml(run.workflow?.assetLabel ?? "slides")}</span>
          <span class="badge">\${escapeHtml(formatDate(run.manifest.createdAt))}</span>
        </div>
      </div>
      <div class="actions">
        <a class="button primary" href="\${run.previewUrl}" target="_blank">Preview</a>
        \${run.captionUrl ? '<a class="button" href="' + escapeAttr(run.captionUrl) + '" target="_blank">Caption</a>' : ""}
      </div>
    </section>
    <section class="panel">
      <h2>Pipeline</h2>
      \${progress(run.manifest.status)}
    </section>
    \${run.idea ? ideaPanel(run.idea) : ""}
    \${run.caption ? '<section class="panel"><h2>Caption</h2><pre class="copy-block">' + escapeHtml(run.caption) + '</pre></section>' : ""}
    <section class="panel">
      <div class="row"><h2>Assets</h2><span class="subtle">\${run.slides.length} \${escapeHtml(run.workflow?.assetLabel ?? "assets")}</span></div>
      <div class="slide-grid">\${run.slides.length ? run.slides.map(slideCard).join("") : '<div class="empty">Slides will appear after idea generation.</div>'}</div>
    </section>\`;
  $("back-project").onclick = () => {
    state.selectedRunId = null;
    renderProject();
  };
}

${dashboardClientRenderersScript()}
load().catch((error) => {
  $("details").innerHTML = '<pre class="copy-block">' + escapeHtml(error.message) + "</pre>";
});
`;
}

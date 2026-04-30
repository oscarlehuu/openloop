import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { request } from "node:http";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { startDashboardServer } from "../src/dashboard/dashboard-server.js";
import { listCampaignRuns, listProjectCampaigns } from "../src/dashboard/run-indexer.js";
import { defaultConfig } from "../src/config/openloop-config.js";
import { upsertProject } from "../src/projects/project-registry.js";
import { createRun, writeManifest } from "../src/runs/run-store.js";
import { writeJsonFile } from "../src/shared/json-file.js";

describe("OpenLoop project dashboard", () => {
  it("upserts projects without duplicating the same path", async () => {
    const cwd = await tempWorkspace();
    const first = await upsertProject({ cwd, projectPath: ".", name: "LarryLoop", tags: ["local"] });
    const second = await upsertProject({ cwd, projectPath: ".", name: "LarryLoop Updated" });

    expect(first.created).toBe(true);
    expect(second.created).toBe(false);
    expect(second.project.id).toBe(first.project.id);
    expect(second.project.name).toBe("LarryLoop Updated");
  });

  it("indexes campaign runs by registered project path", async () => {
    const cwd = await tempWorkspace();
    const config = defaultConfig();
    const project = await upsertProject({ cwd, projectPath: ".", name: "LarryLoop" });
    const { runPath, manifest } = await createRun({
      cwd,
      config,
      name: "launch",
      projectPath: project.project.path
    });
    await writeManifest(runPath, { ...manifest, status: "planned" });

    const runs = await listCampaignRuns(cwd);
    const projects = await listProjectCampaigns([project.project], cwd);

    expect(runs).toHaveLength(1);
    expect(runs[0].status).toBe("planned");
    expect(runs[0].workflowId).toBe("social-carousel");
    expect(runs[0].workflowLabel).toBe("Social carousel");
    expect(projects[0].campaigns[0].runId).toBe(manifest.runId);
  });

  it("serves project API and blocks path traversal outside campaign output", async () => {
    const cwd = await tempWorkspace();
    const config = defaultConfig();
    await writeJsonFile(join(cwd, "openloop.config.json"), config);
    const project = await upsertProject({ cwd, projectPath: ".", name: "LarryLoop" });
    await createRun({ cwd, config, name: "launch", projectPath: project.project.path });
    await writeFile(join(cwd, "secret.txt"), "nope", "utf8");

    const server = await startDashboardServer({ cwd, port: 0 });
    try {
      const projects = await fetchJson(`${server.url}/api/projects`);
      expect(projects.projects[0].campaigns).toHaveLength(1);

      const blockedStatus = await rawGetStatus(server.url, "/runs/%2e%2e/secret.txt");
      expect(blockedStatus).toBe(403);

      const blockedApi = await rawGetStatus(server.url, "/api/runs/%2e%2e/secret");
      expect(blockedApi).toBe(403);
    } finally {
      await server.close();
    }
  });
});

async function tempWorkspace(): Promise<string> {
  const dir = join(process.cwd(), "node_modules", ".tmp-openloop-tests", randomUUID());
  await mkdir(dir, { recursive: true });
  return dir;
}

async function fetchJson(url: string): Promise<any> {
  const response = await fetch(url);
  expect(response.ok).toBe(true);
  return response.json();
}

async function rawGetStatus(baseUrl: string, path: string): Promise<number | undefined> {
  const url = new URL(baseUrl);
  return new Promise((resolve, reject) => {
    const req = request(
      { hostname: url.hostname, port: url.port, path, method: "GET" },
      (res) => {
        res.resume();
        res.on("end", () => resolve(res.statusCode));
      }
    );
    req.on("error", reject);
    req.end();
  });
}

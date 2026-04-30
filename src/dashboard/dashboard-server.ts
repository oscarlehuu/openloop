#!/usr/bin/env node
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import { pathToFileURL } from "node:url";
import { readProjectRegistry } from "../projects/project-registry.js";
import { OpenLoopError } from "../shared/errors.js";
import { dashboardHtml } from "./dashboard-page.js";
import { listProjectCampaigns, readRunDetails, runsRootPath } from "./run-indexer.js";
import { sendStatus, serveRunFile } from "./safe-static-files.js";

export interface DashboardServer {
  url: string;
  close: () => Promise<void>;
}

export async function startDashboardServer(options: {
  cwd?: string;
  port?: number;
  host?: string;
} = {}): Promise<DashboardServer> {
  const cwd = options.cwd ?? process.cwd();
  const host = options.host ?? "127.0.0.1";
  const envPort = process.env["PORT"];
  const preferredPort = options.port ?? Number(envPort ?? 5173);
  const server = createServer((req, res) => {
    void handleRequest({ req, res, cwd });
  });
  const port = await listenOnFreePort(server, preferredPort, host);
  return {
    url: `http://${host}:${port}`,
    close: () => new Promise((resolve) => server.close(() => resolve()))
  };
}

async function handleRequest(options: {
  req: IncomingMessage;
  res: ServerResponse;
  cwd: string;
}): Promise<void> {
  const { req, res, cwd } = options;
  const url = new URL(req.url ?? "/", "http://localhost");
  const rawPath = (req.url ?? "/").split("?")[0] ?? "/";
  try {
    if (req.method !== "GET") {
      sendStatus(res, 405, "Method not allowed");
      return;
    }
    if (url.pathname === "/") {
      sendHtml(res, dashboardHtml());
      return;
    }
    if (url.pathname === "/api/projects") {
      const registry = await readProjectRegistry(cwd);
      sendJson(res, { projects: await listProjectCampaigns(registry.projects, cwd) });
      return;
    }
    if (url.pathname.startsWith("/api/projects/")) {
      await handleProjectApi(url.pathname, res, cwd);
      return;
    }
    if (rawPath.startsWith("/api/runs/")) {
      const runId = decodeURIComponent(rawPath.replace(/^\/api\/runs\//, ""));
      sendJson(res, await readRunDetails(runId, cwd));
      return;
    }
    if (await serveRunFile({ res, runsRoot: await runsRootPath(cwd), requestPath: rawPath })) {
      return;
    }
    sendStatus(res, 404, "Not found");
  } catch (error) {
    const status = error instanceof OpenLoopError && error.code.endsWith("_FORBIDDEN") ? 403 : 500;
    sendJson(res, { error: error instanceof Error ? error.message : String(error) }, status);
  }
}

async function handleProjectApi(pathname: string, res: ServerResponse, cwd: string): Promise<void> {
  const id = decodeURIComponent(pathname.replace(/^\/api\/projects\//, ""));
  const registry = await readProjectRegistry(cwd);
  const projects = await listProjectCampaigns(registry.projects, cwd);
  const project = projects.find((item) => item.id === id);
  if (!project) {
    sendStatus(res, 404, "Not found");
    return;
  }
  sendJson(res, { project });
}

function sendJson(res: ServerResponse, value: unknown, status = 200): void {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(value, null, 2));
}

function sendHtml(res: ServerResponse, value: string): void {
  res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
  res.end(value);
}

function listenOnFreePort(
  server: ReturnType<typeof createServer>,
  preferredPort: number,
  host: string
): Promise<number> {
  return new Promise((resolve, reject) => {
    const tryPort = (port: number) => {
      server.once("error", (error: NodeJS.ErrnoException) => {
        if (error.code === "EADDRINUSE") tryPort(port + 1);
        else reject(error);
      });
      server.listen(port, host, () => {
        const address = server.address() as AddressInfo;
        resolve(address.port);
      });
    };
    tryPort(preferredPort);
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  startDashboardServer()
    .then((server) => {
      console.log(`OpenLoop dashboard: ${server.url}`);
    })
    .catch((error) => {
      console.error(`error: ${error instanceof Error ? error.message : String(error)}`);
      process.exitCode = 1;
    });
}

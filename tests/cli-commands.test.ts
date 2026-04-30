import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";

const execFileAsync = promisify(execFile);

describe("OpenLoop CLI commands", () => {
  it("exposes simple asset commands for slides, App Store, and app ads", async () => {
    const rootHelp = await openloopHelp("--help");
    expect(rootHelp).toContain("slides");
    expect(rootHelp).toContain("app-store");
    expect(rootHelp).toContain("app-ads");

    const slidesHelp = await openloopHelp("slides", "--help");
    expect(slidesHelp).toContain("Usage: openloop slides");
    expect(slidesHelp).not.toContain("--platform <platform>");
    expect(slidesHelp).not.toContain("--aspect <ratio>");
    expect(slidesHelp).not.toContain("--workflow <workflow>");

    const appStoreHelp = await openloopHelp("app-store", "--help");
    expect(appStoreHelp).toContain("Usage: openloop app-store");
    expect(appStoreHelp).toContain("--screenshots <dir>");
    expect(appStoreHelp).not.toContain("--platform <platform>");
    expect(appStoreHelp).not.toContain("--workflow <workflow>");

    const appAdsHelp = await openloopHelp("app-ads", "--help");
    expect(appAdsHelp).toContain("Usage: openloop app-ads");
    expect(appAdsHelp).toContain("--screenshots <dir>");
    expect(appAdsHelp).not.toContain("--platform <platform>");
    expect(appAdsHelp).not.toContain("--workflow <workflow>");
  });
});

async function openloopHelp(...args: string[]): Promise<string> {
  const { stdout } = await execFileAsync("npm", ["run", "openloop", "--", ...args], {
    cwd: process.cwd()
  });
  return stdout;
}

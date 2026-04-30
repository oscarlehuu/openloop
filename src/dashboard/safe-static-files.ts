import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { extname, resolve, sep } from "node:path";
import type { ServerResponse } from "node:http";

const CONTENT_TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp"
};

export async function serveRunFile(options: {
  res: ServerResponse;
  runsRoot: string;
  requestPath: string;
}): Promise<boolean> {
  if (!options.requestPath.startsWith("/runs/")) return false;
  let relativePath: string;
  try {
    relativePath = decodeURIComponent(options.requestPath.replace(/^\/runs\//, ""));
  } catch {
    sendStatus(options.res, 400, "Bad request");
    return true;
  }
  if (!relativePath || relativePath.includes("\0")) {
    sendStatus(options.res, 400, "Bad request");
    return true;
  }

  const filePath = resolve(options.runsRoot, relativePath);
  const rootWithSeparator = options.runsRoot.endsWith(sep)
    ? options.runsRoot
    : `${options.runsRoot}${sep}`;
  if (filePath !== options.runsRoot && !filePath.startsWith(rootWithSeparator)) {
    sendStatus(options.res, 403, "Forbidden");
    return true;
  }

  try {
    const fileStat = await stat(filePath);
    if (!fileStat.isFile()) {
      sendStatus(options.res, 404, "Not found");
      return true;
    }
    options.res.writeHead(200, {
      "content-type": CONTENT_TYPES[extname(filePath).toLowerCase()] ?? "application/octet-stream",
      "content-length": fileStat.size
    });
    createReadStream(filePath).pipe(options.res);
  } catch {
    sendStatus(options.res, 404, "Not found");
  }
  return true;
}

export function sendStatus(res: ServerResponse, status: number, message: string): void {
  res.writeHead(status, { "content-type": "text/plain; charset=utf-8" });
  res.end(message);
}

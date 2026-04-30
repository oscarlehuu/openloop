export class OpenLoopError extends Error {
  constructor(
    message: string,
    readonly code = "OPENLOOP_ERROR",
    readonly hint?: string
  ) {
    super(message);
    this.name = "OpenLoopError";
  }
}

export function toErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

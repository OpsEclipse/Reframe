export class HttpError extends Error {
  readonly provider: string;
  readonly status: number;
  readonly retryAfterMs?: number;

  constructor(args: { provider: string; status: number; message: string; retryAfterMs?: number }) {
    super(args.message);
    this.name = "HttpError";
    this.provider = args.provider;
    this.status = args.status;
    this.retryAfterMs = args.retryAfterMs;
  }
}


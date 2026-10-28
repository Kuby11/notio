import { z } from 'zod';
import { defaultErrorCodeForStatus, ErrorCodeSchema, type ErrorCode } from './error-codes';

/** Content-Type of every API error (RFC 7807). */
export const PROBLEM_CONTENT_TYPE = 'application/problem+json';

export const DEFAULT_PROBLEM_TYPE = 'about:blank';

export const ProblemErrorSchema = z.object({
  path: z.string(),
  message: z.string(),
});
export type ProblemError = z.infer<typeof ProblemErrorSchema>;

export const ProblemDetailsSchema = z.object({
  type: z.string().min(1),
  title: z.string().min(1),
  status: z.number().int().min(100).max(599),
  detail: z.string().optional(),
  instance: z.string().optional(),
  /** Machine-readable code from the shared enum: the frontend builds types from it. */
  code: ErrorCodeSchema,
  /** End-to-end request id used to find the matching log lines. */
  requestId: z.string().min(1).optional(),
  errors: z.array(ProblemErrorSchema).optional(),
});
export type ProblemDetails = z.infer<typeof ProblemDetailsSchema>;

const TITLES_BY_STATUS: Readonly<Record<number, string>> = {
  400: 'Bad Request',
  401: 'Unauthorized',
  403: 'Forbidden',
  404: 'Not Found',
  405: 'Method Not Allowed',
  409: 'Conflict',
  413: 'Payload Too Large',
  415: 'Unsupported Media Type',
  422: 'Unprocessable Content',
  429: 'Too Many Requests',
  500: 'Internal Server Error',
  502: 'Bad Gateway',
  503: 'Service Unavailable',
  504: 'Gateway Timeout',
};

export interface ProblemInit {
  status: number;
  detail?: string;
  type?: string;
  title?: string;
  code?: ErrorCode;
  requestId?: string;
  instance?: string;
  errors?: readonly ProblemError[];
  headers?: Record<string, string>;
}

export function problem(init: ProblemInit): Response {
  const body = ProblemDetailsSchema.parse({
    type: init.type ?? DEFAULT_PROBLEM_TYPE,
    title: init.title ?? TITLES_BY_STATUS[init.status] ?? 'Unexpected Error',
    status: init.status,
    detail: init.detail,
    instance: init.instance,
    code: init.code ?? defaultErrorCodeForStatus(init.status),
    requestId: init.requestId,
    errors: init.errors === undefined ? undefined : [...init.errors],
  });

  return Response.json(body, {
    status: init.status,
    headers: { 'content-type': PROBLEM_CONTENT_TYPE, ...init.headers },
  });
}

export function isProblemDetails(value: unknown): value is ProblemDetails {
  return ProblemDetailsSchema.safeParse(value).success;
}

export function toProblemErrors(error: z.ZodError): ProblemError[] {
  return error.issues.map((issue) => ({
    path: issue.path.join('.'),
    message: issue.message,
  }));
}

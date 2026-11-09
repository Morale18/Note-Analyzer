import type { z } from 'zod';

export class RequestValidationError extends Error {
  readonly statusCode = 400;

  constructor(readonly issues: z.core.$ZodIssue[]) {
    super('Validation failed');
  }
}

/** Parses request input, turning a schema failure into a 400 response. */
export function parseRequest<S extends z.ZodType>(schema: S, input: unknown): z.output<S> {
  const result = schema.safeParse(input);
  if (!result.success) throw new RequestValidationError(result.error.issues);
  return result.data;
}

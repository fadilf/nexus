export class ApiRouteError extends Error {
  constructor(
    public readonly status: number,
    message: string
  ) {
    super(message);
    this.name = "ApiRouteError";
  }
}

export function badRequest(message: string): ApiRouteError {
  return new ApiRouteError(400, message);
}

export function notFound(message: string): ApiRouteError {
  return new ApiRouteError(404, message);
}

export function conflict(message: string): ApiRouteError {
  return new ApiRouteError(409, message);
}

export function serverError(message: string): ApiRouteError {
  return new ApiRouteError(500, message);
}

export function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

import { NextResponse } from "next/server";
import { resolveWorkspaceDir } from "./workspace-context";
export { ApiRouteError, badRequest, notFound, conflict, serverError, getErrorMessage } from "./api-errors";
import { ApiRouteError, badRequest } from "./api-errors";

type RouteParams = Record<string, string>;
type RouteContext<P extends RouteParams> = {
  params?: P | Promise<P>;
};
type BaseHandlerContext<P extends RouteParams> = {
  request: Request;
  url: URL;
  params: P;
};
type RouteHandler<P extends RouteParams, Extra extends object = Record<string, never>> = (
  context: BaseHandlerContext<P> & Extra
) => Promise<Response | unknown> | Response | unknown;

export function json<T>(body: T, init?: ResponseInit): Response {
  return NextResponse.json(body, init);
}

export function created<T>(body: T): Response {
  return json(body, { status: 201 });
}

function toErrorResponse(error: unknown): Response {
  if (error instanceof ApiRouteError) {
    return json({ error: error.message }, { status: error.status });
  }

  console.error(error);
  return json({ error: "Internal Server Error" }, { status: 500 });
}

async function resolveParams<P extends RouteParams>(context?: RouteContext<P>): Promise<P> {
  return ((await context?.params) ?? {}) as P;
}

async function parseJsonBody<T>(request: Request, optional: boolean): Promise<T> {
  try {
    return (await request.json()) as T;
  } catch {
    if (optional) {
      return {} as T;
    }
    throw badRequest("Invalid JSON body");
  }
}

function buildRoute<P extends RouteParams, Extra extends object>(
  resolveExtra: (context: BaseHandlerContext<P>) => Promise<Extra> | Extra,
  handler: RouteHandler<P, Extra>
) {
  return async (request: Request, context?: RouteContext<P>): Promise<Response> => {
    try {
      const baseContext = {
        request,
        url: new URL(request.url),
        params: await resolveParams(context),
      };

      const extra = await resolveExtra(baseContext);
      const result = await handler({ ...baseContext, ...extra });
      return result instanceof Response ? result : json(result);
    } catch (error) {
      return toErrorResponse(error);
    }
  };
}

export function route<P extends RouteParams = Record<string, never>>(
  handler: RouteHandler<P>
) {
  return buildRoute(async () => ({}), handler);
}

export function routeWithJson<
  P extends RouteParams = Record<string, never>,
  Body = unknown,
>(
  handler: RouteHandler<P, { body: Body }>,
  options?: { optional?: boolean }
) {
  return buildRoute(
    async ({ request }) => ({
      body: await parseJsonBody<Body>(request, options?.optional ?? false),
    }),
    handler
  );
}

export function routeWithWorkspace<P extends RouteParams = Record<string, never>>(
  handler: RouteHandler<P, { workspaceDir: string }>
) {
  return buildRoute(async ({ request }) => ({
    workspaceDir: await resolveWorkspaceDir(request),
  }), handler);
}

export function routeWithWorkspaceJson<
  P extends RouteParams = Record<string, never>,
  Body = unknown,
>(
  handler: RouteHandler<P, { body: Body; workspaceDir: string }>,
  options?: { optional?: boolean }
) {
  return buildRoute(async ({ request }) => {
    const workspaceDir = await resolveWorkspaceDir(request);
    const body = await parseJsonBody<Body>(request, options?.optional ?? false);
    return { body, workspaceDir };
  }, handler);
}

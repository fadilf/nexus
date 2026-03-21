import { describe, it, expect } from "vitest";
import { ApiRouteError, badRequest, notFound, conflict, serverError, getErrorMessage } from "../api-errors";

describe("ApiRouteError", () => {
  it("creates error with status and message", () => {
    const err = new ApiRouteError(400, "bad");
    expect(err.status).toBe(400);
    expect(err.message).toBe("bad");
    expect(err.name).toBe("ApiRouteError");
    expect(err).toBeInstanceOf(Error);
  });
});

describe("error factories", () => {
  it.each([
    ["badRequest", badRequest, 400],
    ["notFound", notFound, 404],
    ["conflict", conflict, 409],
    ["serverError", serverError, 500],
  ] as const)("%s returns %i", (_, factory, status) => {
    const err = factory("msg");
    expect(err.status).toBe(status);
    expect(err.message).toBe("msg");
  });
});

describe("getErrorMessage", () => {
  it("extracts message from Error instances", () => {
    expect(getErrorMessage(new Error("oops"), "fallback")).toBe("oops");
  });

  it("returns fallback for non-Error values", () => {
    expect(getErrorMessage("string", "fallback")).toBe("fallback");
    expect(getErrorMessage(null, "fallback")).toBe("fallback");
  });
});

import { describe, it, expect } from "vitest";
import { resolvePermissionLevel } from "../permissions";

describe("resolvePermissionLevel", () => {
  it("uses thread override when set", () => {
    expect(
      resolvePermissionLevel({ permissionLevel: "supervised" }, { permissionLevel: "full" })
    ).toBe("supervised");
  });

  it("falls back to workspace default", () => {
    expect(
      resolvePermissionLevel({ permissionLevel: undefined }, { permissionLevel: "auto-edit" })
    ).toBe("auto-edit");
  });

  it("defaults to 'full' when neither is set", () => {
    expect(
      resolvePermissionLevel({ permissionLevel: undefined }, { permissionLevel: undefined })
    ).toBe("full");
  });
});

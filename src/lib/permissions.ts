import { Thread, Workspace, PermissionLevel } from "./types";

/**
 * Resolve the effective permission level for a thread.
 * Thread override takes precedence, then workspace default, then "full" (backward compat).
 */
export function resolvePermissionLevel(
  thread: Pick<Thread, "permissionLevel">,
  workspace: Pick<Workspace, "permissionLevel">
): PermissionLevel {
  return thread.permissionLevel ?? workspace.permissionLevel ?? "full";
}

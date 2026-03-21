import { listThreads, createThread } from "@/lib/thread-store";
import { loadAgents } from "@/lib/agent-store";
import { Agent } from "@/lib/types";
import { badRequest, created, routeWithWorkspace, routeWithWorkspaceJson } from "@/lib/api-route";

type CreateThreadBody = {
  title?: string;
  agentIds?: string[];
};

export const GET = routeWithWorkspace(async ({ workspaceDir }) => listThreads(workspaceDir));

export const POST = routeWithWorkspaceJson<Record<string, never>, CreateThreadBody>(
  async ({ body, workspaceDir }) => {
    const { title, agentIds } = body;
  if (!title || !agentIds?.length) {
      throw badRequest("title and agentIds required");
  }

  const allAgents = await loadAgents();
  const agents: Agent[] = agentIds
    .map((id: string) => allAgents.find((a) => a.id === id))
    .filter((a): a is Agent => a !== undefined);

  if (!agents.length) {
      throw badRequest("No valid agents specified");
  }

  const thread = await createThread(workspaceDir, title, agents);
    return created(thread);
  }
);

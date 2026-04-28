import * as fs from "fs/promises";
import * as path from "path";
import * as os from "os";
import { executeCommand, FOUNDRY_PATHS } from "./command.js";

export const FOUNDRY_WORKSPACE_DIR = path.join(
  os.homedir(),
  ".mcp-foundry-workspace"
);

export async function ensureWorkspaceInitialized(): Promise<string> {
  await fs.mkdir(FOUNDRY_WORKSPACE_DIR, { recursive: true });

  const isForgeProject = await fs
    .access(path.join(FOUNDRY_WORKSPACE_DIR, "foundry.toml"))
    .then(() => true)
    .catch(() => false);

  if (!isForgeProject) {
    await executeCommand(
      `cd ${FOUNDRY_WORKSPACE_DIR} && ${FOUNDRY_PATHS.forgePath} init --no-git`
    );
  }

  return FOUNDRY_WORKSPACE_DIR;
}

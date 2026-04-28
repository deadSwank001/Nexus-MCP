import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as fs from "fs/promises";
import * as path from "path";
import {
  checkFoundryInstalled,
  executeCommand,
  FOUNDRY_PATHS,
  FOUNDRY_NOT_INSTALLED_ERROR,
} from "../../utils/command.js";
import { resolveRpcUrl } from "../../utils/rpc.js";
import { ensureWorkspaceInitialized } from "../../utils/workspace.js";

export function registerForgeScriptTool(server: McpServer): void {
  server.tool(
    "forge_script",
    "Run a Forge script from the workspace",
    {
      scriptPath: z
        .string()
        .describe("Path to the script file relative to workspace (e.g., 'script/Deploy.s.sol')"),
      sig: z
        .string()
        .optional()
        .describe("Function signature to call (default: 'run()')"),
      rpcUrl: z.string().optional().describe("JSON-RPC URL"),
      broadcast: z.boolean().optional().describe("Broadcast the transactions"),
      verify: z
        .boolean()
        .optional()
        .describe("Verify deployed contracts on Etherscan (requires ETHERSCAN_API_KEY)"),
    },
    async ({ scriptPath, sig = "run()", rpcUrl, broadcast = false, verify = false }) => {
      if (!(await checkFoundryInstalled()))
        return { content: [{ type: "text", text: FOUNDRY_NOT_INSTALLED_ERROR }], isError: true };

      const workspace = await ensureWorkspaceInitialized();
      const fullPath = path.join(workspace, scriptPath);
      const exists = await fs
        .access(fullPath)
        .then(() => true)
        .catch(() => false);

      if (!exists)
        return {
          content: [{ type: "text", text: `Script not found at ${fullPath}` }],
          isError: true,
        };

      const resolvedRpc = await resolveRpcUrl(rpcUrl);
      let cmd = `cd "${workspace}" && ${FOUNDRY_PATHS.forgePath} script ${scriptPath} --sig "${sig}"`;
      if (resolvedRpc) cmd += ` --rpc-url "${resolvedRpc}"`;
      if (broadcast) cmd += " --broadcast";
      if (verify) cmd += " --verify";

      const result = await executeCommand(cmd);
      return {
        content: [
          {
            type: "text",
            text: result.success
              ? `Script executed:\n${result.message}`
              : `Script failed: ${result.message}`,
          },
        ],
        isError: !result.success,
      };
    }
  );
}

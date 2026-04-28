import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  checkFoundryInstalled,
  executeCommand,
  FOUNDRY_PATHS,
  FOUNDRY_NOT_INSTALLED_ERROR,
} from "../../utils/command.js";
import { resolveRpcUrl } from "../../utils/rpc.js";

export function registerCastChainTool(server: McpServer): void {
  server.tool(
    "cast_chain",
    "Get information about the current connected chain",
    {
      rpcUrl: z.string().optional().describe("JSON-RPC URL"),
      returnId: z.boolean().optional().describe("Return chain ID instead of name"),
    },
    async ({ rpcUrl, returnId = false }) => {
      if (!(await checkFoundryInstalled()))
        return { content: [{ type: "text", text: FOUNDRY_NOT_INSTALLED_ERROR }], isError: true };

      const resolvedRpc = await resolveRpcUrl(rpcUrl);
      const cmd = returnId
        ? `${FOUNDRY_PATHS.castPath} chain-id --rpc-url "${resolvedRpc}"`
        : `${FOUNDRY_PATHS.castPath} chain --rpc-url "${resolvedRpc}"`;

      const result = await executeCommand(cmd);
      return {
        content: [
          {
            type: "text",
            text: result.success
              ? `Chain ${returnId ? "ID" : "name"}: ${result.message.trim()}`
              : `Failed to get chain info: ${result.message}`,
          },
        ],
        isError: !result.success,
      };
    }
  );
}

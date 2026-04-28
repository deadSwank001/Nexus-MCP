import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  checkFoundryInstalled,
  executeCommand,
  FOUNDRY_PATHS,
  FOUNDRY_NOT_INSTALLED_ERROR,
} from "../../utils/command.js";
import { resolveRpcUrl } from "../../utils/rpc.js";

export function registerCastLogsTool(server: McpServer): void {
  server.tool(
    "cast_logs",
    "Get event logs by signature or topic from a contract",
    {
      signature: z
        .string()
        .optional()
        .describe("Event signature (e.g., 'Transfer(address,address,uint256)')"),
      topics: z
        .array(z.string())
        .optional()
        .describe("Raw topic hex values to filter"),
      address: z.string().optional().describe("Contract address to filter logs"),
      fromBlock: z.string().optional().describe("Starting block number"),
      toBlock: z.string().optional().describe("Ending block number"),
      rpcUrl: z.string().optional().describe("JSON-RPC URL"),
    },
    async ({ signature, topics = [], address, fromBlock, toBlock, rpcUrl }) => {
      if (!(await checkFoundryInstalled()))
        return { content: [{ type: "text", text: FOUNDRY_NOT_INSTALLED_ERROR }], isError: true };

      const resolvedRpc = await resolveRpcUrl(rpcUrl);
      let cmd = `${FOUNDRY_PATHS.castPath} logs`;
      if (signature) cmd += ` "${signature}"`;
      for (const t of topics) cmd += ` ${t}`;
      if (address) cmd += ` --address ${address}`;
      if (fromBlock) cmd += ` --from-block ${fromBlock}`;
      if (toBlock) cmd += ` --to-block ${toBlock}`;
      if (resolvedRpc) cmd += ` --rpc-url "${resolvedRpc}"`;

      const result = await executeCommand(cmd);
      return {
        content: [
          {
            type: "text",
            text: result.success
              ? `Logs:\n${result.message}`
              : `Failed to get logs: ${result.message}`,
          },
        ],
        isError: !result.success,
      };
    }
  );
}

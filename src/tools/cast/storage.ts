import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  checkFoundryInstalled,
  executeCommand,
  FOUNDRY_PATHS,
  FOUNDRY_NOT_INSTALLED_ERROR,
} from "../../utils/command.js";
import { resolveRpcUrl } from "../../utils/rpc.js";

export function registerCastStorageTool(server: McpServer): void {
  server.tool(
    "cast_storage",
    "Read contract storage at a specific slot",
    {
      contractAddress: z.string().describe("Address of the contract"),
      slot: z.string().describe("Storage slot (decimal or hex, e.g., '0' or '0x0')"),
      rpcUrl: z.string().optional().describe("JSON-RPC URL"),
      blockNumber: z.string().optional().describe("Block number"),
    },
    async ({ contractAddress, slot, rpcUrl, blockNumber }) => {
      if (!(await checkFoundryInstalled()))
        return { content: [{ type: "text", text: FOUNDRY_NOT_INSTALLED_ERROR }], isError: true };

      const resolvedRpc = await resolveRpcUrl(rpcUrl);
      let cmd = `${FOUNDRY_PATHS.castPath} storage ${contractAddress} ${slot}`;
      if (resolvedRpc) cmd += ` --rpc-url "${resolvedRpc}"`;
      if (blockNumber) cmd += ` --block ${blockNumber}`;

      const result = await executeCommand(cmd);
      return {
        content: [
          {
            type: "text",
            text: result.success
              ? `Storage[${slot}] at ${contractAddress}: ${result.message.trim()}`
              : `Failed to read storage: ${result.message}`,
          },
        ],
        isError: !result.success,
      };
    }
  );
}

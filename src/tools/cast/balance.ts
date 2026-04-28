import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  checkFoundryInstalled,
  executeCommand,
  FOUNDRY_PATHS,
  FOUNDRY_NOT_INSTALLED_ERROR,
} from "../../utils/command.js";
import { resolveRpcUrl } from "../../utils/rpc.js";

export function registerCastBalanceTool(server: McpServer): void {
  server.tool(
    "cast_balance",
    "Check the ETH balance of an address",
    {
      address: z.string().describe("Ethereum address"),
      rpcUrl: z.string().optional().describe("JSON-RPC URL"),
      blockNumber: z.string().optional().describe("Block number"),
      formatEther: z
        .boolean()
        .optional()
        .describe("Format balance in ETH instead of wei"),
    },
    async ({ address, rpcUrl, blockNumber, formatEther = false }) => {
      if (!(await checkFoundryInstalled()))
        return { content: [{ type: "text", text: FOUNDRY_NOT_INSTALLED_ERROR }], isError: true };

      const resolvedRpc = await resolveRpcUrl(rpcUrl);
      let cmd = `${FOUNDRY_PATHS.castPath} balance ${address}`;
      if (resolvedRpc) cmd += ` --rpc-url "${resolvedRpc}"`;
      if (blockNumber) cmd += ` --block ${blockNumber}`;
      if (formatEther) cmd += " --ether";

      const result = await executeCommand(cmd);
      const unit = formatEther ? "ETH" : "wei";
      return {
        content: [
          {
            type: "text",
            text: result.success
              ? `Balance of ${address}: ${result.message.trim()} ${unit}`
              : `Failed to get balance: ${result.message}`,
          },
        ],
        isError: !result.success,
      };
    }
  );
}

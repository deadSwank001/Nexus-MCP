import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  checkFoundryInstalled,
  executeCommand,
  FOUNDRY_PATHS,
  FOUNDRY_NOT_INSTALLED_ERROR,
} from "../../utils/command.js";
import { resolveRpcUrl } from "../../utils/rpc.js";

export function registerCastCallTool(server: McpServer): void {
  server.tool(
    "cast_call",
    "Call a contract function (read-only, no gas cost)",
    {
      contractAddress: z.string().describe("Address of the contract"),
      functionSignature: z
        .string()
        .describe("Function signature (e.g., 'balanceOf(address)')"),
      args: z.array(z.string()).optional().describe("Function arguments"),
      rpcUrl: z
        .string()
        .optional()
        .describe("JSON-RPC URL (default: http://localhost:8545)"),
      blockNumber: z
        .string()
        .optional()
        .describe("Block number (e.g., 'latest', 'earliest', or a number)"),
      from: z.string().optional().describe("Address to perform the call as"),
    },
    async ({ contractAddress, functionSignature, args = [], rpcUrl, blockNumber, from }) => {
      if (!(await checkFoundryInstalled()))
        return { content: [{ type: "text", text: FOUNDRY_NOT_INSTALLED_ERROR }], isError: true };

      const resolvedRpc = await resolveRpcUrl(rpcUrl);
      let cmd = `${FOUNDRY_PATHS.castPath} call ${contractAddress} "${functionSignature}"`;
      if (args.length > 0) cmd += " " + args.join(" ");
      if (resolvedRpc) cmd += ` --rpc-url "${resolvedRpc}"`;
      if (blockNumber) cmd += ` --block ${blockNumber}`;
      if (from) cmd += ` --from ${from}`;

      const result = await executeCommand(cmd);
      return {
        content: [
          {
            type: "text",
            text: result.success
              ? `Call to ${contractAddress}.${functionSignature.split("(")[0]} result:\n${result.message.trim()}`
              : `Call failed: ${result.message}`,
          },
        ],
        isError: !result.success,
      };
    }
  );
}

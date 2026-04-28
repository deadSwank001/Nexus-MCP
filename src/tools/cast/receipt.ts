import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  checkFoundryInstalled,
  executeCommand,
  FOUNDRY_PATHS,
  FOUNDRY_NOT_INSTALLED_ERROR,
} from "../../utils/command.js";
import { resolveRpcUrl } from "../../utils/rpc.js";

export function registerCastReceiptTool(server: McpServer): void {
  server.tool(
    "cast_receipt",
    "Get the transaction receipt for a given tx hash",
    {
      txHash: z.string().describe("Transaction hash"),
      rpcUrl: z.string().optional().describe("JSON-RPC URL"),
      confirmations: z.number().optional().describe("Confirmations to wait for"),
      field: z
        .string()
        .optional()
        .describe("Specific field to extract (e.g., 'blockNumber', 'status')"),
    },
    async ({ txHash, rpcUrl, confirmations, field }) => {
      if (!(await checkFoundryInstalled()))
        return { content: [{ type: "text", text: FOUNDRY_NOT_INSTALLED_ERROR }], isError: true };

      const resolvedRpc = await resolveRpcUrl(rpcUrl);
      let cmd = `${FOUNDRY_PATHS.castPath} receipt ${txHash}`;
      if (resolvedRpc) cmd += ` --rpc-url "${resolvedRpc}"`;
      if (confirmations) cmd += ` --confirmations ${confirmations}`;
      if (field) cmd += ` ${field}`;

      const result = await executeCommand(cmd);
      return {
        content: [
          {
            type: "text",
            text: result.success
              ? `Receipt for ${txHash}${field ? ` (${field})` : ""}:\n${result.message}`
              : `Failed to get receipt: ${result.message}`,
          },
        ],
        isError: !result.success,
      };
    }
  );
}

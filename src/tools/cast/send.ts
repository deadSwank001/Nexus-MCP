import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  checkFoundryInstalled,
  executeCommand,
  FOUNDRY_PATHS,
  FOUNDRY_NOT_INSTALLED_ERROR,
} from "../../utils/command.js";
import { resolveRpcUrl } from "../../utils/rpc.js";

export function registerCastSendTool(server: McpServer): void {
  server.tool(
    "cast_send",
    "Send a transaction to a contract function (requires PRIVATE_KEY env var)",
    {
      contractAddress: z.string().describe("Address of the contract"),
      functionSignature: z
        .string()
        .describe("Function signature (e.g., 'transfer(address,uint256)')"),
      args: z.array(z.string()).optional().describe("Function arguments"),
      value: z
        .string()
        .optional()
        .describe("Ether value to send with the transaction (in wei)"),
      rpcUrl: z.string().optional().describe("JSON-RPC URL"),
      gasLimit: z.string().optional().describe("Gas limit"),
      gasPrice: z.string().optional().describe("Gas price in wei"),
      confirmations: z.number().optional().describe("Number of confirmations to wait for"),
    },
    async ({ contractAddress, functionSignature, args = [], value, rpcUrl, gasLimit, gasPrice, confirmations }) => {
      if (!(await checkFoundryInstalled()))
        return { content: [{ type: "text", text: FOUNDRY_NOT_INSTALLED_ERROR }], isError: true };

      const privateKey = process.env.PRIVATE_KEY;
      if (!privateKey)
        return {
          content: [{ type: "text", text: "PRIVATE_KEY environment variable is not set." }],
          isError: true,
        };

      const resolvedRpc = await resolveRpcUrl(rpcUrl);
      let cmd = `${FOUNDRY_PATHS.castPath} send ${contractAddress} "${functionSignature}" --private-key "${privateKey}"`;
      if (args.length > 0) cmd += " " + args.join(" ");
      if (value) cmd += ` --value ${value}`;
      if (resolvedRpc) cmd += ` --rpc-url "${resolvedRpc}"`;
      if (gasLimit) cmd += ` --gas-limit ${gasLimit}`;
      if (gasPrice) cmd += ` --gas-price ${gasPrice}`;
      if (confirmations) cmd += ` --confirmations ${confirmations}`;

      const result = await executeCommand(cmd);
      return {
        content: [
          {
            type: "text",
            text: result.success
              ? `Transaction sent successfully:\n${result.message}`
              : `Transaction failed: ${result.message}`,
          },
        ],
        isError: !result.success,
      };
    }
  );
}

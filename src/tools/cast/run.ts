import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  checkFoundryInstalled,
  executeCommand,
  FOUNDRY_PATHS,
  FOUNDRY_NOT_INSTALLED_ERROR,
} from "../../utils/command.js";
import { resolveRpcUrl } from "../../utils/rpc.js";

export function registerCastRunTool(server: McpServer): void {
  server.tool(
    "cast_run",
    "Run a published transaction in a local environment to reproduce its execution",
    {
      txHash: z.string().describe("Transaction hash to replay"),
      rpcUrl: z.string().optional().describe("JSON-RPC URL of the network"),
      quick: z
        .boolean()
        .optional()
        .describe("Skip explorer lookups (faster, less context)"),
      verbose: z.boolean().optional().describe("Print full trace"),
    },
    async ({ txHash, rpcUrl, quick, verbose }) => {
      if (!(await checkFoundryInstalled()))
        return { content: [{ type: "text", text: FOUNDRY_NOT_INSTALLED_ERROR }], isError: true };

      const resolvedRpc = await resolveRpcUrl(rpcUrl);
      let cmd = `${FOUNDRY_PATHS.castPath} run ${txHash}`;
      if (resolvedRpc) cmd += ` --rpc-url "${resolvedRpc}"`;
      if (quick) cmd += " --quick";
      if (verbose) cmd += " -v";

      const result = await executeCommand(cmd);
      return {
        content: [
          {
            type: "text",
            text: result.success
              ? `Transaction replay for ${txHash}:\n${result.message}`
              : `Replay failed: ${result.message}`,
          },
        ],
        isError: !result.success,
      };
    }
  );
}

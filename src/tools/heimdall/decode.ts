import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { executeCommand, FOUNDRY_PATHS } from "../../utils/command.js";
import { getHeimdallOutputDir, DEFAULT_RPC_URL, checkHeimdallOrError } from "./utils.js";

export function registerHeimdallDecodeTool(server: McpServer): void {
  server.tool(
    "heimdall_decode",
    "Decode raw calldata without requiring ABI using Heimdall",
    {
      target: z.string().describe("Transaction hash or raw calldata bytes to decode"),
      rpcUrl: z.string().optional().describe(`EVM RPC URL (default: ${DEFAULT_RPC_URL})`),
      explain: z.boolean().optional().describe("Explain decoded calldata using AI"),
      useDefaults: z.boolean().optional().describe("Always select default values"),
      truncateCalldata: z.boolean().optional().describe("Truncate nonstandard sized calldata"),
      skipResolving: z.boolean().optional().describe("Skip resolving selectors"),
      verbosity: z.enum(["quiet", "normal", "verbose"]).optional().describe("Verbosity level"),
    },
    async ({ target, rpcUrl, explain, useDefaults, truncateCalldata, skipResolving, verbosity }) => {
      const err = await checkHeimdallOrError();
      if (err) return err;

      let cmd = `${FOUNDRY_PATHS.heimdallPath} decode "${target}"`;
      if (rpcUrl) cmd += ` -r "${rpcUrl}"`;
      if (explain) cmd += " --explain";
      if (useDefaults) cmd += " -d";
      if (truncateCalldata) cmd += " --truncate-calldata";
      if (skipResolving) cmd += " --skip-resolving";
      if (verbosity === "quiet") cmd += " -q";
      if (verbosity === "verbose") cmd += " -v";

      const result = await executeCommand(cmd);
      if (!result.success)
        return {
          content: [{ type: "text", text: `Decode failed: ${result.message}` }],
          isError: true,
        };

      return {
        content: [{ type: "text", text: `Decoded calldata for ${target}:\n\n${result.message}` }],
      };
    }
  );
}

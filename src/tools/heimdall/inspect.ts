import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { executeCommand, FOUNDRY_PATHS } from "../../utils/command.js";
import {
  getHeimdallOutputDir,
  HEIMDALL_DEFAULT_OUTPUT_PATH,
  DEFAULT_RPC_URL,
  checkHeimdallOrError,
  ensureDirectoryExists,
  readOutputFiles,
} from "./utils.js";

export function registerHeimdallInspectTool(server: McpServer): void {
  server.tool(
    "heimdall_inspect",
    "Detailed inspection of an Ethereum transaction including calldata decoding and trace analysis",
    {
      target: z.string().describe("Transaction hash to inspect"),
      rpcUrl: z.string().optional().describe(`EVM RPC URL (default: ${DEFAULT_RPC_URL})`),
      useDefaults: z.boolean().optional().describe("Always select default values"),
      transposeApiKey: z.string().optional().describe("Transpose.io API key for resolving contract labels"),
      fileName: z.string().optional().describe("Name for output files"),
      skipResolving: z.boolean().optional().describe("Skip resolving function selectors"),
      verbosity: z.enum(["quiet", "normal", "verbose"]).optional().describe("Verbosity level"),
      outputDir: z.string().optional().describe(`Output directory (default: ${HEIMDALL_DEFAULT_OUTPUT_PATH})`),
    },
    async ({ target, rpcUrl, useDefaults, transposeApiKey, fileName, skipResolving, verbosity, outputDir }) => {
      const err = await checkHeimdallOrError();
      if (err) return err;

      const finalOutputDir = getHeimdallOutputDir(outputDir);
      await ensureDirectoryExists(finalOutputDir);

      let cmd = `${FOUNDRY_PATHS.heimdallPath} inspect "${target}"`;
      if (rpcUrl) cmd += ` -r "${rpcUrl}"`;
      if (useDefaults) cmd += " -d";
      if (transposeApiKey) cmd += ` -t "${transposeApiKey}"`;
      if (fileName) cmd += ` -n "${fileName}"`;
      if (skipResolving) cmd += " --skip-resolving";
      if (verbosity === "quiet") cmd += " -q";
      if (verbosity === "verbose") cmd += " -v";
      cmd += ` -o "${finalOutputDir}"`;

      const result = await executeCommand(cmd);
      if (!result.success)
        return {
          content: [{ type: "text", text: `Inspect failed: ${result.message}` }],
          isError: true,
        };

      const files = await readOutputFiles(finalOutputDir, fileName);
      return {
        content: [
          {
            type: "text",
            text: `Transaction inspection for ${target}:\nOutput: ${finalOutputDir}\n\n${files}`,
          },
        ],
      };
    }
  );
}

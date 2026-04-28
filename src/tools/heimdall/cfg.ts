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

export function registerHeimdallCfgTool(server: McpServer): void {
  server.tool(
    "heimdall_cfg",
    "Generate visual control flow graph for EVM bytecode using Heimdall",
    {
      target: z.string().describe("Contract address, bytecode, file, or ENS name"),
      rpcUrl: z.string().optional().describe(`EVM RPC URL (default: ${DEFAULT_RPC_URL})`),
      useDefaults: z.boolean().optional().describe("Always select default values"),
      colorEdges: z.boolean().optional().describe("Color edges based on JUMPI condition"),
      fileName: z.string().optional().describe("Name for the output file"),
      timeout: z.number().optional().describe("Symbolic execution timeout in ms"),
      verbosity: z.enum(["quiet", "normal", "verbose"]).optional().describe("Verbosity level"),
      outputDir: z.string().optional().describe(`Output directory (default: ${HEIMDALL_DEFAULT_OUTPUT_PATH})`),
    },
    async ({ target, rpcUrl, useDefaults, colorEdges, fileName, timeout, verbosity, outputDir }) => {
      const err = await checkHeimdallOrError();
      if (err) return err;

      const finalOutputDir = getHeimdallOutputDir(outputDir);
      await ensureDirectoryExists(finalOutputDir);

      let cmd = `${FOUNDRY_PATHS.heimdallPath} cfg "${target}"`;
      if (rpcUrl) cmd += ` -r "${rpcUrl}"`;
      if (useDefaults) cmd += " -d";
      if (colorEdges) cmd += " -c";
      if (fileName) cmd += ` -n "${fileName}"`;
      if (timeout) cmd += ` -t ${timeout}`;
      if (verbosity === "quiet") cmd += " -q";
      if (verbosity === "verbose") cmd += " -v";
      cmd += ` -o "${finalOutputDir}"`;

      const result = await executeCommand(cmd);
      if (!result.success)
        return {
          content: [{ type: "text", text: `CFG generation failed: ${result.message}` }],
          isError: true,
        };

      const files = await readOutputFiles(finalOutputDir, fileName);
      return {
        content: [
          {
            type: "text",
            text: `Control flow graph for ${target}:\nOutput: ${finalOutputDir}\n\n${files}`,
          },
        ],
      };
    }
  );
}

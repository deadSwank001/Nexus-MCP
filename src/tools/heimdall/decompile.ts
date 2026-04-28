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

export function registerHeimdallDecompileTool(server: McpServer): void {
  server.tool(
    "heimdall_decompile",
    "Decompile EVM bytecode to Solidity source code and ABI using Heimdall",
    {
      target: z.string().describe("Contract address, bytecode, file, or ENS name"),
      rpcUrl: z.string().optional().describe(`EVM RPC URL (default: ${DEFAULT_RPC_URL})`),
      useDefaults: z.boolean().optional().describe("Always select default values"),
      skipResolving: z.boolean().optional().describe("Skip resolving function selectors"),
      includeSol: z.boolean().optional().describe("Include Solidity source code (beta)"),
      includeYul: z.boolean().optional().describe("Include Yul source code (beta)"),
      fileName: z.string().optional().describe("Name for the output file"),
      timeout: z.number().optional().describe("Symbolic execution timeout in ms"),
      verbosity: z.enum(["quiet", "normal", "verbose"]).optional().describe("Verbosity level"),
      outputDir: z.string().optional().describe(`Output directory (default: ${HEIMDALL_DEFAULT_OUTPUT_PATH})`),
    },
    async ({ target, rpcUrl, useDefaults, skipResolving, includeSol, includeYul, fileName, timeout, verbosity, outputDir }) => {
      const err = await checkHeimdallOrError();
      if (err) return err;

      const finalOutputDir = getHeimdallOutputDir(outputDir);
      await ensureDirectoryExists(finalOutputDir);

      let cmd = `${FOUNDRY_PATHS.heimdallPath} decompile "${target}"`;
      if (rpcUrl) cmd += ` -r "${rpcUrl}"`;
      if (useDefaults) cmd += " -d";
      if (skipResolving) cmd += " --skip-resolving";
      if (includeSol) cmd += " --include-sol";
      if (includeYul) cmd += " --include-yul";
      if (fileName) cmd += ` -n "${fileName}"`;
      if (timeout) cmd += ` -t ${timeout}`;
      if (verbosity === "quiet") cmd += " -q";
      if (verbosity === "verbose") cmd += " -v";
      cmd += ` -o "${finalOutputDir}"`;

      const result = await executeCommand(cmd);
      if (!result.success)
        return {
          content: [{ type: "text", text: `Decompile failed: ${result.message}` }],
          isError: true,
        };

      const files = await readOutputFiles(finalOutputDir, fileName);
      return {
        content: [
          {
            type: "text",
            text: `Decompiled ${target}:\nOutput: ${finalOutputDir}\n\n${files}`,
          },
        ],
      };
    }
  );
}

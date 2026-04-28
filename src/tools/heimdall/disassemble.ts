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

export function registerHeimdallDisassembleTool(server: McpServer): void {
  server.tool(
    "heimdall_disassemble",
    "Disassemble EVM bytecode into human-readable opcodes using Heimdall",
    {
      target: z
        .string()
        .describe("Contract address, bytecode, file, or ENS name"),
      rpcUrl: z
        .string()
        .optional()
        .describe(`EVM RPC URL (default: ${DEFAULT_RPC_URL})`),
      decimalCounter: z
        .boolean()
        .optional()
        .describe("Use base-10 for program counter"),
      fileName: z.string().optional().describe("Name for the output file"),
      verbosity: z
        .enum(["quiet", "normal", "verbose"])
        .optional()
        .describe("Verbosity level"),
      outputDir: z
        .string()
        .optional()
        .describe(`Output directory (default: ${HEIMDALL_DEFAULT_OUTPUT_PATH})`),
    },
    async ({ target, rpcUrl, decimalCounter, fileName, verbosity, outputDir }) => {
      const err = await checkHeimdallOrError();
      if (err) return err;

      const finalOutputDir = getHeimdallOutputDir(outputDir);
      await ensureDirectoryExists(finalOutputDir);

      let cmd = `${FOUNDRY_PATHS.heimdallPath} disassemble "${target}"`;
      if (rpcUrl) cmd += ` -r "${rpcUrl}"`;
      if (decimalCounter) cmd += " --decimal-counter";
      if (fileName) cmd += ` -n "${fileName}"`;
      if (verbosity === "quiet") cmd += " -q";
      if (verbosity === "verbose") cmd += " -v";
      cmd += ` -o "${finalOutputDir}"`;

      const result = await executeCommand(cmd);
      if (!result.success)
        return {
          content: [{ type: "text", text: `Disassemble failed: ${result.message}` }],
          isError: true,
        };

      const files = await readOutputFiles(finalOutputDir, fileName);
      return {
        content: [
          {
            type: "text",
            text: `Disassembly for ${target}:\nOutput: ${finalOutputDir}\n\n${files}`,
          },
        ],
      };
    }
  );
}

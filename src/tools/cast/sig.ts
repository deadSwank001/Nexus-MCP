import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  checkFoundryInstalled,
  executeCommand,
  FOUNDRY_PATHS,
  FOUNDRY_NOT_INSTALLED_ERROR,
} from "../../utils/command.js";

export function registerCastSigTool(server: McpServer): void {
  server.tool(
    "cast_sig",
    "Get the 4-byte selector for a function or event signature",
    {
      signature: z
        .string()
        .describe("Function or event signature (e.g., 'transfer(address,uint256)')"),
    },
    async ({ signature }) => {
      if (!(await checkFoundryInstalled()))
        return { content: [{ type: "text", text: FOUNDRY_NOT_INSTALLED_ERROR }], isError: true };

      const cmd = `${FOUNDRY_PATHS.castPath} sig "${signature}"`;
      const result = await executeCommand(cmd);
      return {
        content: [
          {
            type: "text",
            text: result.success
              ? `Selector for "${signature}": ${result.message.trim()}`
              : `Failed: ${result.message}`,
          },
        ],
        isError: !result.success,
      };
    }
  );
}

export function registerCast4ByteTool(server: McpServer): void {
  server.tool(
    "cast_4byte",
    "Lookup function or event signature from the 4byte directory by selector",
    {
      selector: z
        .string()
        .describe("4-byte selector (e.g., '0xa9059cbb') or full calldata"),
    },
    async ({ selector }) => {
      if (!(await checkFoundryInstalled()))
        return { content: [{ type: "text", text: FOUNDRY_NOT_INSTALLED_ERROR }], isError: true };

      const cmd = `${FOUNDRY_PATHS.castPath} 4byte ${selector}`;
      const result = await executeCommand(cmd);
      return {
        content: [
          {
            type: "text",
            text: result.success
              ? `Signatures for ${selector}:\n${result.message.trim()}`
              : `Lookup failed: ${result.message}`,
          },
        ],
        isError: !result.success,
      };
    }
  );
}

export { registerForgeScriptTool } from "./script.js";

import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  checkFoundryInstalled,
  executeCommand,
  FOUNDRY_PATHS,
  FOUNDRY_NOT_INSTALLED_ERROR,
} from "../../utils/command.js";
import { ensureWorkspaceInitialized } from "../../utils/workspace.js";

export function registerForgeBuildTool(server: McpServer): void {
  server.tool(
    "forge_build",
    "Build (compile) the Solidity project in the Forge workspace",
    {
      extraArgs: z
        .string()
        .optional()
        .describe("Extra arguments to pass to forge build (e.g., '--sizes')"),
    },
    async ({ extraArgs }) => {
      if (!(await checkFoundryInstalled()))
        return { content: [{ type: "text", text: FOUNDRY_NOT_INSTALLED_ERROR }], isError: true };

      const workspace = await ensureWorkspaceInitialized();
      let cmd = `cd "${workspace}" && ${FOUNDRY_PATHS.forgePath} build`;
      if (extraArgs) cmd += ` ${extraArgs}`;

      const result = await executeCommand(cmd);
      return {
        content: [
          {
            type: "text",
            text: result.success
              ? `Build succeeded:\n${result.message}`
              : `Build failed:\n${result.message}`,
          },
        ],
        isError: !result.success,
      };
    }
  );
}

export function registerForgeTestTool(server: McpServer): void {
  server.tool(
    "forge_test",
    "Run Forge tests in the workspace",
    {
      match: z.string().optional().describe("Filter test names (regex pattern)"),
      matchContract: z
        .string()
        .optional()
        .describe("Filter contract names (regex pattern)"),
      verbosity: z
        .number()
        .min(0)
        .max(5)
        .optional()
        .describe("Verbosity level 0-5 (default: 2)"),
      rpcUrl: z.string().optional().describe("JSON-RPC URL for fork tests"),
    },
    async ({ match, matchContract, verbosity = 2, rpcUrl }) => {
      if (!(await checkFoundryInstalled()))
        return { content: [{ type: "text", text: FOUNDRY_NOT_INSTALLED_ERROR }], isError: true };

      const workspace = await ensureWorkspaceInitialized();
      let cmd = `cd "${workspace}" && ${FOUNDRY_PATHS.forgePath} test -${"v".repeat(verbosity)}`;
      if (match) cmd += ` --match-test "${match}"`;
      if (matchContract) cmd += ` --match-contract "${matchContract}"`;
      if (rpcUrl) cmd += ` --fork-url "${rpcUrl}"`;

      const result = await executeCommand(cmd);
      return {
        content: [
          {
            type: "text",
            text: result.success
              ? `Tests:\n${result.message}`
              : `Tests failed:\n${result.message}`,
          },
        ],
        isError: !result.success,
      };
    }
  );
}

export function registerInstallDependencyTool(server: McpServer): void {
  server.tool(
    "install_dependency",
    "Install a Forge dependency (e.g., OpenZeppelin contracts) into the workspace",
    {
      dependency: z
        .string()
        .describe("GitHub repo or package to install (e.g., 'OpenZeppelin/openzeppelin-contracts')"),
      version: z
        .string()
        .optional()
        .describe("Version tag or commit (e.g., 'v4.9.0')"),
    },
    async ({ dependency, version }) => {
      if (!(await checkFoundryInstalled()))
        return { content: [{ type: "text", text: FOUNDRY_NOT_INSTALLED_ERROR }], isError: true };

      const workspace = await ensureWorkspaceInitialized();
      const dep = version ? `${dependency}@${version}` : dependency;
      const cmd = `cd "${workspace}" && ${FOUNDRY_PATHS.forgePath} install ${dep} --no-git`;

      const result = await executeCommand(cmd);
      return {
        content: [
          {
            type: "text",
            text: result.success
              ? `Dependency installed: ${dep}\n${result.message}`
              : `Install failed: ${result.message}`,
          },
        ],
        isError: !result.success,
      };
    }
  );
}

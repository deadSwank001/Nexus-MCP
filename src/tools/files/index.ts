import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as fs from "fs/promises";
import * as path from "path";
import { ensureWorkspaceInitialized } from "../../utils/workspace.js";

export function registerCreateSolidityFileTool(server: McpServer): void {
  server.tool(
    "create_solidity_file",
    "Create or update a Solidity file in the workspace",
    {
      filePath: z
        .string()
        .describe(
          "Path relative to workspace (e.g., 'src/MyContract.sol' or 'script/Deploy.s.sol')"
        ),
      content: z.string().describe("File content"),
      overwrite: z
        .boolean()
        .optional()
        .describe("Overwrite existing file (default: false)"),
    },
    async ({ filePath, content, overwrite = false }) => {
      const workspace = await ensureWorkspaceInitialized();
      const fullPath = path.join(workspace, filePath);

      const exists = await fs
        .access(fullPath)
        .then(() => true)
        .catch(() => false);

      if (exists && !overwrite)
        return {
          content: [
            {
              type: "text",
              text: `File already exists at ${fullPath}. Use overwrite=true to replace it.`,
            },
          ],
          isError: true,
        };

      await fs.mkdir(path.dirname(fullPath), { recursive: true });
      await fs.writeFile(fullPath, content, "utf-8");

      return {
        content: [
          {
            type: "text",
            text: `File ${exists ? "updated" : "created"} at ${fullPath}`,
          },
        ],
      };
    }
  );
}

export function registerReadFileTool(server: McpServer): void {
  server.tool(
    "read_file",
    "Read the content of a file from the workspace",
    {
      filePath: z.string().describe("Path relative to workspace"),
    },
    async ({ filePath }) => {
      const workspace = await ensureWorkspaceInitialized();
      const fullPath = path.join(workspace, filePath);

      try {
        const content = await fs.readFile(fullPath, "utf-8");
        return {
          content: [{ type: "text", text: `=== ${filePath} ===\n${content}` }],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Could not read ${fullPath}: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );
}

export function registerListFilesTool(server: McpServer): void {
  server.tool(
    "list_files",
    "List files in the workspace (or a subdirectory)",
    {
      subdir: z
        .string()
        .optional()
        .describe("Subdirectory relative to workspace (default: root)"),
    },
    async ({ subdir }) => {
      const workspace = await ensureWorkspaceInitialized();
      const targetDir = subdir ? path.join(workspace, subdir) : workspace;

      try {
        const entries = await fs.readdir(targetDir, { withFileTypes: true });
        const lines = entries.map((e) => `${e.isDirectory() ? "[dir]" : "[file]"} ${e.name}`);
        return {
          content: [
            {
              type: "text",
              text: `Files in ${targetDir}:\n${lines.join("\n")}`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Could not list files: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );
}

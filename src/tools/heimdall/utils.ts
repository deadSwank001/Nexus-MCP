import * as path from "path";
import * as os from "os";
import * as fs from "fs/promises";
import {
  checkHeimdallInstalled,
  HEIMDALL_NOT_INSTALLED_ERROR,
} from "../../utils/command.js";

export const HEIMDALL_DEFAULT_OUTPUT_PATH =
  "~/.mcp-foundry-workspace/heimdall-output/";
export const DEFAULT_RPC_URL = "http://localhost:8545";

export async function checkHeimdallOrError() {
  const installed = await checkHeimdallInstalled();
  if (!installed) {
    return {
      content: [{ type: "text" as const, text: HEIMDALL_NOT_INSTALLED_ERROR }],
      isError: true,
    };
  }
  return null;
}

export function getHeimdallOutputDir(customDir?: string): string {
  if (customDir) return customDir;
  return path.join(os.homedir(), ".mcp-foundry-workspace", "heimdall-output");
}

export async function ensureDirectoryExists(dirPath: string): Promise<void> {
  await fs.mkdir(dirPath, { recursive: true });
}

export async function readOutputFiles(
  outputDir: string,
  fileName?: string
): Promise<string> {
  try {
    const files = await fs.readdir(outputDir);
    const targets = fileName
      ? files.filter((f) => f.includes(fileName))
      : files;
    if (targets.length === 0) return "No output files found.";

    let content = "";
    for (const file of targets) {
      const filePath = path.join(outputDir, file);
      const stat = await fs.stat(filePath);
      if (stat.isFile()) {
        const text = await fs.readFile(filePath, "utf-8");
        content += `\n=== ${file} ===\n${text}\n`;
      }
    }
    return content || "Output files are empty.";
  } catch (error) {
    return `Error reading output files: ${error instanceof Error ? error.message : String(error)}`;
  }
}

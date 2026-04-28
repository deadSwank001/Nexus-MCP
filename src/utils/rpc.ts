import * as fs from "fs/promises";
import * as path from "path";
import { exec } from "child_process";
import { promisify } from "util";
import { FOUNDRY_PATHS } from "./command.js";

const execAsync = promisify(exec);

export const DEFAULT_RPC_URL = process.env.RPC_URL ?? "http://localhost:8545";

export async function resolveRpcUrl(rpcUrl?: string): Promise<string> {
  if (!rpcUrl) return DEFAULT_RPC_URL;

  if (!rpcUrl.startsWith("http")) {
    try {
      const configPath = path.join(
        FOUNDRY_PATHS.homeDir,
        ".foundry",
        "config.toml"
      );
      const exists = await fs
        .access(configPath)
        .then(() => true)
        .catch(() => false);
      if (exists) {
        const content = await fs.readFile(configPath, "utf8");
        const m = new RegExp(
          `\\[rpc_endpoints\\][\\s\\S]*?${rpcUrl}\\s*=\\s*["']([^"']+)["']`
        ).exec(content);
        if (m?.[1]) return m[1];
      }
    } catch {
      // fall through
    }
  }

  return rpcUrl;
}

export async function getAnvilInfo(): Promise<{
  running: boolean;
  port?: string;
  url?: string;
}> {
  try {
    const { stdout } = await execAsync("ps aux | grep anvil | grep -v grep");
    if (!stdout.trim()) return { running: false };
    const portMatch = stdout.match(/--port\s+(\d+)/);
    const port = portMatch?.[1] ?? "8545";
    return { running: true, port, url: `http://localhost:${port}` };
  } catch {
    return { running: false };
  }
}

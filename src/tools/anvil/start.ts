import { z } from "zod";
import { exec } from "child_process";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  checkFoundryInstalled,
  FOUNDRY_PATHS,
  FOUNDRY_NOT_INSTALLED_ERROR,
} from "../../utils/command.js";
import { getAnvilInfo } from "../../utils/rpc.js";

export function registerAnvilStartTool(server: McpServer): void {
  server.tool(
    "anvil_start",
    "Start a new local Anvil Ethereum node",
    {
      port: z.number().optional().describe("Port (default: 8545)"),
      blockTime: z
        .number()
        .optional()
        .describe("Block time in seconds (0 = mine on demand)"),
      forkUrl: z
        .string()
        .optional()
        .describe("URL to fork from (e.g., mainnet RPC)"),
      forkBlockNumber: z
        .number()
        .optional()
        .describe("Block number to fork from"),
      accounts: z
        .number()
        .optional()
        .describe("Number of accounts to generate (default: 10)"),
      mnemonic: z.string().optional().describe("BIP39 mnemonic phrase"),
      silent: z
        .boolean()
        .optional()
        .describe("Suppress anvil output (default: false)"),
    },
    async ({
      port = 8545,
      blockTime,
      forkUrl,
      forkBlockNumber,
      accounts,
      mnemonic,
      silent = false,
    }) => {
      if (!(await checkFoundryInstalled()))
        return {
          content: [{ type: "text", text: FOUNDRY_NOT_INSTALLED_ERROR }],
          isError: true,
        };

      const existing = await getAnvilInfo();
      if (existing.running)
        return {
          content: [
            {
              type: "text",
              text: `Anvil is already running on port ${existing.port}.`,
            },
          ],
          isError: true,
        };

      let cmd = `${FOUNDRY_PATHS.anvilPath} --port ${port}`;
      if (blockTime !== undefined) cmd += ` --block-time ${blockTime}`;
      if (forkUrl) {
        cmd += ` --fork-url "${forkUrl}"`;
        if (forkBlockNumber !== undefined)
          cmd += ` --fork-block-number ${forkBlockNumber}`;
      }
      if (accounts !== undefined) cmd += ` --accounts ${accounts}`;
      if (mnemonic) cmd += ` --mnemonic "${mnemonic}"`;

      try {
        const child = exec(cmd, (error, stdout, stderr) => {
          if (!silent) {
            if (error) console.error(`Anvil error: ${error.message}`);
            if (stderr) console.error(`Anvil stderr: ${stderr}`);
            if (stdout) console.log(`Anvil stdout: ${stdout}`);
          }
        });

        await new Promise((resolve) => setTimeout(resolve, 1200));
        const info = await getAnvilInfo();
        if (info.running) {
          return {
            content: [
              {
                type: "text",
                text: `Anvil started on port ${port}. RPC: http://localhost:${port}\nPID: ${child.pid}`,
              },
            ],
          };
        }
        return {
          content: [
            { type: "text", text: "Failed to start Anvil. Check system logs." },
          ],
          isError: true,
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error starting Anvil: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );
}

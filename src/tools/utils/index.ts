import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  checkFoundryInstalled,
  executeCommand,
  FOUNDRY_PATHS,
  FOUNDRY_NOT_INSTALLED_ERROR,
} from "../../utils/command.js";
import { resolveRpcUrl } from "../../utils/rpc.js";

export function registerConvertEthUnitsTool(server: McpServer): void {
  server.tool(
    "convert_eth_units",
    "Convert between Ethereum units (wei, gwei, ether)",
    {
      value: z.string().describe("Value to convert"),
      fromUnit: z.enum(["wei", "gwei", "ether"]).describe("Source unit"),
      toUnit: z.enum(["wei", "gwei", "ether"]).describe("Target unit"),
    },
    async ({ value, fromUnit, toUnit }) => {
      if (!(await checkFoundryInstalled()))
        return { content: [{ type: "text", text: FOUNDRY_NOT_INSTALLED_ERROR }], isError: true };

      const cmd = `${FOUNDRY_PATHS.castPath} to-unit ${value}${fromUnit} ${toUnit}`;
      const result = await executeCommand(cmd);
      return {
        content: [
          {
            type: "text",
            text: result.success
              ? `${value} ${fromUnit} = ${result.message.trim()} ${toUnit}`
              : `Conversion failed: ${result.message}`,
          },
        ],
        isError: !result.success,
      };
    }
  );
}

export function registerComputeAddressTool(server: McpServer): void {
  server.tool(
    "compute_address",
    "Compute the address of a contract that would be deployed from a given address and nonce",
    {
      deployerAddress: z.string().describe("Address of the deployer"),
      nonce: z
        .string()
        .optional()
        .describe("Nonce of the transaction (default: current nonce)"),
      rpcUrl: z.string().optional().describe("JSON-RPC URL to fetch current nonce"),
    },
    async ({ deployerAddress, nonce, rpcUrl }) => {
      if (!(await checkFoundryInstalled()))
        return { content: [{ type: "text", text: FOUNDRY_NOT_INSTALLED_ERROR }], isError: true };

      let cmd = `${FOUNDRY_PATHS.castPath} compute-address ${deployerAddress}`;
      if (nonce !== undefined) cmd += ` --nonce ${nonce}`;
      if (rpcUrl) {
        const resolved = await resolveRpcUrl(rpcUrl);
        cmd += ` --rpc-url "${resolved}"`;
      }

      const result = await executeCommand(cmd);
      return {
        content: [
          {
            type: "text",
            text: result.success
              ? `Computed address: ${result.message.trim()}`
              : `Failed: ${result.message}`,
          },
        ],
        isError: !result.success,
      };
    }
  );
}

export function registerContractSizeTool(server: McpServer): void {
  server.tool(
    "contract_size",
    "Get the bytecode size (in bytes) of a deployed contract",
    {
      contractAddress: z.string().describe("Address of the deployed contract"),
      rpcUrl: z.string().optional().describe("JSON-RPC URL"),
    },
    async ({ contractAddress, rpcUrl }) => {
      if (!(await checkFoundryInstalled()))
        return { content: [{ type: "text", text: FOUNDRY_NOT_INSTALLED_ERROR }], isError: true };

      const resolved = await resolveRpcUrl(rpcUrl);
      const cmd = `${FOUNDRY_PATHS.castPath} codesize ${contractAddress} --rpc-url "${resolved}"`;

      const result = await executeCommand(cmd);
      return {
        content: [
          {
            type: "text",
            text: result.success
              ? `Bytecode size of ${contractAddress}: ${result.message.trim()} bytes`
              : `Failed: ${result.message}`,
          },
        ],
        isError: !result.success,
      };
    }
  );
}

export function registerEstimateGasTool(server: McpServer): void {
  server.tool(
    "estimate_gas",
    "Estimate the gas cost of a transaction or contract call",
    {
      contractAddress: z.string().describe("Target contract address"),
      functionSignature: z
        .string()
        .describe("Function signature (e.g., 'transfer(address,uint256)')"),
      args: z.array(z.string()).optional().describe("Function arguments"),
      from: z.string().optional().describe("Sender address"),
      value: z.string().optional().describe("ETH value to send (wei)"),
      rpcUrl: z.string().optional().describe("JSON-RPC URL"),
    },
    async ({ contractAddress, functionSignature, args = [], from, value, rpcUrl }) => {
      if (!(await checkFoundryInstalled()))
        return { content: [{ type: "text", text: FOUNDRY_NOT_INSTALLED_ERROR }], isError: true };

      const resolved = await resolveRpcUrl(rpcUrl);
      let cmd = `${FOUNDRY_PATHS.castPath} estimate ${contractAddress} "${functionSignature}"`;
      if (args.length > 0) cmd += " " + args.join(" ");
      if (from) cmd += ` --from ${from}`;
      if (value) cmd += ` --value ${value}`;
      if (resolved) cmd += ` --rpc-url "${resolved}"`;

      const result = await executeCommand(cmd);
      return {
        content: [
          {
            type: "text",
            text: result.success
              ? `Estimated gas for ${functionSignature.split("(")[0]}: ${result.message.trim()} gas`
              : `Estimation failed: ${result.message}`,
          },
        ],
        isError: !result.success,
      };
    }
  );
}

export function registerGenerateWalletTool(server: McpServer): void {
  server.tool(
    "generate_wallet",
    "Generate a new random Ethereum wallet (address + private key)",
    {},
    async () => {
      if (!(await checkFoundryInstalled()))
        return { content: [{ type: "text", text: FOUNDRY_NOT_INSTALLED_ERROR }], isError: true };

      const cmd = `${FOUNDRY_PATHS.castPath} wallet new`;
      const result = await executeCommand(cmd);
      return {
        content: [
          {
            type: "text",
            text: result.success
              ? `New wallet generated:\n${result.message}`
              : `Failed: ${result.message}`,
          },
        ],
        isError: !result.success,
      };
    }
  );
}

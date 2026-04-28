#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import * as dotenv from "dotenv";
import { checkFoundryInstalled } from "./utils/command.js";
import { registerAllCastTools } from "./tools/cast/index.js";
import { registerAllAnvilTools } from "./tools/anvil/index.js";
import {
  registerForgeScriptTool,
  registerForgeBuildTool,
  registerForgeTestTool,
  registerInstallDependencyTool,
} from "./tools/forge/index.js";
import {
  registerConvertEthUnitsTool,
  registerComputeAddressTool,
  registerContractSizeTool,
  registerEstimateGasTool,
  registerGenerateWalletTool,
} from "./tools/utils/index.js";
import {
  registerCreateSolidityFileTool,
  registerReadFileTool,
  registerListFilesTool,
} from "./tools/files/index.js";
import { registerAllHeimdallTools } from "./tools/heimdall/index.js";
import { registerAllResources } from "./resources/index.js";

dotenv.config();

const server = new McpServer(
  { name: "foundry-reverse", version: "1.0.0" },
  {
    instructions: `
Foundry-Reverse MCP Server — Enhanced Foundry/EVM toolkit for local AI agents (Ollama, LM Studio, etc.)

## Available Tool Categories

### Anvil (Local Ethereum Node)
- anvil_start / anvil_stop / anvil_status

### Cast (EVM RPC Client)
- cast_call       — read-only contract calls
- cast_send       — send signed transactions (requires PRIVATE_KEY)
- cast_balance    — ETH balance lookup
- cast_receipt    — transaction receipt
- cast_chain      — chain name / ID
- cast_storage    — read contract storage slots
- cast_run        — replay published transactions locally
- cast_logs       — fetch event logs
- cast_sig        — compute 4-byte selector
- cast_4byte      — reverse-lookup selector from 4byte.directory

### Forge (Smart Contract Development)
- forge_script        — run Forge scripts
- forge_build         — compile the workspace
- forge_test          — run tests
- install_dependency  — install forge libs (e.g., OpenZeppelin)

### File Management
- create_solidity_file — create/update Solidity files in workspace
- read_file            — read a workspace file
- list_files           — list workspace files

### Utilities
- convert_eth_units   — wei / gwei / ether conversion
- compute_address     — deterministic contract address from deployer + nonce
- contract_size       — deployed bytecode size
- estimate_gas        — gas estimation
- generate_wallet     — create a new random wallet

### Heimdall (EVM Bytecode Analysis)
- heimdall_disassemble — bytecode → opcodes
- heimdall_decode      — calldata decoding without ABI
- heimdall_decompile   — bytecode → Solidity / ABI
- heimdall_cfg         — control flow graph
- heimdall_inspect     — full transaction inspection

## Resources
- anvil://status              — live Anvil status
- contract://{address}/source — Etherscan source for a contract

## Configuration
Set these environment variables (optional):
- RPC_URL     — default JSON-RPC endpoint
- PRIVATE_KEY — private key for cast_send
    `,
  }
);

// Resources
registerAllResources(server);

// Cast tools
registerAllCastTools(server);

// Anvil tools
registerAllAnvilTools(server);

// Forge tools
registerForgeScriptTool(server);
registerForgeBuildTool(server);
registerForgeTestTool(server);
registerInstallDependencyTool(server);

// Utility tools
registerConvertEthUnitsTool(server);
registerComputeAddressTool(server);
registerContractSizeTool(server);
registerEstimateGasTool(server);
registerGenerateWalletTool(server);

// File management tools
registerCreateSolidityFileTool(server);
registerReadFileTool(server);
registerListFilesTool(server);

// Heimdall tools
registerAllHeimdallTools(server);

async function startServer() {
  const foundryInstalled = await checkFoundryInstalled();
  if (!foundryInstalled) {
    console.error("⚠  Foundry is not installed. Install via: https://book.getfoundry.sh/getting-started/installation");
    console.error("   The server will start but Foundry-dependent tools will return errors.");
  }

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("✓ Foundry-Reverse MCP Server running on stdio");
}

startServer().catch((error) => {
  console.error("Fatal error starting server:", error);
  process.exit(1);
});

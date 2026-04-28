#!/usr/bin/env node
/**
 * Foundry-Reverse Ollama Agent
 *
 * A standalone agent that uses a local Ollama model as the LLM backbone and
 * calls the Foundry MCP tools directly. Run this instead of (or alongside)
 * the MCP server when you want a conversational, terminal-based experience
 * without needing a separate MCP client (e.g., Claude Desktop or Cursor).
 *
 * Usage:
 *   OLLAMA_MODEL=qwen2.5:7b node dist/ollama-agent.js
 *   # or interactively:
 *   node dist/ollama-agent.js
 */

import * as readline from "readline";
import * as dotenv from "dotenv";
import { Ollama } from "ollama";
import type { Message, Tool, ToolCall } from "ollama";

// ─── Tool implementations ────────────────────────────────────────────────────
import { checkFoundryInstalled, executeCommand, FOUNDRY_PATHS } from "./utils/command.js";
import { resolveRpcUrl, getAnvilInfo } from "./utils/rpc.js";
import { ensureWorkspaceInitialized } from "./utils/workspace.js";
import * as fs from "fs/promises";
import * as path from "path";
import { exec } from "child_process";
import * as os from "os";
import { promisify } from "util";

const execAsync = promisify(exec);

dotenv.config();

const OLLAMA_HOST = process.env.OLLAMA_HOST ?? "http://localhost:11434";
const MODEL = process.env.OLLAMA_MODEL ?? "qwen2.5:7b";

const ollama = new Ollama({ host: OLLAMA_HOST });

// ─── Tool definitions (Ollama tool-calling schema) ───────────────────────────

const TOOLS: Tool[] = [
  {
    type: "function",
    function: {
      name: "cast_call",
      description: "Call a contract function (read-only, no gas cost)",
      parameters: {
        type: "object",
        properties: {
          contractAddress: { type: "string", description: "Contract address" },
          functionSignature: { type: "string", description: "Function signature e.g. balanceOf(address)" },
          args: { type: "array", items: { type: "string" }, description: "Function arguments" },
          rpcUrl: { type: "string", description: "JSON-RPC URL" },
          blockNumber: { type: "string", description: "Block number" },
          from: { type: "string", description: "Caller address" },
        },
        required: ["contractAddress", "functionSignature"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "cast_balance",
      description: "Check the ETH balance of an address",
      parameters: {
        type: "object",
        properties: {
          address: { type: "string", description: "Ethereum address" },
          rpcUrl: { type: "string", description: "JSON-RPC URL" },
          formatEther: { type: "boolean", description: "Return balance in ETH instead of wei" },
        },
        required: ["address"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "cast_send",
      description: "Send a transaction to a contract function (requires PRIVATE_KEY env var)",
      parameters: {
        type: "object",
        properties: {
          contractAddress: { type: "string", description: "Contract address" },
          functionSignature: { type: "string", description: "Function signature" },
          args: { type: "array", items: { type: "string" }, description: "Arguments" },
          value: { type: "string", description: "ETH value in wei" },
          rpcUrl: { type: "string", description: "JSON-RPC URL" },
          gasLimit: { type: "string", description: "Gas limit" },
        },
        required: ["contractAddress", "functionSignature"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "cast_chain",
      description: "Get chain name or ID",
      parameters: {
        type: "object",
        properties: {
          rpcUrl: { type: "string", description: "JSON-RPC URL" },
          returnId: { type: "boolean", description: "Return chain ID instead of name" },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "cast_receipt",
      description: "Get transaction receipt",
      parameters: {
        type: "object",
        properties: {
          txHash: { type: "string", description: "Transaction hash" },
          rpcUrl: { type: "string", description: "JSON-RPC URL" },
        },
        required: ["txHash"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "cast_storage",
      description: "Read contract storage at a specific slot",
      parameters: {
        type: "object",
        properties: {
          contractAddress: { type: "string", description: "Contract address" },
          slot: { type: "string", description: "Storage slot (decimal or hex)" },
          rpcUrl: { type: "string", description: "JSON-RPC URL" },
        },
        required: ["contractAddress", "slot"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "cast_logs",
      description: "Get event logs from a contract",
      parameters: {
        type: "object",
        properties: {
          signature: { type: "string", description: "Event signature" },
          address: { type: "string", description: "Contract address" },
          fromBlock: { type: "string", description: "Starting block" },
          toBlock: { type: "string", description: "Ending block" },
          rpcUrl: { type: "string", description: "JSON-RPC URL" },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "cast_sig",
      description: "Get 4-byte selector for a function or event signature",
      parameters: {
        type: "object",
        properties: {
          signature: { type: "string", description: "Function/event signature" },
        },
        required: ["signature"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "cast_4byte",
      description: "Lookup function/event signature from the 4byte directory by selector",
      parameters: {
        type: "object",
        properties: {
          selector: { type: "string", description: "4-byte selector (0x...)" },
        },
        required: ["selector"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "anvil_start",
      description: "Start a local Anvil Ethereum node",
      parameters: {
        type: "object",
        properties: {
          port: { type: "number", description: "Port (default: 8545)" },
          forkUrl: { type: "string", description: "URL to fork from" },
          forkBlockNumber: { type: "number", description: "Block to fork from" },
          accounts: { type: "number", description: "Number of accounts" },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "anvil_stop",
      description: "Stop the running Anvil instance",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function",
    function: {
      name: "anvil_status",
      description: "Check if Anvil is running",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function",
    function: {
      name: "forge_build",
      description: "Compile the Forge workspace",
      parameters: {
        type: "object",
        properties: {
          extraArgs: { type: "string", description: "Extra CLI args for forge build" },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "forge_test",
      description: "Run Forge tests in the workspace",
      parameters: {
        type: "object",
        properties: {
          match: { type: "string", description: "Test name regex filter" },
          verbosity: { type: "number", description: "Verbosity 0-5" },
          rpcUrl: { type: "string", description: "Fork RPC URL" },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "forge_script",
      description: "Run a Forge deployment/migration script",
      parameters: {
        type: "object",
        properties: {
          scriptPath: { type: "string", description: "Path relative to workspace" },
          sig: { type: "string", description: "Function to call (default: run())" },
          rpcUrl: { type: "string", description: "JSON-RPC URL" },
          broadcast: { type: "boolean", description: "Broadcast transactions" },
        },
        required: ["scriptPath"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "install_dependency",
      description: "Install a Forge dependency (e.g., OpenZeppelin/openzeppelin-contracts)",
      parameters: {
        type: "object",
        properties: {
          dependency: { type: "string", description: "GitHub repo slug or package name" },
          version: { type: "string", description: "Version tag" },
        },
        required: ["dependency"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_solidity_file",
      description: "Create or update a Solidity file in the workspace",
      parameters: {
        type: "object",
        properties: {
          filePath: { type: "string", description: "Path relative to workspace" },
          content: { type: "string", description: "File content" },
          overwrite: { type: "boolean", description: "Overwrite existing file" },
        },
        required: ["filePath", "content"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "read_file",
      description: "Read a file from the workspace",
      parameters: {
        type: "object",
        properties: {
          filePath: { type: "string", description: "Path relative to workspace" },
        },
        required: ["filePath"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_files",
      description: "List files in the workspace",
      parameters: {
        type: "object",
        properties: {
          subdir: { type: "string", description: "Subdirectory to list" },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "convert_eth_units",
      description: "Convert between Ethereum units (wei, gwei, ether)",
      parameters: {
        type: "object",
        properties: {
          value: { type: "string", description: "Value to convert" },
          fromUnit: { type: "string", enum: ["wei", "gwei", "ether"], description: "Source unit" },
          toUnit: { type: "string", enum: ["wei", "gwei", "ether"], description: "Target unit" },
        },
        required: ["value", "fromUnit", "toUnit"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "compute_address",
      description: "Compute deterministic contract deploy address from deployer + nonce",
      parameters: {
        type: "object",
        properties: {
          deployerAddress: { type: "string", description: "Deployer address" },
          nonce: { type: "string", description: "Nonce" },
          rpcUrl: { type: "string", description: "JSON-RPC URL" },
        },
        required: ["deployerAddress"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "contract_size",
      description: "Get the deployed bytecode size of a contract",
      parameters: {
        type: "object",
        properties: {
          contractAddress: { type: "string", description: "Contract address" },
          rpcUrl: { type: "string", description: "JSON-RPC URL" },
        },
        required: ["contractAddress"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "estimate_gas",
      description: "Estimate gas for a transaction",
      parameters: {
        type: "object",
        properties: {
          contractAddress: { type: "string", description: "Target contract" },
          functionSignature: { type: "string", description: "Function signature" },
          args: { type: "array", items: { type: "string" }, description: "Arguments" },
          from: { type: "string", description: "Sender address" },
          rpcUrl: { type: "string", description: "JSON-RPC URL" },
        },
        required: ["contractAddress", "functionSignature"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "generate_wallet",
      description: "Generate a new random Ethereum wallet",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
];

// ─── Tool executor ────────────────────────────────────────────────────────────

async function executeTool(
  name: string,
  args: Record<string, unknown>
): Promise<string> {
  const rpcUrl = (args.rpcUrl as string | undefined);

  switch (name) {
    case "cast_call": {
      const rpc = await resolveRpcUrl(rpcUrl);
      const contractAddress = args.contractAddress as string;
      const functionSignature = args.functionSignature as string;
      const callArgs = (args.args as string[] | undefined) ?? [];
      let cmd = `${FOUNDRY_PATHS.castPath} call ${contractAddress} "${functionSignature}"`;
      if (callArgs.length) cmd += " " + callArgs.join(" ");
      if (rpc) cmd += ` --rpc-url "${rpc}"`;
      if (args.blockNumber) cmd += ` --block ${args.blockNumber}`;
      if (args.from) cmd += ` --from ${args.from}`;
      const r = await executeCommand(cmd);
      return r.success ? r.message.trim() : `Error: ${r.message}`;
    }

    case "cast_balance": {
      const rpc = await resolveRpcUrl(rpcUrl);
      let cmd = `${FOUNDRY_PATHS.castPath} balance ${args.address}`;
      if (rpc) cmd += ` --rpc-url "${rpc}"`;
      if (args.formatEther) cmd += " --ether";
      const r = await executeCommand(cmd);
      return r.success
        ? `${r.message.trim()} ${args.formatEther ? "ETH" : "wei"}`
        : `Error: ${r.message}`;
    }

    case "cast_send": {
      const pk = process.env.PRIVATE_KEY;
      if (!pk) return "Error: PRIVATE_KEY env var is not set.";
      const rpc = await resolveRpcUrl(rpcUrl);
      let cmd = `${FOUNDRY_PATHS.castPath} send ${args.contractAddress} "${args.functionSignature}" --private-key "${pk}"`;
      const sendArgs = (args.args as string[] | undefined) ?? [];
      if (sendArgs.length) cmd += " " + sendArgs.join(" ");
      if (args.value) cmd += ` --value ${args.value}`;
      if (rpc) cmd += ` --rpc-url "${rpc}"`;
      if (args.gasLimit) cmd += ` --gas-limit ${args.gasLimit}`;
      const r = await executeCommand(cmd);
      return r.success ? r.message : `Error: ${r.message}`;
    }

    case "cast_chain": {
      const rpc = await resolveRpcUrl(rpcUrl);
      const cmd = args.returnId
        ? `${FOUNDRY_PATHS.castPath} chain-id --rpc-url "${rpc}"`
        : `${FOUNDRY_PATHS.castPath} chain --rpc-url "${rpc}"`;
      const r = await executeCommand(cmd);
      return r.success ? r.message.trim() : `Error: ${r.message}`;
    }

    case "cast_receipt": {
      const rpc = await resolveRpcUrl(rpcUrl);
      let cmd = `${FOUNDRY_PATHS.castPath} receipt ${args.txHash}`;
      if (rpc) cmd += ` --rpc-url "${rpc}"`;
      const r = await executeCommand(cmd);
      return r.success ? r.message : `Error: ${r.message}`;
    }

    case "cast_storage": {
      const rpc = await resolveRpcUrl(rpcUrl);
      let cmd = `${FOUNDRY_PATHS.castPath} storage ${args.contractAddress} ${args.slot}`;
      if (rpc) cmd += ` --rpc-url "${rpc}"`;
      const r = await executeCommand(cmd);
      return r.success ? r.message.trim() : `Error: ${r.message}`;
    }

    case "cast_logs": {
      const rpc = await resolveRpcUrl(rpcUrl);
      let cmd = `${FOUNDRY_PATHS.castPath} logs`;
      if (args.signature) cmd += ` "${args.signature}"`;
      if (args.address) cmd += ` --address ${args.address}`;
      if (args.fromBlock) cmd += ` --from-block ${args.fromBlock}`;
      if (args.toBlock) cmd += ` --to-block ${args.toBlock}`;
      if (rpc) cmd += ` --rpc-url "${rpc}"`;
      const r = await executeCommand(cmd);
      return r.success ? r.message : `Error: ${r.message}`;
    }

    case "cast_sig": {
      const cmd = `${FOUNDRY_PATHS.castPath} sig "${args.signature}"`;
      const r = await executeCommand(cmd);
      return r.success ? r.message.trim() : `Error: ${r.message}`;
    }

    case "cast_4byte": {
      const cmd = `${FOUNDRY_PATHS.castPath} 4byte ${args.selector}`;
      const r = await executeCommand(cmd);
      return r.success ? r.message.trim() : `Error: ${r.message}`;
    }

    case "anvil_start": {
      const existing = await getAnvilInfo();
      if (existing.running)
        return `Anvil is already running on port ${existing.port}.`;
      const port = (args.port as number | undefined) ?? 8545;
      let cmd = `${FOUNDRY_PATHS.anvilPath} --port ${port}`;
      if (args.forkUrl) {
        cmd += ` --fork-url "${args.forkUrl}"`;
        if (args.forkBlockNumber) cmd += ` --fork-block-number ${args.forkBlockNumber}`;
      }
      if (args.accounts) cmd += ` --accounts ${args.accounts}`;
      exec(cmd, (err, _, stderr) => {
        if (err) console.error("Anvil:", err.message);
        if (stderr) console.error("Anvil stderr:", stderr);
      });
      await new Promise((r) => setTimeout(r, 1200));
      const info = await getAnvilInfo();
      return info.running
        ? `Anvil started on port ${port}. RPC: http://localhost:${port}`
        : "Failed to start Anvil.";
    }

    case "anvil_stop": {
      const info = await getAnvilInfo();
      if (!info.running) return "No Anvil instance running.";
      try {
        if (os.platform() === "win32") {
          await execAsync("taskkill /F /IM anvil.exe");
        } else {
          await execAsync("pkill -f anvil");
        }
        await new Promise((r) => setTimeout(r, 600));
        const newInfo = await getAnvilInfo();
        return newInfo.running ? "Failed to stop Anvil." : "Anvil stopped.";
      } catch (e) {
        return `Error stopping Anvil: ${e instanceof Error ? e.message : String(e)}`;
      }
    }

    case "anvil_status": {
      const info = await getAnvilInfo();
      return info.running
        ? `Anvil running on port ${info.port}. RPC: ${info.url}`
        : "Anvil is not running.";
    }

    case "forge_build": {
      const workspace = await ensureWorkspaceInitialized();
      let cmd = `cd "${workspace}" && ${FOUNDRY_PATHS.forgePath} build`;
      if (args.extraArgs) cmd += ` ${args.extraArgs}`;
      const r = await executeCommand(cmd);
      return r.success ? r.message : `Build failed:\n${r.message}`;
    }

    case "forge_test": {
      const workspace = await ensureWorkspaceInitialized();
      const v = (args.verbosity as number | undefined) ?? 2;
      let cmd = `cd "${workspace}" && ${FOUNDRY_PATHS.forgePath} test -${"v".repeat(v)}`;
      if (args.match) cmd += ` --match-test "${args.match}"`;
      if (args.matchContract) cmd += ` --match-contract "${args.matchContract}"`;
      if (rpcUrl) cmd += ` --fork-url "${rpcUrl}"`;
      const r = await executeCommand(cmd);
      return r.message;
    }

    case "forge_script": {
      const workspace = await ensureWorkspaceInitialized();
      const scriptPath = args.scriptPath as string;
      const fullPath = path.join(workspace, scriptPath);
      const exists = await fs
        .access(fullPath)
        .then(() => true)
        .catch(() => false);
      if (!exists) return `Script not found at ${fullPath}`;
      const rpc = await resolveRpcUrl(rpcUrl);
      const sig = (args.sig as string | undefined) ?? "run()";
      let cmd = `cd "${workspace}" && ${FOUNDRY_PATHS.forgePath} script ${scriptPath} --sig "${sig}"`;
      if (rpc) cmd += ` --rpc-url "${rpc}"`;
      if (args.broadcast) cmd += " --broadcast";
      const r = await executeCommand(cmd);
      return r.success ? r.message : `Script failed:\n${r.message}`;
    }

    case "install_dependency": {
      const workspace = await ensureWorkspaceInitialized();
      const dep = args.version
        ? `${args.dependency}@${args.version}`
        : (args.dependency as string);
      const cmd = `cd "${workspace}" && ${FOUNDRY_PATHS.forgePath} install ${dep} --no-git`;
      const r = await executeCommand(cmd);
      return r.success ? `Installed ${dep}` : `Install failed:\n${r.message}`;
    }

    case "create_solidity_file": {
      const workspace = await ensureWorkspaceInitialized();
      const filePath = args.filePath as string;
      const fullPath = path.join(workspace, filePath);
      const content = args.content as string;
      const overwrite = (args.overwrite as boolean | undefined) ?? false;
      const exists = await fs
        .access(fullPath)
        .then(() => true)
        .catch(() => false);
      if (exists && !overwrite)
        return `File exists at ${fullPath}. Set overwrite=true to replace.`;
      await fs.mkdir(path.dirname(fullPath), { recursive: true });
      await fs.writeFile(fullPath, content, "utf-8");
      return `File ${exists ? "updated" : "created"} at ${fullPath}`;
    }

    case "read_file": {
      const workspace = await ensureWorkspaceInitialized();
      const fullPath = path.join(workspace, args.filePath as string);
      try {
        const content = await fs.readFile(fullPath, "utf-8");
        return content;
      } catch (e) {
        return `Error reading file: ${e instanceof Error ? e.message : String(e)}`;
      }
    }

    case "list_files": {
      const workspace = await ensureWorkspaceInitialized();
      const targetDir = args.subdir
        ? path.join(workspace, args.subdir as string)
        : workspace;
      try {
        const entries = await fs.readdir(targetDir, { withFileTypes: true });
        return entries
          .map((e) => `${e.isDirectory() ? "[dir] " : "[file]"} ${e.name}`)
          .join("\n");
      } catch (e) {
        return `Error listing files: ${e instanceof Error ? e.message : String(e)}`;
      }
    }

    case "convert_eth_units": {
      const cmd = `${FOUNDRY_PATHS.castPath} to-unit ${args.value}${args.fromUnit} ${args.toUnit}`;
      const r = await executeCommand(cmd);
      return r.success
        ? `${args.value} ${args.fromUnit} = ${r.message.trim()} ${args.toUnit}`
        : `Error: ${r.message}`;
    }

    case "compute_address": {
      let cmd = `${FOUNDRY_PATHS.castPath} compute-address ${args.deployerAddress}`;
      if (args.nonce !== undefined) cmd += ` --nonce ${args.nonce}`;
      if (rpcUrl) {
        const rpc = await resolveRpcUrl(rpcUrl);
        cmd += ` --rpc-url "${rpc}"`;
      }
      const r = await executeCommand(cmd);
      return r.success ? r.message.trim() : `Error: ${r.message}`;
    }

    case "contract_size": {
      const rpc = await resolveRpcUrl(rpcUrl);
      const cmd = `${FOUNDRY_PATHS.castPath} codesize ${args.contractAddress} --rpc-url "${rpc}"`;
      const r = await executeCommand(cmd);
      return r.success ? `${r.message.trim()} bytes` : `Error: ${r.message}`;
    }

    case "estimate_gas": {
      const rpc = await resolveRpcUrl(rpcUrl);
      const estArgs = (args.args as string[] | undefined) ?? [];
      let cmd = `${FOUNDRY_PATHS.castPath} estimate ${args.contractAddress} "${args.functionSignature}"`;
      if (estArgs.length) cmd += " " + estArgs.join(" ");
      if (args.from) cmd += ` --from ${args.from}`;
      if (rpc) cmd += ` --rpc-url "${rpc}"`;
      const r = await executeCommand(cmd);
      return r.success ? `${r.message.trim()} gas` : `Error: ${r.message}`;
    }

    case "generate_wallet": {
      const r = await executeCommand(`${FOUNDRY_PATHS.castPath} wallet new`);
      return r.success ? r.message : `Error: ${r.message}`;
    }

    default:
      return `Unknown tool: ${name}`;
  }
}

// ─── Main agent loop ──────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are a Solidity / EVM development assistant with access to the Foundry toolchain (cast, forge, anvil) and Heimdall bytecode analysis tools.

Use the provided tools to answer questions and complete tasks. Always explain what you are doing and present results clearly.
When the user asks you to perform an on-chain action, use the appropriate tool.
If Foundry is not installed, tell the user.
`;

async function runAgent() {
  console.log(`\n╔═══════════════════════════════════════╗`);
  console.log(`║   Foundry-Reverse Ollama Agent        ║`);
  console.log(`║   Model : ${MODEL.padEnd(28)}║`);
  console.log(`║   Host  : ${OLLAMA_HOST.padEnd(28)}║`);
  console.log(`╚═══════════════════════════════════════╝\n`);

  const foundryOk = await checkFoundryInstalled();
  if (!foundryOk) {
    console.warn(
      "⚠  Foundry not installed — Foundry tools will return errors.\n" +
        "   Install: https://book.getfoundry.sh/getting-started/installation\n"
    );
  } else {
    console.log("✓ Foundry detected.\n");
  }

  // Verify Ollama is reachable
  try {
    await ollama.list();
    console.log("✓ Ollama is running.\n");
  } catch {
    console.error(
      `✗ Cannot connect to Ollama at ${OLLAMA_HOST}.\n` +
        `  Make sure Ollama is running: https://ollama.com\n` +
        `  Then run: ollama pull ${MODEL}\n`
    );
    process.exit(1);
  }

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: process.stdout.isTTY,
  });

  const messages: Message[] = [{ role: "system", content: SYSTEM_PROMPT }];

  const prompt = () =>
    new Promise<string>((resolve) => {
      if (process.stdout.isTTY) process.stdout.write("\nYou: ");
      rl.once("line", (line) => resolve(line.trim()));
    });

  console.log('Type your message (or "exit" to quit).\n');

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const userInput = await prompt();
    if (!userInput) continue;
    if (userInput.toLowerCase() === "exit" || userInput.toLowerCase() === "quit") {
      console.log("\nGoodbye!");
      rl.close();
      break;
    }

    messages.push({ role: "user", content: userInput });

    let continueLoop = true;
    while (continueLoop) {
      try {
        const response = await ollama.chat({
          model: MODEL,
          messages,
          tools: TOOLS,
          stream: false,
        });

        const assistantMsg = response.message;
        messages.push(assistantMsg);

        const toolCalls: ToolCall[] | undefined = assistantMsg.tool_calls;

        if (toolCalls && toolCalls.length > 0) {
          for (const tc of toolCalls) {
            const toolName = tc.function.name;
            const toolArgs =
              typeof tc.function.arguments === "string"
                ? (JSON.parse(tc.function.arguments) as Record<string, unknown>)
                : (tc.function.arguments as Record<string, unknown>);

            console.log(`\n[Tool] ${toolName}(${JSON.stringify(toolArgs, null, 0)})`);

            const toolResult = await executeTool(toolName, toolArgs);

            console.log(`[Result] ${toolResult.substring(0, 300)}${toolResult.length > 300 ? "…" : ""}`);

            messages.push({
              role: "tool",
              content: toolResult,
            });
          }
          // Loop again so the model can process tool results
          continueLoop = true;
        } else {
          // Final text response
          const text = assistantMsg.content ?? "";
          console.log(`\nAssistant: ${text}\n`);
          continueLoop = false;
        }
      } catch (error) {
        console.error(
          `\nError: ${error instanceof Error ? error.message : String(error)}\n`
        );
        continueLoop = false;
      }
    }
  }
}

runAgent().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});

# Foundry-Reverse

**Foundry MCP Server with Ollama Backbone** — An enhanced, all-around improved reverse-engineering of [PraneshASP/foundry-mcp-server](https://github.com/PraneshASP/foundry-mcp-server) with a local Ollama agent, more tools, and better ergonomics.

## What is new vs the original

| Feature | Original | Foundry-Reverse |
|---|---|---|
| MCP stdio transport | ✅ | ✅ |
| Ollama agent (no API key needed) | ❌ | ✅ |
| `cast_storage` | ❌ | ✅ |
| `cast_run` (replay tx) | ❌ | ✅ |
| `cast_logs` | ❌ | ✅ |
| `cast_sig` / `cast_4byte` | ❌ | ✅ |
| `forge_build` | ❌ | ✅ |
| `forge_test` | ❌ | ✅ |
| `install_dependency` | ❌ | ✅ |
| `read_file` / `list_files` | ❌ | ✅ |
| `compute_address` | ❌ | ✅ |
| `contract_size` | ❌ | ✅ |
| `estimate_gas` | ❌ | ✅ |
| `generate_wallet` | ❌ | ✅ |
| PRIVATE_KEY guard on cast_send | ❌ | ✅ |
| Graceful Foundry-not-installed warning | ❌ | ✅ |

## Overview

This project ships **two executables**:

1. **MCP Server** (`foundry-mcp`) — a standard [Model Context Protocol](https://modelcontextprotocol.io) server on stdio. Connect any MCP client (Claude Desktop, Cursor, Windsurf, etc.) to it.

2. **Ollama Agent** (`foundry-ollama`) — a conversational terminal agent that uses a local Ollama model as its LLM backbone and calls the same Foundry tools directly. No Anthropic API key or cloud subscription required.

## Requirements

- **Node.js v18+**
- **Foundry** (forge, cast, anvil)
  ```
  curl -L https://foundry.paradigm.xyz | bash && foundryup
  ```
- **Heimdall-rs** (optional, for bytecode analysis)
  ```
  curl -L http://get.heimdall.rs | bash && bifrost
  ```
- **Ollama** (only needed for agent mode): https://ollama.com
  ```
  ollama pull qwen2.5:7b
  ```

## Quick Start

### 1. Install and Build

```bash
git clone https://github.com/deadSwank001/Foundry-Reverse.git
cd Foundry-Reverse
npm install
npm run build
```

### 2a. Use as MCP Server

Add to your MCP client config (e.g., Claude Desktop, Cursor):

```json
{
  "mcpServers": {
    "foundry-reverse": {
      "command": "node",
      "args": ["/path/to/Foundry-Reverse/dist/index.js"],
      "env": {
        "RPC_URL": "http://localhost:8545",
        "PRIVATE_KEY": "0x..."
      }
    }
  }
}
```

### 2b. Use as Ollama Agent

```bash
# With a recommended model
OLLAMA_MODEL=qwen2.5:7b npm run ollama

# Override Ollama server if it is not on localhost
OLLAMA_HOST=http://192.168.1.10:11434 OLLAMA_MODEL=llama3.1 npm run ollama
```

The agent exposes an interactive prompt:

```
You: Deploy an ERC20 contract called "TestToken" to a local Anvil node.
[Tool] anvil_start({})
[Tool] create_solidity_file({"filePath":"src/TestToken.sol","content":"..."})
[Tool] forge_build({})
[Tool] forge_script({"scriptPath":"script/Deploy.s.sol","broadcast":true,...})
Assistant: Deployed! Contract address: 0xabc...
```

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `RPC_URL` | `http://localhost:8545` | Default JSON-RPC endpoint |
| `PRIVATE_KEY` | — | Private key for signed transactions (cast_send) |
| `OLLAMA_HOST` | `http://localhost:11434` | Ollama server URL (agent mode) |
| `OLLAMA_MODEL` | `qwen2.5:7b` | Ollama model to use (agent mode) |

> **Warning:** Never use a private key with mainnet funds. LLMs can hallucinate and send unintended transactions. Use test keys only.

## Tools Reference

### Anvil

| Tool | Description |
|---|---|
| `anvil_start` | Start a local Anvil node (optionally forking mainnet) |
| `anvil_stop` | Stop the running Anvil node |
| `anvil_status` | Check if Anvil is running |

### Cast

| Tool | Description |
|---|---|
| `cast_call` | Read-only contract call |
| `cast_send` | Send a signed transaction |
| `cast_balance` | Get ETH balance |
| `cast_receipt` | Get transaction receipt |
| `cast_chain` | Get chain name or ID |
| `cast_storage` | Read a storage slot |
| `cast_run` | Replay a published transaction locally |
| `cast_logs` | Fetch event logs |
| `cast_sig` | Compute 4-byte function selector |
| `cast_4byte` | Reverse-lookup selector from 4byte.directory |

### Forge

| Tool | Description |
|---|---|
| `forge_script` | Run a Forge deployment/migration script |
| `forge_build` | Compile the workspace |
| `forge_test` | Run Forge tests |
| `install_dependency` | Install a forge lib (e.g., OpenZeppelin) |

### File Management

| Tool | Description |
|---|---|
| `create_solidity_file` | Create or update a Solidity file |
| `read_file` | Read a workspace file |
| `list_files` | List workspace files |

### Utilities

| Tool | Description |
|---|---|
| `convert_eth_units` | Convert wei / gwei / ether |
| `compute_address` | Compute deterministic deploy address |
| `contract_size` | Get deployed bytecode size |
| `estimate_gas` | Estimate gas for a call |
| `generate_wallet` | Create a new random wallet |

### Heimdall (EVM Bytecode Analysis)

| Tool | Description |
|---|---|
| `heimdall_disassemble` | Bytecode to human-readable opcodes |
| `heimdall_decode` | Decode calldata without ABI |
| `heimdall_decompile` | Bytecode to Solidity / ABI |
| `heimdall_cfg` | Generate control flow graph |
| `heimdall_inspect` | Full transaction inspection |

## Resources (MCP)

| URI | Description |
|---|---|
| `anvil://status` | Live Anvil status JSON |
| `contract://{address}/source` | Etherscan source for a contract |

## Workspace

The server uses `~/.mcp-foundry-workspace` as a persistent Forge project. All Solidity files, scripts, and installed dependencies live there.

## Supported Ollama Models

Any model with tool-calling support works. Recommended:

- `qwen2.5:7b` (fast, good tool use)
- `qwen2.5:14b` (better reasoning)
- `llama3.1:8b`
- `llama3.1:70b`
- `mistral-nemo`

## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                   Foundry-Reverse                            │
│                                                              │
│  ┌─────────────────┐        ┌──────────────────────────┐    │
│  │   MCP Server    │        │      Ollama Agent        │    │
│  │  (stdio/MCP)    │        │  (terminal conversational│    │
│  │                 │        │       REPL)               │    │
│  └────────┬────────┘        └──────────┬───────────────┘    │
│           │                            │                      │
│           └──────────┬─────────────────┘                      │
│                      │                                        │
│            ┌─────────▼─────────┐                             │
│            │   Tool Executors  │                             │
│            │  cast / forge /   │                             │
│            │  anvil / heimdall │                             │
│            └─────────┬─────────┘                             │
└──────────────────────┼───────────────────────────────────────┘
                       │
              ┌────────▼────────┐
              │ Foundry Toolchain│
              │  cast forge anvil│
              └─────────────────┘
```

## License

MIT

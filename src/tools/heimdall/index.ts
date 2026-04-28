import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerHeimdallDisassembleTool } from "./disassemble.js";
import { registerHeimdallDecodeTool } from "./decode.js";
import { registerHeimdallDecompileTool } from "./decompile.js";
import { registerHeimdallCfgTool } from "./cfg.js";
import { registerHeimdallInspectTool } from "./inspect.js";

export function registerAllHeimdallTools(server: McpServer): void {
  registerHeimdallDisassembleTool(server);
  registerHeimdallDecodeTool(server);
  registerHeimdallDecompileTool(server);
  registerHeimdallCfgTool(server);
  registerHeimdallInspectTool(server);
}

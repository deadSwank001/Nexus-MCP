import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerAnvilStartTool } from "./start.js";
import { registerAnvilStopTool } from "./stop.js";
import { registerAnvilStatusTool } from "./status.js";

export function registerAllAnvilTools(server: McpServer): void {
  registerAnvilStartTool(server);
  registerAnvilStopTool(server);
  registerAnvilStatusTool(server);
}

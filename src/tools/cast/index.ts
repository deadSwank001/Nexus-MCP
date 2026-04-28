import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerCastCallTool } from "./call.js";
import { registerCastSendTool } from "./send.js";
import { registerCastBalanceTool } from "./balance.js";
import { registerCastReceiptTool } from "./receipt.js";
import { registerCastChainTool } from "./chain.js";
import { registerCastStorageTool } from "./storage.js";
import { registerCastRunTool } from "./run.js";
import { registerCastLogsTool } from "./logs.js";
import { registerCastSigTool, registerCast4ByteTool } from "./sig.js";

export function registerAllCastTools(server: McpServer): void {
  registerCastCallTool(server);
  registerCastSendTool(server);
  registerCastBalanceTool(server);
  registerCastReceiptTool(server);
  registerCastChainTool(server);
  registerCastStorageTool(server);
  registerCastRunTool(server);
  registerCastLogsTool(server);
  registerCastSigTool(server);
  registerCast4ByteTool(server);
}

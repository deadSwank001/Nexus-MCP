import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getAnvilInfo } from "../../utils/rpc.js";

export function registerAnvilStatusTool(server: McpServer): void {
  server.tool(
    "anvil_status",
    "Check whether Anvil is running and get its status",
    {},
    async () => {
      const info = await getAnvilInfo();
      return {
        content: [
          {
            type: "text",
            text: info.running
              ? `Anvil is running on port ${info.port}. RPC URL: ${info.url}`
              : "Anvil is not currently running.",
          },
        ],
      };
    }
  );
}

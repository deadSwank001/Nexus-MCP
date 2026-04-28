import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getAnvilInfo } from "../utils/rpc.js";
import { executeCommand, FOUNDRY_PATHS } from "../utils/command.js";

export function registerAllResources(server: McpServer): void {
  registerAnvilStatusResource(server);
  registerContractSourceResource(server);
}

function registerAnvilStatusResource(server: McpServer): void {
  server.resource("anvil_status", "anvil://status", async (uri) => {
    const info = await getAnvilInfo();
    return {
      contents: [{ uri: uri.href, text: JSON.stringify(info, null, 2) }],
    };
  });
}

function registerContractSourceResource(server: McpServer): void {
  server.resource(
    "contract_source",
    new ResourceTemplate("contract://{address}/source", { list: undefined }),
    async (uri, { address }) => {
      const addr = Array.isArray(address) ? address[0] : address;
      try {
        const cmd = `${FOUNDRY_PATHS.castPath} etherscan-source ${addr}`;
        const { success, message } = await executeCommand(cmd);
        return {
          contents: [
            {
              uri: uri.href,
              text: success
                ? message
                : JSON.stringify({ error: "Could not retrieve source", details: message }),
            },
          ],
        };
      } catch (error) {
        return {
          contents: [
            {
              uri: uri.href,
              text: JSON.stringify({ error: "Failed to retrieve contract source" }),
            },
          ],
        };
      }
    }
  );
}

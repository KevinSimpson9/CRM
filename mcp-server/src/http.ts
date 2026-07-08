// HTTP entry point — Streamable HTTP transport (stateless), for remote use.
// Auth: Authorization: Bearer ${MCP_HTTP_TOKEN}. Run: npm run start:http
import { createServer } from "node:http";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { registerTools } from "./tools.js";

const PORT = parseInt(process.env.PORT || "8808", 10);
const TOKEN = process.env.MCP_HTTP_TOKEN;
if (!TOKEN) {
  console.error("Set MCP_HTTP_TOKEN before exposing the HTTP transport.");
  process.exit(1);
}

const httpServer = createServer(async (req, res) => {
  if (req.url !== "/mcp") {
    res.writeHead(404).end();
    return;
  }
  if (req.headers.authorization !== `Bearer ${TOKEN}`) {
    res.writeHead(401, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "unauthorized" }));
    return;
  }

  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  const bodyText = Buffer.concat(chunks).toString("utf8");
  const body = bodyText ? JSON.parse(bodyText) : undefined;

  // Stateless: fresh server + transport per request.
  const server = new McpServer({ name: "ir-crm", version: "0.1.0" });
  registerTools(server);
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
  res.on("close", () => {
    transport.close();
    server.close();
  });
  await server.connect(transport);
  await transport.handleRequest(req, res, body);
});

httpServer.listen(PORT, () => {
  console.error(`ir-crm MCP server (streamable HTTP) on http://localhost:${PORT}/mcp`);
});

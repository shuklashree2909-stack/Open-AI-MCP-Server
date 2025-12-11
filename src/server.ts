import "dotenv/config";
import express from "express";
import { z } from "zod";
import crypto from "crypto";

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";

import { openaiRequest } from "./openai";
import { requestContext } from "./context";

// ----------------------------------------------------
// MCP SERVER SETUP
// ----------------------------------------------------
const server = new McpServer(
    { name: "openai-mcp-server", version: "1.0.0" },
    { capabilities: { tools: {} } }
);

function pretty(obj: unknown) {
    return JSON.stringify(obj, null, 2);
}

// ----------------------------------------------------
// TOOL 1: Chat Completion
// ----------------------------------------------------
server.registerTool(
    "openai_chat",
    {
        description: "Send a chat prompt to OpenAI models",
        inputSchema: z.object({
            model: z.string(),
            prompt: z.string(),
        }),
    },
    async ({ model, prompt }) => {
        console.log("🚀 Tool Called: openai_chat", { model, prompt });

        const data = await openaiRequest("POST", "/chat/completions", {
            model,
            messages: [{ role: "user", content: prompt }],
        });

        return {
            content: [{ type: "text", text: pretty(data) }]
        };
    }
);

console.log("🔧 Registered Tool: openai_chat");

// ----------------------------------------------------
// TOOL 2: List Models
// ----------------------------------------------------
server.registerTool(
    "openai_models",
    {
        description: "List available OpenAI models",
        inputSchema: z.object({}),
    },
    async () => {
        console.log("🚀 Tool Called: openai_models");

        const data = await openaiRequest("GET", "/models");

        return {
            content: [{ type: "text", text: pretty(data) }]
        };
    }
);

console.log("🔧 Registered Tool: openai_models");

// ----------------------------------------------------
// TOOL 3: Embeddings
// ----------------------------------------------------
server.registerTool(
    "openai_embeddings",
    {
        description: "Generate OpenAI embeddings for text",
        inputSchema: z.object({
            model: z.string(),
            text: z.string(),
        }),
    },
    async ({ model, text }) => {
        console.log("🚀 Tool Called: openai_embeddings", { model, text });

        const data = await openaiRequest("POST", "/embeddings", {
            input: text,
            model
        });

        return {
            content: [{ type: "text", text: pretty(data) }]
        };
    }
);

console.log("🔧 Registered Tool: openai_embeddings");

// ----------------------------------------------------
// HTTP SERVER FOR MCP
// ----------------------------------------------------
const app = express();  
app.use(express.json());

app.all("/mcp", async (req, res) => {
    try {
        // 1) Extract Authorization header
        const authHeader = req.header("authorization") || "";

        let externalApiKey: string | undefined;

        if (authHeader.toLowerCase().startsWith("bearer ")) {
            externalApiKey = authHeader.slice("bearer ".length).trim();
        } else if (authHeader) {
            // If you want to support plain token without Bearer
            externalApiKey = authHeader.trim();
        }

        // Optional: enforce that a key must be provided
        if (!externalApiKey) {
            return res.status(401).json({
                jsonrpc: "2.0",
                error: { code: 401, message: "Missing Authorization API key" },
                id: null,
            });
        }

        const ctx = { externalApiKey };

        const transport = new StreamableHTTPServerTransport({
            sessionIdGenerator: undefined,
            enableJsonResponse: true,
            enableDnsRebindingProtection: false,
        });

        res.on("close", () => {
            transport.close().catch(() => { });
        });

        // 2) Run the whole MCP handling inside this request context
        await requestContext.run(ctx, async () => {
            await server.connect(transport);
            await transport.handleRequest(req, res, req.body);
        });
    } catch (err) {
        console.error("Error handling /mcp request:", err);
        if (!res.headersSent) {
            res.status(500).json({
                jsonrpc: "2.0",
                error: { code: -32603, message: "Internal server error" },
                id: null,
            });
        }
    }
});

const port = parseInt(process.env.PORT || "4000", 10);
app
    .listen(port, () => {
        console.log(`✅ Openai MCP server running on http://localhost:${port}/mcp`);
    })
    .on("error", (error: Error) => {
        console.error("Server error:", error);
        process.exit(1);
    });
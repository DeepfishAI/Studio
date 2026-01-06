/**
 * MCP Client - Port of smolagents mcp_client.py
 * Connect to external MCP servers and import their tools
 */

import { Tool, ToolCollection, createTool } from '../domain/tools/base.js';

/**
 * Transport types for MCP connections
 */
export const MCPTransport = {
    STDIO: 'stdio',
    HTTP: 'http',
    STREAMABLE_HTTP: 'streamable-http',
    SSE: 'sse'
};

/**
 * MCP Client - Manages connection to MCP server
 * 
 * Usage:
 *   const client = new MCPClient({ url: 'http://localhost:8000/mcp' });
 *   await client.connect();
 *   const tools = client.getTools();
 *   await tools.execute('tool_name', args);
 *   client.disconnect();
 */
export class MCPClient {
    /**
     * @param {object} config - Server configuration
     * @param {string} config.url - Server URL (for HTTP transport)
     * @param {string} config.transport - Transport type (default: http)
     * @param {object} config.headers - Optional HTTP headers
     */
    constructor(config = {}) {
        this.url = config.url;
        this.transport = config.transport || MCPTransport.HTTP;
        this.headers = config.headers || {};
        this.connected = false;
        this.tools = new ToolCollection();
        this.serverInfo = null;
    }

    /**
     * Connect to the MCP server and discover tools
     */
    async connect() {
        if (this.connected) {
            console.warn('[MCPClient] Already connected');
            return;
        }

        console.log(`[MCPClient] Connecting to ${this.url}...`);

        try {
            // Discover available tools from the server
            const toolsResponse = await this._request('tools/list', {});

            if (toolsResponse.tools) {
                for (const toolSpec of toolsResponse.tools) {
                    const tool = this._createToolFromSpec(toolSpec);
                    this.tools.add(tool);
                }
                console.log(`[MCPClient] Discovered ${this.tools.getNames().length} tools`);
            }

            // Get server info if available
            try {
                this.serverInfo = await this._request('server/info', {});
            } catch (e) {
                // Server info is optional
            }

            this.connected = true;
            console.log('[MCPClient] Connected successfully');
        } catch (err) {
            console.error('[MCPClient] Connection failed:', err.message);
            throw err;
        }
    }

    /**
     * Disconnect from the MCP server
     */
    disconnect() {
        if (!this.connected) return;

        this.connected = false;
        this.tools = new ToolCollection();
        console.log('[MCPClient] Disconnected');
    }

    /**
     * Get the tools collection
     */
    getTools() {
        if (!this.connected) {
            throw new Error('MCPClient not connected. Call connect() first.');
        }
        return this.tools;
    }

    /**
     * Execute a tool by name
     */
    async executeTool(name, args) {
        if (!this.connected) {
            throw new Error('MCPClient not connected');
        }

        if (!this.tools.has(name)) {
            throw new Error(`Tool '${name}' not found`);
        }

        try {
            const result = await this._request('tools/call', {
                name,
                arguments: args
            });
            return result;
        } catch (err) {
            console.error(`[MCPClient] Tool ${name} failed:`, err.message);
            throw err;
        }
    }

    /**
     * Make a request to the MCP server
     */
    async _request(method, params) {
        const payload = {
            jsonrpc: '2.0',
            id: Date.now(),
            method,
            params
        };

        const response = await fetch(this.url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...this.headers
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            throw new Error(`MCP request failed: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();

        if (data.error) {
            throw new Error(`MCP error: ${data.error.message}`);
        }

        return data.result;
    }

    /**
     * Create a Tool from MCP tool specification
     */
    _createToolFromSpec(spec) {
        const client = this;

        return createTool({
            name: spec.name,
            description: spec.description || 'MCP tool',
            parameters: spec.inputSchema || { type: 'object', properties: {} },
            execute: async (args) => {
                return await client.executeTool(spec.name, args);
            }
        });
    }
}

/**
 * Create an MCP client and connect
 */
export async function connectMCP(config) {
    const client = new MCPClient(config);
    await client.connect();
    return client;
}

/**
 * Load tools from multiple MCP servers
 */
export async function loadMCPTools(servers) {
    const collection = new ToolCollection();

    for (const config of servers) {
        try {
            const client = await connectMCP(config);
            const tools = client.getTools();
            collection.merge(tools);
        } catch (err) {
            console.error(`[MCPClient] Failed to connect to ${config.url}:`, err.message);
        }
    }

    return collection;
}

/**
 * MCP Server discovery (for local servers)
 */
export async function discoverLocalMCPServers() {
    const commonPorts = [8000, 8080, 3000, 5000];
    const discovered = [];

    for (const port of commonPorts) {
        try {
            const url = `http://localhost:${port}/mcp`;
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    jsonrpc: '2.0',
                    id: 1,
                    method: 'server/info',
                    params: {}
                }),
                signal: AbortSignal.timeout(1000)
            });

            if (response.ok) {
                const data = await response.json();
                discovered.push({
                    url,
                    port,
                    info: data.result
                });
            }
        } catch (e) {
            // Not an MCP server on this port
        }
    }

    return discovered;
}

export default MCPClient;

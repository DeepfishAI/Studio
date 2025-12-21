/**
 * File System Tools
 * SAFE MODE: All operations are sandboxed to the workspace directory.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.join(__dirname, '..', '..');
const WORKSPACE_DIR = path.join(ROOT, 'workspace');

// Ensure workspace exists
if (!fs.existsSync(WORKSPACE_DIR)) {
    fs.mkdirSync(WORKSPACE_DIR, { recursive: true });
}

/**
 * Validate path is within workspace (Security)
 */
function safePath(relativePath) {
    const resolvedPath = path.resolve(WORKSPACE_DIR, relativePath);
    if (!resolvedPath.startsWith(WORKSPACE_DIR)) {
        throw new Error(`Access denied: Path ${relativePath} is outside workspace.`);
    }
    return resolvedPath;
}

export const tools = {
    write_file: {
        name: 'write_file',
        description: 'Write content to a file in the workspace. Overwrites if exists.',
        parameters: {
            type: 'object',
            properties: {
                path: { type: 'string', description: 'Relative path (e.g., "plans/promo.md")' },
                content: { type: 'string', description: 'Text content of the file' }
            },
            required: ['path', 'content']
        },
        execute: async ({ path: relativePath, content }) => {
            const fullPath = safePath(relativePath);
            fs.mkdirSync(path.dirname(fullPath), { recursive: true });
            fs.writeFileSync(fullPath, content, 'utf-8');
            return `Successfully wrote ${content.length} bytes to ${relativePath}`;
        }
    },

    read_file: {
        name: 'read_file',
        description: 'Read content of a file from the workspace.',
        parameters: {
            type: 'object',
            properties: {
                path: { type: 'string', description: 'Relative path to read' }
            },
            required: ['path']
        },
        execute: async ({ path: relativePath }) => {
            const fullPath = safePath(relativePath);
            if (!fs.existsSync(fullPath)) {
                return `Error: File ${relativePath} does not exist.`;
            }
            return fs.readFileSync(fullPath, 'utf-8');
        }
    },

    list_files: {
        name: 'list_files',
        description: 'List files in a workspace directory.',
        parameters: {
            type: 'object',
            properties: {
                path: { type: 'string', description: 'Directory path (default: root)' }
            }
        },
        execute: async ({ path: relativePath = '.' }) => {
            const fullPath = safePath(relativePath);
            if (!fs.existsSync(fullPath)) return 'Directory does not exist.';

            const files = fs.readdirSync(fullPath, { withFileTypes: true });
            return files.map(f => (f.isDirectory() ? `${f.name}/` : f.name)).join('\n');
        }
    }
};

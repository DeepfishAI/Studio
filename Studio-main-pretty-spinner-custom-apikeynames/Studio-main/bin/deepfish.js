#!/usr/bin/env node
/**
 * DeepFish CLI - Command line interface for DeepFish agents
 * Port of smolagents cli.py
 * 
 * Usage:
 *   deepfish "Create a hello world file" --agent glitch
 *   deepfish --interactive
 *   deepfish --list-agents
 */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readdirSync, existsSync, readFileSync } from 'fs';
import { createInterface } from 'readline';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = join(__dirname, '..');
const AGENTS_DIR = join(ROOT, 'agents');

// ANSI colors
const colors = {
    reset: '\x1b[0m',
    bold: '\x1b[1m',
    dim: '\x1b[2m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m'
};

function colorize(text, ...styles) {
    const codes = styles.map(s => colors[s] || '').join('');
    return `${codes}${text}${colors.reset}`;
}

function printBanner() {
    console.log(colorize('\n🐟 DeepFish CLI', 'bold', 'cyan'));
    console.log(colorize('   Intelligent agents at your service\n', 'dim'));
}

function printHelp() {
    printBanner();
    console.log(`${colorize('Usage:', 'bold')}
  deepfish <prompt> [options]
  deepfish --interactive
  deepfish --list-agents

${colorize('Options:', 'bold')}
  --agent, -a <id>    Agent to use (default: glitch)
  --max-steps <n>     Maximum steps (default: 5)
  --force-tools       Force agent to use tools
  --interactive, -i   Interactive mode
  --list-agents, -l   List available agents
  --replay            Show memory replay after execution
  --help, -h          Show this help

${colorize('Examples:', 'bold')}
  deepfish "Create a tetris game in Python" --agent glitch
  deepfish "What's the weather in Tokyo?" --agent mei
  deepfish -i
`);
}

function listAgents() {
    printBanner();
    console.log(colorize('Available Agents:\n', 'bold', 'yellow'));

    try {
        const files = readdirSync(AGENTS_DIR);
        const agents = files
            .filter(f => f.endsWith('.agent.json'))
            .map(f => f.replace('.agent.json', ''));

        for (const agentId of agents) {
            try {
                const configPath = join(AGENTS_DIR, `${agentId}.agent.json`);
                const config = JSON.parse(readFileSync(configPath, 'utf-8'));
                const name = config.identity?.name || agentId;
                const title = config.identity?.title || 'Agent';
                const hasTools = config.tools && Object.keys(config.tools).length > 0;

                console.log(`  ${colorize(agentId, 'bold', 'cyan')}`);
                console.log(`    ${name} - ${title}`);
                if (hasTools) {
                    const toolList = Object.keys(config.tools).filter(k => config.tools[k]);
                    console.log(`    ${colorize('Tools:', 'dim')} ${toolList.join(', ')}`);
                }
                console.log();
            } catch (e) {
                console.log(`  ${colorize(agentId, 'cyan')} (unable to load config)`);
            }
        }
    } catch (e) {
        console.error(colorize(`Error listing agents: ${e.message}`, 'red'));
    }
}

async function prompt(question) {
    const rl = createInterface({
        input: process.stdin,
        output: process.stdout
    });

    return new Promise(resolve => {
        rl.question(question, answer => {
            rl.close();
            resolve(answer);
        });
    });
}

async function interactiveMode() {
    printBanner();
    console.log(colorize('Interactive Mode\n', 'bold', 'magenta'));

    // List agents
    listAgents();

    // Get agent selection
    const agentId = await prompt(colorize('Select agent [glitch]: ', 'bold'));
    const selectedAgent = agentId.trim() || 'glitch';

    // Get task
    const task = await prompt(colorize('\nWhat would you like the agent to do?\n> ', 'bold'));

    if (!task.trim()) {
        console.log(colorize('No task provided. Exiting.', 'yellow'));
        process.exit(0);
    }

    return { agentId: selectedAgent, task: task.trim() };
}

async function runAgent(agentId, task, options = {}) {
    console.log(colorize(`\n🚀 Running ${agentId} agent...`, 'bold', 'green'));
    console.log(colorize(`📝 Task: ${task.substring(0, 80)}${task.length > 80 ? '...' : ''}`, 'dim'));
    console.log();

    try {
        // Dynamic import to get the agent
        const { getAgent } = await import('../src/agent.js');
        const agent = getAgent(agentId);

        if (!agent) {
            console.error(colorize(`Agent '${agentId}' not found`, 'red'));
            process.exit(1);
        }

        console.log(colorize('⏳ Processing...', 'yellow'));
        const startTime = Date.now();

        // Check if agent has tools and use appropriate method
        await agent.hydrate();
        const hasTools = agent.profile?.agent?.tools &&
            (agent.profile.agent.tools.fileSystem ||
                agent.profile.agent.tools.codeExecution ||
                agent.profile.agent.tools.imageGeneration);

        let result;
        if (hasTools) {
            result = await agent.processWithTools(task, {
                maxSteps: options.maxSteps || 5,
                forceToolUse: options.forceTools || false
            });
        } else {
            const response = await agent.process(task);
            result = { response, toolResults: [], stepsUsed: 1 };
        }

        const duration = ((Date.now() - startTime) / 1000).toFixed(2);

        // Print results
        console.log('\n' + colorize('─'.repeat(60), 'dim'));
        console.log(colorize('✅ Result:', 'bold', 'green'));
        console.log('─'.repeat(60));
        console.log(result.response || '(no response)');
        console.log('─'.repeat(60));

        // Stats
        console.log(`\n${colorize('📊 Stats:', 'bold')}`);
        console.log(`   Steps: ${result.stepsUsed}`);
        console.log(`   Tools executed: ${result.toolResults?.length || 0}`);
        console.log(`   Duration: ${duration}s`);

        if (result.toolResults?.length > 0) {
            console.log(`\n${colorize('🔧 Tool Results:', 'bold')}`);
            result.toolResults.forEach((tr, i) => {
                console.log(`   ${i + 1}. ${colorize(tr.tool, 'cyan')}: ${tr.result.substring(0, 60)}...`);
            });
        }

        // Memory replay if requested
        if (options.replay && agent.memory) {
            agent.memory.replay();
        }

        console.log();

    } catch (err) {
        console.error(colorize(`\n❌ Error: ${err.message}`, 'red'));
        if (process.env.DEBUG) {
            console.error(err.stack);
        }
        process.exit(1);
    }
}

function parseArgs(args) {
    const result = {
        prompt: null,
        agentId: 'glitch',
        maxSteps: 5,
        forceTools: false,
        interactive: false,
        listAgents: false,
        replay: false,
        help: false
    };

    for (let i = 0; i < args.length; i++) {
        const arg = args[i];

        if (arg === '--help' || arg === '-h') {
            result.help = true;
        } else if (arg === '--interactive' || arg === '-i') {
            result.interactive = true;
        } else if (arg === '--list-agents' || arg === '-l') {
            result.listAgents = true;
        } else if (arg === '--replay') {
            result.replay = true;
        } else if (arg === '--force-tools') {
            result.forceTools = true;
        } else if (arg === '--agent' || arg === '-a') {
            result.agentId = args[++i];
        } else if (arg === '--max-steps') {
            result.maxSteps = parseInt(args[++i], 10);
        } else if (!arg.startsWith('-') && !result.prompt) {
            result.prompt = arg;
        }
    }

    return result;
}

async function main() {
    const args = parseArgs(process.argv.slice(2));

    if (args.help) {
        printHelp();
        process.exit(0);
    }

    if (args.listAgents) {
        listAgents();
        process.exit(0);
    }

    if (args.interactive || !args.prompt) {
        const { agentId, task } = await interactiveMode();
        await runAgent(agentId, task, args);
    } else {
        await runAgent(args.agentId, args.prompt, args);
    }
}

main().catch(err => {
    console.error(colorize(`Fatal error: ${err.message}`, 'red'));
    process.exit(1);
});

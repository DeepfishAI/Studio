/**
 * Monitoring - Port of smolagents monitoring.py
 * Token tracking, timing, and agent logger
 */

import { TokenUsage, Timing } from './memory-steps.js';

/**
 * Monitor - Tracks overall agent execution metrics
 */
export class Monitor {
    constructor(options = {}) {
        this.logger = options.logger || console;
        this.stepDurations = [];
        this.totalInputTokens = 0;
        this.totalOutputTokens = 0;
        this.startTime = null;
        this.endTime = null;
    }

    start() {
        this.startTime = Date.now();
        this.stepDurations = [];
        this.totalInputTokens = 0;
        this.totalOutputTokens = 0;
        return this;
    }

    end() {
        this.endTime = Date.now();
        return this;
    }

    get totalDuration() {
        if (!this.startTime) return 0;
        const end = this.endTime || Date.now();
        return (end - this.startTime) / 1000;
    }

    get totalTokens() {
        return this.totalInputTokens + this.totalOutputTokens;
    }

    /**
     * Update metrics from a memory step
     */
    updateFromStep(step) {
        if (step.timing?.duration) {
            this.stepDurations.push(step.timing.duration);
        }
        if (step.tokenUsage) {
            this.totalInputTokens += step.tokenUsage.inputTokens;
            this.totalOutputTokens += step.tokenUsage.outputTokens;
        }
    }

    /**
     * Get summary of metrics
     */
    getSummary() {
        return {
            totalDuration: this.totalDuration,
            totalSteps: this.stepDurations.length,
            avgStepDuration: this.stepDurations.length > 0
                ? this.stepDurations.reduce((a, b) => a + b, 0) / this.stepDurations.length
                : 0,
            totalInputTokens: this.totalInputTokens,
            totalOutputTokens: this.totalOutputTokens,
            totalTokens: this.totalTokens
        };
    }

    /**
     * Print metrics to logger
     */
    printSummary() {
        const summary = this.getSummary();
        this.logger.log('\n📊 Execution Metrics:');
        this.logger.log(`   Duration: ${summary.totalDuration.toFixed(2)}s`);
        this.logger.log(`   Steps: ${summary.totalSteps}`);
        if (summary.avgStepDuration > 0) {
            this.logger.log(`   Avg step: ${summary.avgStepDuration.toFixed(2)}s`);
        }
        if (summary.totalTokens > 0) {
            this.logger.log(`   Tokens: ${summary.totalTokens} (in: ${summary.totalInputTokens}, out: ${summary.totalOutputTokens})`);
        }
    }

    reset() {
        this.stepDurations = [];
        this.totalInputTokens = 0;
        this.totalOutputTokens = 0;
        this.startTime = null;
        this.endTime = null;
    }
}

/**
 * Log levels
 */
export const LogLevel = {
    OFF: -1,
    ERROR: 0,
    INFO: 1,
    DEBUG: 2
};

/**
 * AgentLogger - Enhanced logging for agents
 */
export class AgentLogger {
    constructor(options = {}) {
        this.level = options.level ?? LogLevel.INFO;
        this.useColors = options.useColors ?? true;
    }

    // ANSI colors
    static colors = {
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

    colorize(text, ...styles) {
        if (!this.useColors) return text;
        const codes = styles.map(s => AgentLogger.colors[s] || '').join('');
        return `${codes}${text}${AgentLogger.colors.reset}`;
    }

    log(message, level = LogLevel.INFO) {
        if (level <= this.level) {
            console.log(message);
        }
    }

    error(message) {
        this.log(this.colorize(`❌ ${message}`, 'red'), LogLevel.ERROR);
    }

    info(message) {
        this.log(this.colorize(`ℹ️  ${message}`, 'blue'), LogLevel.INFO);
    }

    debug(message) {
        this.log(this.colorize(`🔍 ${message}`, 'dim'), LogLevel.DEBUG);
    }

    success(message) {
        this.log(this.colorize(`✅ ${message}`, 'green'), LogLevel.INFO);
    }

    warning(message) {
        this.log(this.colorize(`⚠️  ${message}`, 'yellow'), LogLevel.INFO);
    }

    step(number, message) {
        this.log(this.colorize(`⚡ Step ${number}: ${message}`, 'cyan'), LogLevel.INFO);
    }

    tool(name, result) {
        this.log(this.colorize(`🔧 ${name}: ${result}`, 'magenta'), LogLevel.INFO);
    }

    plan(plan) {
        this.log(this.colorize(`🎯 Plan: ${plan}`, 'yellow'), LogLevel.INFO);
    }

    rule(title) {
        const line = '─'.repeat(60);
        this.log(`\n${this.colorize(line, 'dim')}`);
        this.log(this.colorize(`${title}`, 'bold'));
        this.log(this.colorize(line, 'dim'));
    }
}

/**
 * Estimate token count (rough approximation)
 * More accurate estimation would require a tokenizer
 */
export function estimateTokens(text) {
    if (!text) return 0;
    // Rough estimate: 1 token ≈ 4 characters
    return Math.ceil(text.length / 4);
}

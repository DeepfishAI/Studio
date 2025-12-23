import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const SECRETS_PATH = path.resolve('config.secrets.json');
const RAILWAY_CMD = 'railway.cmd';

const mapping = {
    'ANTHROPIC_API_KEY': 'llm_providers.anthropic.api_key',
    'GEMINI_API_KEY': 'llm_providers.google.gemini_api_key',
    'NVIDIA_API_KEY': 'llm_providers.nvidia.api_key',
    'OPENROUTER_API_KEY': 'llm_providers.openrouter.api_key',
    'ELEVENLABS_API_KEY': 'voice.elevenlabs.api_key',
    'STRIPE_SECRET_KEY': 'stripe.secret_key',
    'STRIPE_PUBLISHABLE_KEY': 'stripe.publishable_key',
    'STRIPE_WEBHOOK_SECRET': 'stripe.webhook_secret',
    'FRONTEND_URL': 'environment.frontend_url',
    'NODE_ENV': 'environment.node_env',
    'GH_TOKEN': 'auth.github_token',
    'GITHUB_TOKEN': 'auth.github_token',
    'DASHLANE_MASTER_PASSWORD': 'auth.dashlane_password',
    'DASHLANE_EMAIL': 'auth.dashlane_email'
};

function setDeepValue(obj, path, value) {
    const keys = path.split('.');
    let current = obj;
    for (let i = 0; i < keys.length - 1; i++) {
        if (!current[keys[i]]) current[keys[i]] = {};
        current = current[keys[i]];
    }
    current[keys[keys.length - 1]] = value;
}

async function sync() {
    try {
        console.log('Fetching variables from Railway...');
        const output = execSync(`${RAILWAY_CMD} variables --json`, { encoding: 'utf8' });
        const railwayVars = JSON.parse(output);

        if (!fs.existsSync(SECRETS_PATH)) {
            console.error(`Error: ${SECRETS_PATH} not found.`);
            process.exit(1);
        }

        const secrets = JSON.parse(fs.readFileSync(SECRETS_PATH, 'utf8'));
        let updated = false;

        for (const [railwayKey, localPath] of Object.entries(mapping)) {
            if (railwayVars[railwayKey]) {
                console.log(`Syncing ${railwayKey} -> ${localPath}`);
                setDeepValue(secrets, localPath, railwayVars[railwayKey]);
                updated = true;
            } else {
                console.warn(`Warning: ${railwayKey} not found in Railway variables.`);
            }
        }

        if (updated) {
            fs.writeFileSync(SECRETS_PATH, JSON.stringify(secrets, null, 4));
            console.log('Successfully updated config.secrets.json');
        } else {
            console.log('No variables updated.');
        }

    } catch (error) {
        if (error.message.includes('Unauthorized')) {
            console.error('Error: Unauthorized. Please run "railway login" first.');
        } else {
            console.error('Error syncing secrets:', error.message);
        }
        process.exit(1);
    }
}

sync();

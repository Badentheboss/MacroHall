const { Anthropic } = require('@anthropic-ai/sdk');

// Override with CLAUDE_MODEL (e.g. claude-sonnet-5-5 or claude-haiku-4-5) to
// trade quality for cost.
const DEFAULT_MODEL = 'claude-opus-5-5';

// Models that accept server-side refusal fallbacks in the "default" form.
const FALLBACK_MODELS = new Set(['claude-opus-5-5', 'claude-opus-5', 'claude-sonnet-5-5', 'claude-fable-5-1']);

let client;

function getModel() {
  return process.env.CLAUDE_MODEL || DEFAULT_MODEL;
}

function getClient() {
  if (!client) {
    if (!process.env.ANTHROPIC_API_KEY && !process.env.ANTHROPIC_AUTH_TOKEN) {
      throw new Error('ANTHROPIC_API_KEY is not set.');
    }
    client = new Anthropic();
  }
  return client;
}

// One place to send Messages API requests. Adds refusal fallbacks where the
// model supports them, so a safety-classifier false positive on an ordinary
// food question is retried on another model instead of failing.
async function createMessage(params, anthropic = getClient()) {
  const model = params.model || getModel();
  const request = { ...params, model };

  if (FALLBACK_MODELS.has(model)) {
    request.betas = [...(params.betas || []), 'server-side-fallback-2026-07-01'];
    request.fallbacks = 'default';
  }

  return anthropic.beta.messages.create(request);
}

// output_config for a request: effort where the model supports it (Haiku 4.5
// rejects it), plus any other output settings such as a JSON schema format.
function outputConfig(model, effort, extra = {}) {
  const config = { ...extra };
  if (!/haiku/.test(model)) config.effort = effort;
  return config;
}

function textOf(message) {
  return (message.content || [])
    .filter((block) => block.type === 'text')
    .map((block) => block.text)
    .join('');
}

module.exports = {
  Anthropic,
  createMessage,
  getClient,
  getModel,
  outputConfig,
  textOf,
};

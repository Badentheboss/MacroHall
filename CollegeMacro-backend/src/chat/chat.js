const { createMessage, getModel, outputConfig, textOf } = require('../ai/claude');
const { TOOL_DEFINITIONS, runTool } = require('./tools');

const MAX_HISTORY = 20;
const MAX_MESSAGE_CHARS = 2000;
const MAX_TOOL_ROUNDS = 6;

const SYSTEM_PROMPT = `You are MacroHall's campus food assistant, chatting with a college student inside a dining-hall nutrition app.

What you help with: what to eat at their campus dining halls, hitting calorie and macro targets (many users lift and track protein), allergens and dietary needs, and general campus questions such as hours, the rec center, or where things are.

Ground your answers:
- Menus, dishes and nutrition come only from the find_foods and list_dining_halls tools. Never invent a dish or a number. If a dish's nutrition_is_estimate is true, say the numbers are estimates.
- The student's targets, what they have eaten, and their allergens come from get_my_day. Check it before suggesting how much to eat.
- For campus facts that are not menus (hours, events, facilities), use web search, which is limited to the school's own websites. If you cannot confirm something, say so.
- Respect saved allergens. Do not suggest dishes containing them, and remind the student to confirm allergens with dining staff when it matters.

Style: this is a phone chat. Lead with the answer in a few short lines or a tight list, with numbers (e.g. "Grilled chicken, Bursley: 40g protein / 210 cal"). No long preamble.

Stay in scope: nutrition and campus life. For medical questions, eating-disorder concerns, or very low calorie targets, be supportive, do not coach restriction, and point to the campus dietitian or health center.`;

function webSearchTool(model, domains) {
  const allowedDomains = (domains || []).filter(Boolean);
  if (allowedDomains.length === 0) return null;
  const dynamicFiltering = !/haiku/.test(model);
  return {
    type: dynamicFiltering ? 'web_search_20260209' : 'web_search_20250305',
    name: 'web_search',
    max_uses: 3,
    allowed_domains: allowedDomains,
  };
}

// Validates the client-held conversation: alternating user/assistant text,
// ending with the user's new message. Returns the trimmed history.
function validateHistory(messages) {
  if (!Array.isArray(messages) || messages.length === 0) {
    throw Object.assign(new Error('messages must be a non-empty array.'), { status: 400 });
  }

  const history = messages.slice(-MAX_HISTORY);
  while (history.length > 0 && history[0].role !== 'user') history.shift();

  history.forEach((message, index) => {
    const expected = index % 2 === 0 ? 'user' : 'assistant';
    if (message?.role !== expected || typeof message.content !== 'string' || !message.content.trim()) {
      throw Object.assign(new Error('messages must alternate user/assistant text, starting with user.'), { status: 400 });
    }
    if (message.content.length > MAX_MESSAGE_CHARS) {
      throw Object.assign(new Error(`Messages are limited to ${MAX_MESSAGE_CHARS} characters.`), { status: 400 });
    }
  });

  if (history.length === 0 || history[history.length - 1].role !== 'user') {
    throw Object.assign(new Error('The last message must be from the user.'), { status: 400 });
  }

  return history.map((message) => ({ role: message.role, content: message.content.trim() }));
}

function contextNote(ctx, now = new Date()) {
  const localTime = new Intl.DateTimeFormat('en-US', {
    timeZone: ctx.school.timezone,
    weekday: 'long',
    hour: 'numeric',
    minute: '2-digit',
  }).format(now);
  return `School: ${ctx.school.name}. Local time there: ${localTime} (today is ${ctx.dates.today}).`;
}

// Runs the tool loop server-side and returns the assistant's final reply.
async function answer({ ctx, messages, anthropic }) {
  const model = getModel();
  const tools = [...TOOL_DEFINITIONS];
  const search = webSearchTool(model, ctx.school.email_domains);
  if (search) tools.push(search);

  const conversation = [...validateHistory(messages)];
  // Per-request facts go after the cached prefix (tools + system prompt).
  const system = [
    { type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } },
    { type: 'text', text: contextNote(ctx) },
  ];

  for (let round = 0; round < MAX_TOOL_ROUNDS; round += 1) {
    const response = await createMessage(
      {
        model,
        max_tokens: 16000,
        system,
        tools,
        output_config: outputConfig(model, 'low'),
        messages: conversation,
      },
      anthropic
    );

    if (response.stop_reason === 'refusal') {
      return { reply: "Sorry, I can't help with that one. Try asking about food, macros, or campus life." };
    }

    conversation.push({ role: 'assistant', content: response.content });

    if (response.stop_reason === 'pause_turn') continue; // web search still running

    const toolUses = response.content.filter((block) => block.type === 'tool_use');
    if (response.stop_reason !== 'tool_use' || toolUses.length === 0) {
      return { reply: textOf(response).trim() || "I couldn't come up with an answer. Try rephrasing?" };
    }

    const results = toolUses.map((block) => {
      try {
        return { type: 'tool_result', tool_use_id: block.id, content: JSON.stringify(runTool(block.name, block.input, ctx)) };
      } catch (error) {
        return { type: 'tool_result', tool_use_id: block.id, content: error.message, is_error: true };
      }
    });
    conversation.push({ role: 'user', content: results });
  }

  return { reply: 'That took more steps than I can handle at once. Could you ask something more specific?' };
}

module.exports = {
  SYSTEM_PROMPT,
  answer,
  validateHistory,
  webSearchTool,
};

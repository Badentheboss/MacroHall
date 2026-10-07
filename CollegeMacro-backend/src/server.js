const express = require('express');

const { schools } = require('./config/schools');
const { ingestSchool } = require('./ingest/ingestSchool');
const { localDate } = require('./ingest/dates');
const { requireSecret, requireUser } = require('./http/auth');
const { loadChatContext } = require('./chat/context');
const { answer } = require('./chat/chat');
const { extractMenu } = require('./ai/menuExtractor');
const { replaceHallMenu } = require('./db/supabaseRepository');
const { Anthropic } = require('./ai/claude');
const { planPlates } = require('./plate/planForUser');
const { liveOccupancy } = require('./gyms/occupancy');

const AI_DAILY_LIMIT = Number(process.env.AI_DAILY_LIMIT || 40);
const PHOTO_MEDIA_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

function defaultSupabase() {
  return require('../supabaseClient')();
}

// The phone app doesn't need CORS; the Expo web preview on localhost does.
const CORS_ORIGINS = new Set(
  (process.env.CORS_ORIGINS || 'http://localhost:8081,http://127.0.0.1:8081').split(',').map((o) => o.trim()).filter(Boolean)
);

function cors(req, res, next) {
  const origin = req.headers.origin;
  if (origin && CORS_ORIGINS.has(origin)) {
    res.set({
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Headers': 'Authorization, Content-Type',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      Vary: 'Origin',
    });
    if (req.method === 'OPTIONS') return res.sendStatus(204);
  }
  return next();
}

async function consumeQuota(supabase, userId) {
  const { data, error } = await supabase.rpc('consume_ai_quota', { p_user: userId, p_limit: AI_DAILY_LIMIT });
  if (error) throw error;
  return data === true;
}

function createApp({ getSupabase = defaultSupabase, anthropic, extract = extractMenu, occupancyFetch } = {}) {
  const app = express();
  const auth = requireUser(getSupabase);
  app.use(cors);

  app.get('/health', (_, res) => {
    res.json({ ok: true, service: 'CollegeMacro backend' });
  });

  app.get('/schools', (_, res) => {
    res.json({
      schools: schools.map((s) => ({
        slug: s.slug,
        name: s.name,
        status: s.status,
        adapter: s.adapter,
        timezone: s.timezone,
      })),
    });
  });

  app.delete('/delete-user', express.json(), auth, async (req, res) => {
    try {
      if (req.user.id !== req.body?.userId) {
        return res.status(403).json({ message: "Cannot delete another user's account." });
      }

      const supabase = getSupabase();
      // Profile photos sit in a public bucket, so remove them with the account.
      const avatars = supabase.storage?.from('avatars');
      if (avatars) {
        const { data: files } = await avatars.list(req.user.id);
        if (files?.length) await avatars.remove(files.map((file) => `${req.user.id}/${file.name}`));
      }

      const { error } = await supabase.auth.admin.deleteUser(req.user.id);
      if (error) throw error;

      return res.json({ ok: true });
    } catch (error) {
      return res.status(500).json({ message: error.message });
    }
  });

  // Operator-only: scraping and AI extraction cost time and money, so this
  // needs INGEST_SECRET as a bearer token. The cron job uses the CLI instead.
  app.post('/ingest', requireSecret('INGEST_SECRET'), async (req, res) => {
    try {
      const schoolSlug = String(req.query.school || 'umich');
      const persist = String(req.query.persist || 'false') === 'true';

      const result = await ingestSchool({ schoolSlug, persist });
      return res.json({
        message: 'Ingestion finished',
        school: result.school,
        menus: result.menus.map((menu) => ({ date: menu.date, halls_ingested: menu.halls.length })),
        errors: result.errors,
        updated_at: result.updated_at,
      });
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  });

  // Campus food chatbot. The client keeps the conversation and sends the
  // recent turns; the server runs the tool loop against the student's school.
  app.post('/chat', express.json({ limit: '64kb' }), auth, async (req, res) => {
    try {
      const supabase = getSupabase();
      if (!(await consumeQuota(supabase, req.user.id))) {
        return res.status(429).json({ message: `You've hit today's limit of ${AI_DAILY_LIMIT} questions. It resets tomorrow.` });
      }

      const ctx = await loadChatContext(supabase, req.user.id);
      const result = await answer({ ctx, messages: req.body?.messages, anthropic });
      return res.json(result);
    } catch (error) {
      if (error.status === 400) return res.status(400).json({ message: error.message });
      if (error instanceof Anthropic.RateLimitError) {
        return res.status(503).json({ message: 'The assistant is busy right now. Try again in a minute.' });
      }
      console.error('chat failed:', error);
      return res.status(500).json({ message: 'Something went wrong. Try again.' });
    }
  });

  // "Hit my macros": best plate per dining hall for what the student has left
  // today (or explicit targets). Deterministic, so no AI quota is used.
  app.post('/plate', express.json({ limit: '16kb' }), auth, async (req, res) => {
    try {
      const ctx = await loadChatContext(getSupabase(), req.user.id);
      const body = req.body || {};
      const numberOrNull = (value) => (Number.isFinite(Number(value)) && value !== null && value !== '' ? Number(value) : null);
      return res.json(
        planPlates(ctx, {
          day: body.day,
          meal: body.meal || null,
          hall: body.hall || null,
          protein_g: numberOrNull(body.protein_g),
          calories: numberOrNull(body.calories),
          carbs_g: numberOrNull(body.carbs_g),
          fat_g: numberOrNull(body.fat_g),
          max_items: numberOrNull(body.max_items),
          respect_my_allergens: body.respect_my_allergens !== false,
        })
      );
    } catch (error) {
      console.error('plate failed:', error);
      return res.status(500).json({ message: 'Could not build a plate right now.' });
    }
  });

  // Live rec-center occupancy for the student's school, where a feed exists.
  app.get('/gyms/live', auth, async (req, res) => {
    try {
      const supabase = getSupabase();
      const { data, error } = await supabase
        .from('users')
        .select('schools(slug)')
        .eq('id', req.user.id)
        .single();
      if (error) throw error;
      return res.json(await liveOccupancy(data?.schools?.slug, occupancyFetch ? { fetchJson: occupancyFetch } : {}));
    } catch (error) {
      console.error('gym occupancy failed:', error);
      return res.status(502).json({ message: 'Live gym counts are unavailable right now.' });
    }
  });

  // Crowdsourced menus: a student photographs the menu board at a hall that
  // has no menu for today, and Claude turns it into dishes with estimated
  // nutrition. Halls with an official menu are never overwritten.
  app.post('/menus/photo', express.json({ limit: '8mb' }), auth, async (req, res) => {
    try {
      const { hallId, imageBase64, mediaType } = req.body || {};
      if (!Number.isInteger(hallId) || typeof imageBase64 !== 'string' || !PHOTO_MEDIA_TYPES.has(mediaType)) {
        return res.status(400).json({ message: 'Send hallId, imageBase64 and a JPEG, PNG or WebP mediaType.' });
      }

      const supabase = getSupabase();
      const { data: profile, error: profileError } = await supabase
        .from('users')
        .select('school_id')
        .eq('id', req.user.id)
        .single();
      if (profileError) throw profileError;

      const { data: hall, error: hallError } = await supabase
        .from('dining_halls')
        .select('id, name, school_id, schools(timezone)')
        .eq('id', hallId)
        .single();
      if (hallError || !hall || hall.school_id !== profile.school_id) {
        return res.status(404).json({ message: 'That dining hall is not at your school.' });
      }

      const date = localDate(hall.schools?.timezone);
      const { count, error: countError } = await supabase
        .from('menu_items')
        .select('id', { count: 'exact', head: true })
        .eq('hall_id', hallId)
        .eq('menu_date', date)
        .neq('nutrition_source', 'crowdsourced');
      if (countError) throw countError;
      if (count > 0) {
        return res.status(409).json({ message: `${hall.name} already has today's menu.` });
      }

      if (!(await consumeQuota(supabase, req.user.id))) {
        return res.status(429).json({ message: "You've hit today's AI limit. It resets tomorrow." });
      }

      const items = await extract({
        hallName: hall.name,
        date,
        source: { kind: 'image', data: Buffer.from(imageBase64, 'base64'), mediaType },
        estimateMissingNutrition: true,
        anthropic,
      });
      if (items.length === 0) {
        return res.status(422).json({ message: "Couldn't read any dishes from that photo. Try a closer, straighter shot." });
      }

      await replaceHallMenu(
        hallId,
        date,
        items.map((item) => ({ ...item, nutritionSource: 'crowdsourced' })),
        supabase
      );
      return res.json({ hall: hall.name, date, dishes: items.length });
    } catch (error) {
      console.error('menu photo failed:', error);
      return res.status(500).json({ message: 'Could not process that photo.' });
    }
  });

  return app;
}

module.exports = {
  createApp,
};

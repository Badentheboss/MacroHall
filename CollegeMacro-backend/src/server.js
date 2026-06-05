const express = require('express');
const { createClient } = require('@supabase/supabase-js');

const { schools } = require('./config/schools');
const { ingestSchool } = require('./ingest/ingestSchool');

const app = express();
app.use(express.json());
const port = Number(process.env.PORT || 3001);

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

app.get('/health', (_, res) => {
  res.json({ ok: true, service: 'CollegeMacro backend' });
});

app.get('/schools', (_, res) => {
  res.json({
    schools: schools.map((s) => ({
      slug: s.slug,
      name: s.name,
      listingUrl: s.listingUrl,
      adapter: s.adapter,
    })),
  });
});

app.delete('/delete-user', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Missing auth token.' });
    }

    const token = authHeader.slice(7);
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) {
      return res.status(401).json({ message: 'Invalid or expired token.' });
    }

    const { userId } = req.body;
    if (user.id !== userId) {
      return res.status(403).json({ message: 'Cannot delete another user\'s account.' });
    }

    const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);
    if (error) throw error;

    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.post('/ingest', async (req, res) => {
  try {
    const schoolSlug = String(req.query.school || 'umich');
    const persist = String(req.query.persist || 'false') === 'true';

    const result = await ingestSchool({ schoolSlug, persist });
    res.json({
      message: 'Ingestion finished',
      school: result.school,
      halls_ingested: result.halls.length,
      updated_at: result.updated_at,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(port, () => {
  console.log(`CollegeMacro backend is running on port ${port}`);
});

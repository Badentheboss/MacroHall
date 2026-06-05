const express = require('express');

const { schools } = require('./config/schools');
const { ingestSchool } = require('./ingest/ingestSchool');

const app = express();
const port = Number(process.env.PORT || 3001);

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

const router = require('express').Router();
const { Project, Asset, Script, Clip, PublishJob } = require('../models');

// Every handler try/catches: an uncaught async throw in Express 4 never
// reaches error middleware — it hangs the request (and on older boot code
// killed the process). These list/detail calls run inside Promise.all on the
// Scripts, Studio and Ideation pages, so one throw used to blank scripts too.
const errMessage = (e) => (e && e.message) || 'Unknown server error';

router.get('/', async (req, res) => {
  try {
    const rows = await Project.findAll({ order: [['updatedAt', 'DESC']] });
    res.json(rows);
  } catch (e) {
    console.error('[projects] list error:', e);
    res.status(500).json({ error: errMessage(e) });
  }
});
router.post('/', async (req, res) => {
  try {
    const row = await Project.create(req.body);
    res.status(201).json(row);
  } catch (e) {
    console.error('[projects] create error:', e);
    res.status(500).json({ error: errMessage(e) });
  }
});
router.get('/:id', async (req, res) => {
  try {
    const p = await Project.findByPk(req.params.id, { include: [Asset, Script, Clip, PublishJob] });
    if (!p) return res.status(404).json({ error: 'not found' });
    res.json(p);
  } catch (e) {
    console.error('[projects] detail error:', e);
    res.status(500).json({ error: errMessage(e) });
  }
});
router.patch('/:id', async (req, res) => {
  try {
    const p = await Project.findByPk(req.params.id);
    if (!p) return res.status(404).json({ error: 'not found' });
    await p.update(req.body);
    res.json(p);
  } catch (e) {
    console.error('[projects] patch error:', e);
    res.status(500).json({ error: errMessage(e) });
  }
});
router.delete('/:id', async (req, res) => {
  try {
    await Project.destroy({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch (e) {
    console.error('[projects] delete error:', e);
    res.status(500).json({ error: errMessage(e) });
  }
});
module.exports = router;

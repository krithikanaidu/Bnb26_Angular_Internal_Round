const router = require('express').Router();
const { Project, Asset, Script, Clip, PublishJob } = require('../models');

router.get('/', async (req, res) => {
  const rows = await Project.findAll({ order: [['updatedAt', 'DESC']] });
  res.json(rows);
});
router.post('/', async (req, res) => {
  const row = await Project.create(req.body);
  res.status(201).json(row);
});
router.get('/:id', async (req, res) => {
  const p = await Project.findByPk(req.params.id, { include: [Asset, Script, Clip, PublishJob] });
  if (!p) return res.status(404).json({ error: 'not found' });
  res.json(p);
});
router.patch('/:id', async (req, res) => {
  const p = await Project.findByPk(req.params.id);
  if (!p) return res.status(404).json({ error: 'not found' });
  await p.update(req.body);
  res.json(p);
});
router.delete('/:id', async (req, res) => {
  await Project.destroy({ where: { id: req.params.id } });
  res.json({ ok: true });
});
module.exports = router;

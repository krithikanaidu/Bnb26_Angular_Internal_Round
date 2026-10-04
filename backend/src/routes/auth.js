'use strict';

const express = require('express');
const { User } = require('../models');
const { signToken, verifyPassword, hashPassword, publicUser, requireAuth } = require('../middleware/auth');

const router = express.Router();

// Registration is intentionally simple: email + a passphrase of at least 8
// characters. Every one of these responses is honest about which step failed.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validate({ email, password }) {
  const e = String(email || '').trim().toLowerCase();
  const p = String(password || '');
  if (!e) return { error: 'Email is required.' };
  if (!EMAIL_RE.test(e)) return { error: 'That does not look like an email address.' };
  if (!p) return { error: 'Password is required.' };
  if (p.length < 8) return { error: 'Password must be at least 8 characters.' };
  return { email: e, password: p };
}

router.post('/register', async (req, res) => {
  const v = validate(req.body || {});
  if (v.error) return res.status(400).json({ error: v.error });
  try {
    const existing = await User.findOne({ where: { email: v.email } });
    if (existing) return res.status(409).json({ error: 'An account already uses that email.' });
    const user = await User.create({
      email: v.email,
      name: String(req.body?.name || '').trim().slice(0, 80),
      passwordHash: hashPassword(v.password),
    });
    return res.status(201).json({ token: signToken({ sub: user.id, email: user.email, name: publicUser(user).name }), user: publicUser(user) });
  } catch (e) {
    // Unique-violation is a duplicate email, not an internal error.
    if (e?.name === 'SequelizeUniqueConstraintError') return res.status(409).json({ error: 'An account already uses that email.' });
    return res.status(500).json({ error: `Could not create the account: ${e.message}` });
  }
});

router.post('/login', async (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase();
  const password = String(req.body?.password || '');
  if (!email || !password) return res.status(400).json({ error: 'Email and password are both required.' });
  try {
    const user = await User.findOne({ where: { email } });
    // One generic message for "no such user" and "wrong password" so the
    // endpoint cannot be used to enumerate registered addresses.
    const ok = user && verifyPassword(password, user.passwordHash);
    if (!ok) return res.status(401).json({ error: 'Email or password is incorrect.' });
    return res.json({ token: signToken({ sub: user.id, email: user.email, name: publicUser(user).name }), user: publicUser(user) });
  } catch (e) {
    return res.status(500).json({ error: `Could not sign in: ${e.message}` });
  }
});

router.get('/me', requireAuth, (req, res) => res.json({ user: req.user }));

// How many accounts exist, so a fresh install can tell the user that the
// first login needs to be a registration.
router.get('/count', async (_req, res) => {
  try {
    res.json({ count: await User.count() });
  } catch (e) {
    res.status(500).json({ error: `Could not read the account count: ${e.message}` });
  }
});

module.exports = router;

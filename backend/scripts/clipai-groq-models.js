'use strict';
require('dotenv').config();
const axios = require('axios');

(async () => {
  const key = process.env.GROQ_API_KEY
    || (/^gsk_/.test(process.env.OPENAI_API_KEY || '') ? process.env.OPENAI_API_KEY : '');
  const { data } = await axios.get('https://api.groq.com/openai/v1/models', {
    headers: { Authorization: `Bearer ${key}` },
    timeout: 30000,
  });
  for (const m of data.data || []) console.log(m.id);
})().catch((e) => console.error('MODELS_FAIL:', e.response?.status, JSON.stringify(e.response?.data || e.message).slice(0, 300)));

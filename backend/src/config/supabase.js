require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

// Supabase-only. Accept canonical names + legacy VITE_ names from old .env.example.
let supabaseUrl =
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
// Strip accidental "/rest/v1/" suffix some people paste from API docs
supabaseUrl = supabaseUrl.replace(/\/rest\/v1\/?$/, '');

const supabaseKey =
  process.env.SUPABASE_SERVICE_KEY ||
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY ||
  '';

let supabase = null;
if (supabaseUrl && supabaseKey) {
  supabase = createClient(supabaseUrl, supabaseKey);
} else {
  console.warn(
    '[supabase] SUPABASE_URL / SUPABASE_SERVICE_KEY missing in backend/.env - storage uploads will return metadata-only (no publicUrl). Set both to enable Supabase Storage.'
  );
}

const BUCKET = process.env.SUPABASE_BUCKET || 'creator-assets';

async function ensureBucket() {
  if (!supabase) return;
  const { data } = await supabase.storage.listBuckets();
  if (!data?.find((b) => b.name === BUCKET)) {
    await supabase.storage.createBucket(BUCKET, { public: true });
    console.log(`[supabase] created bucket ${BUCKET}`);
  }
}

module.exports = { supabase, BUCKET, ensureBucket };

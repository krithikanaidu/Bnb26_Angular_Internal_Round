const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

let supabase = null;
if (supabaseUrl && supabaseKey) {
  supabase = createClient(supabaseUrl, supabaseKey);
} else {
  console.warn('[supabase] SUPABASE_URL / SERVICE_KEY missing - storage uploads will use local fallback URLs');
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

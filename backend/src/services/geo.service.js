'use strict';

// Region-Based Interest (ROI): which regions care about this topic right now.
// Region codes are YouTube regionCodes (also used as Metric.region).

const REGIONS = {
  IN: { label: 'India', lang: 'en-IN' },
  US: { label: 'United States', lang: 'en-US' },
  GB: { label: 'United Kingdom', lang: 'en-GB' },
  BR: { label: 'Brazil', lang: 'pt-BR' },
  ID: { label: 'Indonesia', lang: 'id-ID' },
  NG: { label: 'Nigeria', lang: 'en-NG' },
  PH: { label: 'Philippines', lang: 'en-PH' },
  ZA: { label: 'South Africa', lang: 'en-ZA' },
};

const DEFAULT_REGION = 'IN';
const DEFAULT_COMPARE = ['IN', 'US', 'GB'];

function normalizeRegion(r = '') {
  const code = String(r || '').trim().toUpperCase();
  return REGIONS[code] ? code : DEFAULT_REGION;
}

function regionLabel(r = '') {
  const code = normalizeRegion(r);
  return REGIONS[code].label;
}

function compareRegions() {
  const env = String(process.env.ROI_REGIONS || '').toUpperCase().split(/[^A-Z]+/).filter((c) => REGIONS[c]);
  const list = env.length ? [...new Set(env)] : DEFAULT_COMPARE;
  return list.slice(0, 5);
}

module.exports = { REGIONS, DEFAULT_REGION, DEFAULT_COMPARE, normalizeRegion, regionLabel, compareRegions };

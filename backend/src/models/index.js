const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const define = (name, attrs, opts = {}) =>
  sequelize.define(name, { id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true }, ...attrs }, { underscored: true, ...opts });

const Project = define('Project', {
  title: { type: DataTypes.STRING, allowNull: false },
  description: DataTypes.TEXT,
  status: { type: DataTypes.ENUM('idea', 'scripting', 'recording', 'editing', 'ready', 'scheduled', 'published'), defaultValue: 'idea' },
  tags: { type: DataTypes.JSONB, defaultValue: [] },
});

const Asset = define('Asset', {
  projectId: DataTypes.UUID,
  kind: { type: DataTypes.ENUM('video', 'image', 'audio', 'other'), defaultValue: 'video' },
  fileName: DataTypes.STRING,
  storagePath: DataTypes.STRING,
  publicUrl: DataTypes.TEXT,
  sizeBytes: DataTypes.INTEGER,
  mimeType: DataTypes.STRING,
  durationSec: { type: DataTypes.FLOAT, defaultValue: 0 },
  meta: { type: DataTypes.JSONB, defaultValue: {} },
});

const Script = define('Script', {
  projectId: DataTypes.UUID,
  title: DataTypes.STRING,
  body: { type: DataTypes.TEXT, allowNull: false },
  tone: { type: DataTypes.STRING, defaultValue: 'energetic' },
  targetPlatforms: { type: DataTypes.JSONB, defaultValue: ['tiktok', 'reels', 'shorts'] },
  // ideation additions (AGENT/DATABASE.md)
  version: { type: DataTypes.INTEGER, defaultValue: 1 },
  hookPatternId: DataTypes.UUID,
  beats: { type: DataTypes.JSONB, defaultValue: [] },
  supporting: { type: DataTypes.JSONB, defaultValue: {} },
  // richer brief (F3.3+) — all optional, backward compatible
  brief: { type: DataTypes.JSONB, defaultValue: {} },
  audience: DataTypes.TEXT,
  goal: DataTypes.TEXT,
  language: { type: DataTypes.STRING, defaultValue: 'en' },
  visuals: { type: DataTypes.JSONB, defaultValue: [] },
  shotList: { type: DataTypes.JSONB, defaultValue: [] },
  teleprompter: DataTypes.TEXT,
  meta: { type: DataTypes.JSONB, defaultValue: {} },
});

const ScriptFeedback = define('ScriptFeedback', {
  scriptId: DataTypes.UUID,
  projectId: DataTypes.UUID,
  eventType: { type: DataTypes.STRING, defaultValue: 'generate' }, // generate|refine_preview|refine_accept|auto_improve|auto_improve_accept|edit|rate|reuse|approve|reject
  actor: { type: DataTypes.STRING, defaultValue: 'creator' }, // creator|manager|system
  rating: DataTypes.INTEGER, // -1/1 or 1-5, null = no rating
  instruction: DataTypes.TEXT,
  editedBody: DataTypes.TEXT,
  meta: { type: DataTypes.JSONB, defaultValue: {} },
});

const ScriptExample = define('ScriptExample', {
  topic: DataTypes.TEXT,
  brief: { type: DataTypes.JSONB, defaultValue: {} },
  output: { type: DataTypes.JSONB, defaultValue: {} },
  quality: { type: DataTypes.FLOAT, defaultValue: 0.8 },
  source: { type: DataTypes.STRING, defaultValue: 'user-approved' },
  actor: { type: DataTypes.STRING, defaultValue: 'creator' }, // who approved
  approvalCount: { type: DataTypes.INTEGER, defaultValue: 1 },
  performanceScore: { type: DataTypes.FLOAT, defaultValue: 0 }, // 0-1 from Metrics join
  styleTags: { type: DataTypes.JSONB, defaultValue: {} }, // {tone,audience,punchiness,...}
  usageCount: { type: DataTypes.INTEGER, defaultValue: 0 },
});

// Per-workspace learned style (manager + creator signals merged, manager weighs 2x)
const WorkspaceProfile = define('WorkspaceProfile', {
  workspaceKey: { type: DataTypes.STRING, defaultValue: 'default' }, // projectId or 'default' until auth lands
  preferredTones: { type: DataTypes.JSONB, defaultValue: {} }, // {punchy:3,...}
  preferredAudiences: { type: DataTypes.JSONB, defaultValue: [] },
  avgLengthSec: DataTypes.FLOAT,
  ctaStyle: DataTypes.TEXT,
  topCategories: { type: DataTypes.JSONB, defaultValue: [] },
  stats: { type: DataTypes.JSONB, defaultValue: {} }, // {approvals, rejects, avgRating, lastComputed}
});

const HookPattern = define('HookPattern', {
  pattern: { type: DataTypes.TEXT, allowNull: false },
  category: { type: DataTypes.STRING, allowNull: false }, // question|statement|story|stat|contrarian
  example: DataTypes.TEXT,
  source: { type: DataTypes.STRING, defaultValue: 'viral-hooks' },
});

const Hook = define('Hook', {
  scriptId: DataTypes.UUID,
  projectId: DataTypes.UUID,
  text: { type: DataTypes.TEXT, allowNull: false },
  score: { type: DataTypes.FLOAT, defaultValue: 0 },
  style: { type: DataTypes.STRING, defaultValue: 'curiosity' },
  patternId: DataTypes.UUID,
  category: { type: DataTypes.STRING, defaultValue: 'statement' },
});

const TranscriptSegment = define('TranscriptSegment', {
  assetId: DataTypes.UUID,
  projectId: DataTypes.UUID,
  startSec: DataTypes.FLOAT,
  endSec: DataTypes.FLOAT,
  text: DataTypes.TEXT,
  embeddingHint: DataTypes.TEXT,
});

const Clip = define('Clip', {
  projectId: DataTypes.UUID,
  assetId: DataTypes.UUID,
  title: DataTypes.STRING,
  startSec: DataTypes.FLOAT,
  endSec: DataTypes.FLOAT,
  viralityScore: { type: DataTypes.FLOAT, defaultValue: 0 },
  hookText: DataTypes.TEXT,
  captions: { type: DataTypes.JSONB, defaultValue: [] },
  status: { type: DataTypes.STRING, defaultValue: 'suggested' },
});

const EditProject = define('EditProject', {
  projectId: DataTypes.UUID,
  clipId: DataTypes.UUID,
  // Editable EDL: creator retains control
  edl: { type: DataTypes.JSONB, defaultValue: { tracks: [], captions: [], overlays: [] } },
  platform: { type: DataTypes.STRING, defaultValue: 'tiktok' },
  aspect: { type: DataTypes.STRING, defaultValue: '9:16' },
  version: { type: DataTypes.INTEGER, defaultValue: 1 },
});

const PublishJob = define('PublishJob', {
  projectId: DataTypes.UUID,
  clipId: DataTypes.UUID,
  variantId: DataTypes.UUID,
  platform: { type: DataTypes.STRING, allowNull: false },
  scheduledAt: DataTypes.DATE,
  status: { type: DataTypes.STRING, defaultValue: 'draft' },
  caption: DataTypes.TEXT,
  hashtags: { type: DataTypes.JSONB, defaultValue: [] },
  resultUrl: DataTypes.TEXT,
});

// Multi-platform adaptation variants (DATABASE.md §4.4 platform_variants, PUBLISHING.md §3)
const PlatformVariant = define('PlatformVariant', {
  clipId: DataTypes.UUID,
  platform: { type: DataTypes.STRING, allowNull: false },
  aspect: { type: DataTypes.STRING, defaultValue: '9:16' },
  duration: DataTypes.FLOAT,
  title: DataTypes.STRING,
  caption: DataTypes.TEXT,
  hashtags: { type: DataTypes.JSONB, defaultValue: [] },
  cta: DataTypes.STRING,
  captionStyle: DataTypes.STRING,
  reframe: { type: DataTypes.JSONB, defaultValue: {} },
  edlVersion: DataTypes.INTEGER,
  warnings: { type: DataTypes.JSONB, defaultValue: [] },
  status: { type: DataTypes.STRING, defaultValue: 'ready' }, // ready | needs_attention
  assetId: DataTypes.UUID, // rendered variant file (F6.9), null until rendered
});

const Metric = define('Metric', {
  projectId: DataTypes.UUID,
  clipId: DataTypes.UUID,
  platform: DataTypes.STRING,
  views: { type: DataTypes.INTEGER, defaultValue: 0 },
  likes: { type: DataTypes.INTEGER, defaultValue: 0 },
  comments: { type: DataTypes.INTEGER, defaultValue: 0 },
  shares: { type: DataTypes.INTEGER, defaultValue: 0 },
  retentionPct: { type: DataTypes.FLOAT, defaultValue: 0 },
});

Project.hasMany(Asset, { foreignKey: 'project_id' });
Asset.belongsTo(Project, { foreignKey: 'project_id' });
Project.hasMany(Script, { foreignKey: 'project_id' });
Project.hasMany(Clip, { foreignKey: 'project_id' });
Script.hasMany(Hook, { foreignKey: 'script_id' });
Clip.hasMany(PlatformVariant, { foreignKey: 'clip_id' });
PlatformVariant.belongsTo(Clip, { foreignKey: 'clip_id' });

module.exports = { sequelize, Project, Asset, Script, ScriptFeedback, ScriptExample, WorkspaceProfile, Hook, HookPattern, TranscriptSegment, Clip, EditProject, PublishJob, PlatformVariant, Metric };

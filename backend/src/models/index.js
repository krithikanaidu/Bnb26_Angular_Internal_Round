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
});

const Hook = define('Hook', {
  scriptId: DataTypes.UUID,
  projectId: DataTypes.UUID,
  text: { type: DataTypes.TEXT, allowNull: false },
  score: { type: DataTypes.FLOAT, defaultValue: 0 },
  style: { type: DataTypes.STRING, defaultValue: 'curiosity' },
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
  // Render/extras bag (ClipAI output file, job id, transcript mode…)
  meta: { type: DataTypes.JSONB, defaultValue: {} },
});

// ClipAI render job: upload → transcribe → score → trim/9:16/subs → mp4s
const ClipJob = define('ClipJob', {
  projectId: DataTypes.UUID,
  sourceName: DataTypes.STRING,
  sourcePath: DataTypes.TEXT,
  status: { type: DataTypes.STRING, defaultValue: 'queued' }, // queued|transcribing|finding|rendering|titling|done|error
  stage: { type: DataTypes.STRING, defaultValue: 'queued' },
  progress: { type: DataTypes.FLOAT, defaultValue: 0 },
  options: { type: DataTypes.JSONB, defaultValue: {} },
  transcript: { type: DataTypes.JSONB, defaultValue: null },
  outputs: { type: DataTypes.JSONB, defaultValue: [] },
  error: DataTypes.TEXT,
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
  platform: { type: DataTypes.STRING, allowNull: false },
  scheduledAt: DataTypes.DATE,
  status: { type: DataTypes.STRING, defaultValue: 'draft' },
  caption: DataTypes.TEXT,
  hashtags: { type: DataTypes.JSONB, defaultValue: [] },
  resultUrl: DataTypes.TEXT,
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
Project.hasMany(ClipJob, { foreignKey: 'project_id' });
Script.hasMany(Hook, { foreignKey: 'script_id' });

module.exports = { sequelize, Project, Asset, Script, Hook, TranscriptSegment, Clip, EditProject, PublishJob, Metric, ClipJob };

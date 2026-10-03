const USE_MOCK = import.meta.env.VITE_USE_MOCK === 'true' || true;

const API_BASE = import.meta.env.VITE_API_URL ?? '/api';

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options?.headers },
  });
  if (!res.ok) throw new Error(`API ${res.status}: ${res.statusText}`);
  return res.json() as Promise<T>;
}

// ─── Types ───

export type TranscribeResponse = { assetId: string; transcript: string; status: 'done' };
export type SearchResult = { id: string; name: string; type: string; transcriptSnippet: string; tags: string[]; score: number };
export type Beat = { id: string; text: string; timecode: string };
export type BeatsResponse = { scriptId: string; beats: Beat[] };
export type AlignResponse = { matched: boolean; beatId: string; segmentId: string; gap: boolean };
export type EDLOpResponse = { opId: string; status: 'accepted' | 'rejected' };
export type RenderResponse = { jobId: string; status: 'queued' };
export type AdaptResponse = { variantId: string; platform: string; adapted: boolean };
export type PublishResponse = { variantId: string; platform: string; scheduledAt: string; status: 'scheduled' };
export type CommentResponse = { id: string; clipId: string; text: string; author: string };
export type JobResponse = { id: string; status: 'queued' | 'running' | 'done' | 'failed'; progress: number };
export type InsightSummary = { metrics: { label: string; value: string; change: string }[] };
export type Recommendation = { id: string; title: string; category: string; impact: string };

// ─── Mock data ───

const mockTranscript = 'So today I want to talk about something that has completely changed the way I create content. These five AI tools feel like cheating, but they are not. They just automate the boring parts so you can focus on the creative work.';

const mockSearchResults: SearchResult[] = [
  { id: 'a1', name: 'studio-wide-shot.mp4', type: 'video', transcriptSnippet: '...changed the way I create content...', tags: ['studio'], score: 0.95 },
  { id: 'a2', name: 'desk-setup-cam.mp4', type: 'video', transcriptSnippet: '...the setup I use for every...', tags: ['desk'], score: 0.82 },
  { id: 'a5', name: 'screen-recording-edit.mp4', type: 'video', transcriptSnippet: '...how I edit these videos...', tags: ['screen', 'tutorial'], score: 0.78 },
];

const mockBeats: Beat[] = [
  { id: 'b1', text: 'Hook: These 5 AI tools feel illegal to know about', timecode: '00:00' },
  { id: 'b2', text: 'Tool 1: Auto-captioning that actually works', timecode: '00:05' },
  { id: 'b3', text: 'Tool 2: B-roll finder from transcripts', timecode: '00:15' },
  { id: 'b4', text: 'Tool 3: Hook generator tested on 1000 videos', timecode: '00:25' },
  { id: 'b5', text: 'CTA: Follow for daily AI tool drops', timecode: '00:35' },
];

const mockAlign: AlignResponse[] = [
  { matched: true, beatId: 'b1', segmentId: 'seg1', gap: false },
  { matched: true, beatId: 'b2', segmentId: 'seg2', gap: false },
  { matched: false, beatId: 'b3', segmentId: '', gap: true },
  { matched: true, beatId: 'b4', segmentId: 'seg4', gap: false },
  { matched: false, beatId: 'b5', segmentId: '', gap: true },
];

const mockInsights: InsightSummary = {
  metrics: [
    { label: 'Avg Watch Time', value: '18.2s', change: '+24%' },
    { label: 'Completion Rate', value: '67%', change: '+12%' },
    { label: 'Cross-Platform Reach', value: '142K', change: '+89%' },
    { label: 'Hook Retention (3s)', value: '82%', change: '+8%' },
  ],
};

const mockRecs: Recommendation[] = [
  { id: 'r1', title: 'Switch to question hooks', category: 'Hooks', impact: 'High' },
  { id: 'r2', title: 'Keep clips under 45 seconds', category: 'Length', impact: 'Medium' },
  { id: 'r3', title: 'Add pattern interrupt in first 2s', category: 'Editing', impact: 'High' },
  { id: 'r4', title: 'Cross-post to TikTok first', category: 'Publishing', impact: 'Medium' },
];

// ─── API clients ───

export const api = {
  // Assets
  transcribe: (assetId: string) =>
    USE_MOCK
      ? Promise.resolve({ assetId, transcript: mockTranscript, status: 'done' } as TranscribeResponse)
      : apiFetch(`/assets/${assetId}/transcribe`, { method: 'POST' }),

  searchAssets: (q: string) =>
    USE_MOCK
      ? Promise.resolve(mockSearchResults)
      : apiFetch(`/assets/search?q=${encodeURIComponent(q)}`),

  // Scripts
  generateBeats: (scriptId: string) =>
    USE_MOCK
      ? Promise.resolve({ scriptId, beats: mockBeats } as BeatsResponse)
      : apiFetch(`/scripts/${scriptId}/beats`, { method: 'POST' }),

  align: (projectId: string) =>
    USE_MOCK
      ? Promise.resolve(mockAlign)
      : apiFetch(`/projects/${projectId}/align`, { method: 'POST' }),

  // Clips / EDL
  getEDL: (clipId: string) =>
    USE_MOCK
      ? Promise.resolve({ clipId, edl: [] })
      : apiFetch(`/clips/${clipId}/edl`),

  acceptOp: (clipId: string, opId: string) =>
    USE_MOCK
      ? Promise.resolve({ opId, status: 'accepted' } as EDLOpResponse)
      : apiFetch(`/clips/${clipId}/edl/ops/${opId}/accept`, { method: 'POST' }),

  rejectOp: (clipId: string, opId: string) =>
    USE_MOCK
      ? Promise.resolve({ opId, status: 'rejected' } as EDLOpResponse)
      : apiFetch(`/clips/${clipId}/edl/ops/${opId}/reject`, { method: 'POST' }),

  render: (clipId: string) =>
    USE_MOCK
      ? Promise.resolve({ jobId: 'job-mock-1', status: 'queued' } as RenderResponse)
      : apiFetch(`/clips/${clipId}/render`, { method: 'POST' }),

  adapt: (clipId: string) =>
    USE_MOCK
      ? Promise.resolve({ variantId: 'v-mock-1', platform: 'tiktok', adapted: true } as AdaptResponse)
      : apiFetch(`/clips/${clipId}/adapt`, { method: 'POST' }),

  // Variants
  publish: (variantId: string) =>
    USE_MOCK
      ? Promise.resolve({ variantId, platform: 'tiktok', scheduledAt: new Date().toISOString(), status: 'scheduled' } as PublishResponse)
      : apiFetch(`/variants/${variantId}/publish`, { method: 'POST' }),

  // Comments
  getComments: (clipId: string) =>
    USE_MOCK
      ? Promise.resolve([])
      : apiFetch(`/clips/${clipId}/comments`),

  postComment: (clipId: string, text: string, author: string) =>
    USE_MOCK
      ? Promise.resolve({ id: 'cm-mock', clipId, text, author } as CommentResponse)
      : apiFetch(`/clips/${clipId}/comments`, { method: 'POST', body: JSON.stringify({ text, author }) }),

  // Insights
  getInsightSummary: () =>
    USE_MOCK
      ? Promise.resolve(mockInsights)
      : apiFetch('/insights/summary'),

  getRecommendations: () =>
    USE_MOCK
      ? Promise.resolve(mockRecs)
      : apiFetch('/insights/recommendations'),

  // Jobs
  getJob: (jobId: string) =>
    USE_MOCK
      ? Promise.resolve({ id: jobId, status: 'done', progress: 100 } as JobResponse)
      : apiFetch(`/jobs/${jobId}`),
};

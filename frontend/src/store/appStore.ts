import { create } from 'zustand';

export type PipelineStatus =
  | 'idea' | 'scripted' | 'recorded' | 'editing' | 'review' | 'scheduled' | 'published';

export type Platform = 'youtube' | 'instagram' | 'tiktok' | 'linkedin' | 'x';

export type EDLOpType = 'trim' | 'crop' | 'caption' | 'overlay_text' | 'speed';
export type EDLOpSource = 'ai' | 'user';
export type EDLOpStatus = 'pending' | 'accepted' | 'rejected';

export type EDLOp = {
  id: string;
  type: EDLOpType;
  source: EDLOpSource;
  reason: string;
  status: EDLOpStatus;
  params: Record<string, string | number>;
};

export type Project = {
  id: string;
  title: string;
  status: PipelineStatus;
  thumbnailColor: string;
  updatedAt: string;
};

export type Asset = {
  id: string;
  name: string;
  type: 'video' | 'audio' | 'image';
  transcriptSnippet?: string;
  tags: string[];
  duration: string;
};

export type Script = {
  id: string;
  title: string;
  hook: string;
  beats: { id: string; text: string; timecode: string; matched: boolean }[];
  content: string;
};

export type Clip = {
  id: string;
  projectId: string;
  title: string;
  duration: string;
  edl: EDLOp[];
  status: PipelineStatus;
};

export type Comment = {
  id: string;
  clipId: string;
  author: string;
  avatarVariant: string;
  text: string;
  timecode: string;
  resolved: boolean;
};

export type Insight = {
  id: string;
  metric: string;
  value: string;
  change: string;
  insight: string;
};

export type AppStore = {
  projects: Project[];
  assets: Asset[];
  scripts: Script[];
  clips: Clip[];
  comments: Comment[];
  insights: Insight[];
  currentStage: number;
  setCurrentStage: (stage: number) => void;
  advanceProject: (id: string) => void;
  acceptOp: (clipId: string, opId: string) => void;
  rejectOp: (clipId: string, opId: string) => void;
};

const mockProjects: Project[] = [
  { id: 'p1', title: '5 AI Tools That Feel Like Cheating', status: 'idea', thumbnailColor: '#6EC6F5', updatedAt: '2026-10-01' },
  { id: 'p2', title: "Why Your Hooks Aren't Working", status: 'scripted', thumbnailColor: '#F4B1D6', updatedAt: '2026-10-02' },
  { id: 'p3', title: 'The Creator Burnout Myth', status: 'recorded', thumbnailColor: '#FFD23F', updatedAt: '2026-09-30' },
  { id: 'p4', title: 'Batch Filming Changed My Life', status: 'editing', thumbnailColor: '#A855F7', updatedAt: '2026-09-29' },
  { id: 'p5', title: 'How I Edit in 20 Minutes', status: 'review', thumbnailColor: '#FF8A1F', updatedAt: '2026-09-28' },
  { id: 'p6', title: 'Newsletter to Short-Form Pipeline', status: 'scheduled', thumbnailColor: '#2DC653', updatedAt: '2026-09-27' },
  { id: 'p7', title: 'From Zero to 10K: Month 1 Recap', status: 'published', thumbnailColor: '#E5383B', updatedAt: '2026-09-25' },
];

const mockAssets: Asset[] = [
  { id: 'a1', name: 'studio-wide-shot.mp4', type: 'video', transcriptSnippet: 'So today I want to talk about something that...', tags: ['studio', 'b-roll'], duration: '12:34' },
  { id: 'a2', name: 'desk-setup-cam.mp4', type: 'video', transcriptSnippet: 'This is the setup I use for every single recording...', tags: ['desk', 'setup'], duration: '05:12' },
  { id: 'a3', name: 'voiceover-raw.wav', type: 'audio', transcriptSnippet: 'Hey everyone, welcome back to the channel...', tags: ['voiceover', 'audio'], duration: '03:45' },
  { id: 'a4', name: 'outdoor-walk-talk.mp4', type: 'video', transcriptSnippet: 'Walking and talking today about the creator economy...', tags: ['outdoor', 'b-roll'], duration: '08:21' },
  { id: 'a5', name: 'screen-recording-edit.mp4', type: 'video', transcriptSnippet: 'Let me show you exactly how I edit these videos...', tags: ['screen', 'tutorial'], duration: '15:02' },
];

const mockScripts: Script[] = [
  {
    id: 's1',
    title: '5 AI Tools That Feel Like Cheating',
    hook: 'These 5 AI tools feel illegal to know about',
    beats: [
      { id: 'b1', text: 'Hook: These 5 AI tools feel illegal to know about', timecode: '00:00', matched: true },
      { id: 'b2', text: 'Tool 1: Auto-captioning that actually works', timecode: '00:05', matched: true },
      { id: 'b3', text: 'Tool 2: B-roll finder from transcripts', timecode: '00:15', matched: false },
      { id: 'b4', text: 'Tool 3: Hook generator tested on 1000 videos', timecode: '00:25', matched: true },
      { id: 'b5', text: 'CTA: Follow for daily AI tool drops', timecode: '00:35', matched: false },
    ],
    content: 'HOOK: These 5 AI tools feel illegal to know about\n\n1. Auto-captioning that actually works\n2. B-roll finder from transcripts\n3. Hook generator tested on 1000 videos\n4. Smart trim that removes dead air\n5. Multi-platform adapter\n\nCTA: Follow for daily AI tool drops',
  },
  {
    id: 's2',
    title: "Why Your Hooks Aren't Working",
    hook: 'Your hooks are failing for one simple reason',
    beats: [
      { id: 'b1', text: 'Hook: Your hooks are failing for one simple reason', timecode: '00:00', matched: true },
      { id: 'b2', text: 'The problem: you are using statement hooks', timecode: '00:04', matched: true },
      { id: 'b3', text: 'The fix: ask questions instead', timecode: '00:12', matched: true },
      { id: 'b4', text: 'Example: before vs after', timecode: '00:20', matched: false },
    ],
    content: 'HOOK: Your hooks are failing for one simple reason\n\nThe problem: statement hooks\nThe fix: question hooks\nExample comparison\n\nCTA: Save this for your next script',
  },
];

const mockClips: Clip[] = [
  {
    id: 'c1',
    projectId: 'p4',
    title: 'Batch Filming Changed My Life',
    duration: '00:42',
    status: 'editing',
    edl: [
      { id: 'op1', type: 'trim', source: 'ai', reason: 'Removed 2.3s of silence at 00:08', status: 'accepted', params: { start: 8, duration: 2.3 } },
      { id: 'op2', type: 'caption', source: 'ai', reason: 'Auto-generated captions for entire clip', status: 'pending', params: { style: 'pop' } },
      { id: 'op3', type: 'crop', source: 'ai', reason: 'Reframed to 9:16 for vertical', status: 'pending', params: { ratio: '9:16' } },
      { id: 'op4', type: 'speed', source: 'ai', reason: 'Sped up slow section by 1.2x at 00:25', status: 'pending', params: { start: 25, factor: 1.2 } },
    ],
  },
];

const mockComments: Comment[] = [
  { id: 'cm1', clipId: 'c1', author: 'Riya', avatarVariant: 'bob', text: 'The transition at 0:15 feels abrupt', timecode: '00:15', resolved: false },
  { id: 'cm2', clipId: 'c1', author: 'Arjun', avatarVariant: 'glasses', text: 'Love the hook! Maybe add a text overlay?', timecode: '00:02', resolved: false },
  { id: 'cm3', clipId: 'c1', author: 'Meera', avatarVariant: 'braids', text: 'Caption timing is slightly off here', timecode: '00:28', resolved: true },
];

const mockInsights: Insight[] = [
  { id: 'i1', metric: 'Avg Watch Time', value: '18.2s', change: '+24%', insight: 'Question hooks beat statements by 2x' },
  { id: 'i2', metric: 'Completion Rate', value: '67%', change: '+12%', insight: 'Videos under 45s complete 40% more often' },
  { id: 'i3', metric: 'Cross-Platform Reach', value: '142K', change: '+89%', insight: 'TikTok adaptation drives 60% of discovery' },
  { id: 'i4', metric: 'Hook Retention (3s)', value: '82%', change: '+8%', insight: 'Pattern interrupt in first 2s retains viewers' },
];

export const useAppStore = create<AppStore>((set) => ({
  projects: mockProjects,
  assets: mockAssets,
  scripts: mockScripts,
  clips: mockClips,
  comments: mockComments,
  insights: mockInsights,
  currentStage: 1,
  setCurrentStage: (stage) => set({ currentStage: stage }),
  advanceProject: (id) =>
    set((s) => {
      const order: PipelineStatus[] = ['idea', 'scripted', 'recorded', 'editing', 'review', 'scheduled', 'published'];
      return {
        projects: s.projects.map((p) =>
          p.id === id
            ? { ...p, status: order[Math.min(order.indexOf(p.status) + 1, order.length - 1)] }
            : p
        ),
      };
    }),
  acceptOp: (clipId, opId) =>
    set((s) => ({
      clips: s.clips.map((c) =>
        c.id === clipId
          ? { ...c, edl: c.edl.map((op) => (op.id === opId ? { ...op, status: 'accepted' } : op)) }
          : c
      ),
    })),
  rejectOp: (clipId, opId) =>
    set((s) => ({
      clips: s.clips.map((c) =>
        c.id === clipId
          ? { ...c, edl: c.edl.map((op) => (op.id === opId ? { ...op, status: 'rejected' } : op)) }
          : c
      ),
    })),
}));

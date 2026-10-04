import { api } from '../lib/api';

// API layer for the ideation feature (AGENT/API.md §5, FEATURES.md Domain 3)
export const ideationApi = {
  listPatterns: (category) => api.get('/hook-patterns', { params: category ? { category } : {} }),
  generateHooks: (payload) => api.post('/content/hooks/generate', payload),
  generateScript: (payload) => api.post('/content/scripts/generate', payload),
  listScripts: (projectId) => api.get('/content/scripts', { params: projectId ? { project_id: projectId } : {} }),
  patchScript: (id, payload) => api.patch(`/content/scripts/${id}`, payload),
  generateBeats: (id, payload) => api.post(`/content/scripts/${id}/beats`, payload),
  refineScript: (id, payload) => api.post(`/content/scripts/${id}/refine`, payload),
  sendFeedback: (id, payload) => api.post(`/content/scripts/${id}/feedback`, payload),
  trainingExamples: (limit) => api.get('/content/training/examples', { params: { limit } }),
  mlProfile: (workspaceKey) => api.get('/content/training/profile', { params: { workspaceKey } }),
  mlInsights: (workspaceKey) => api.get('/content/training/insights', { params: { workspaceKey } }),
  mlRecompute: (workspaceKey) => api.post('/content/training/recompute', { workspaceKey }),
  listProjects: () => api.get('/projects'),
};

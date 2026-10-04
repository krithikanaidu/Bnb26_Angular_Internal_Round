import { api } from '../lib/api';

// API layer for the ideation feature (AGENT/API.md §5, FEATURES.md Domain 3)
export const ideationApi = {
  listPatterns: (category) => api.get('/hook-patterns', { params: category ? { category } : {} }),
  generateHooks: (payload) => api.post('/content/hooks/generate', payload),
  generateScript: (payload) => api.post('/content/scripts/generate', payload),
  listScripts: (projectId) => api.get('/content/scripts', { params: projectId ? { project_id: projectId } : {} }),
  patchScript: (id, payload) => api.patch(`/content/scripts/${id}`, payload),
  generateBeats: (id, payload) => api.post(`/content/scripts/${id}/beats`, payload),
  listProjects: () => api.get('/projects'),
};

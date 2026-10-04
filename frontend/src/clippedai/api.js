import { api, API_BASE } from '../lib/api';

const API = API_BASE;
// Outputs are served from the backend origin (/media), not under /api.
export const backendOrigin = API.replace(/\/api\/?$/, '');
export const mediaUrl = (file) => `${backendOrigin}${file}`;

export async function createJob(file, options, onProgress) {
  const form = new FormData();
  form.append('video', file);
  // Never append undefined/null — FormData would send the literal strings
  // "undefined"/"null" and Postgres UUID columns reject them.
  for (const [k, v] of Object.entries(options || {})) {
    if (v === undefined || v === null || v === '') continue;
    form.append(k, v);
  }
  const { data } = await api.post(`${API}/clippedai/jobs`, form, {
    onUploadProgress: (e) => {
      if (onProgress && e.total) onProgress(Math.round((e.loaded / e.total) * 100));
    },
  });
  return data;
}

export async function createJobFromLink(youtubeUrl, options) {
  const { data } = await api.post(`${API}/clippedai/jobs`, { youtubeUrl, ...(options || {}) });
  return data;
}

export async function inspectLink(url) {
  const { data } = await api.post(`${API}/clippedai/inspect`, { url });
  return data;
}

export async function listJobs() {
  const { data } = await api.get(`${API}/clippedai/jobs`);
  return data;
}

export async function getJob(id) {
  const { data } = await api.get(`${API}/clippedai/jobs/${id}`);
  return data;
}

export async function deleteJob(id) {
  const { data } = await api.delete(`${API}/clippedai/jobs/${id}`);
  return data;
}

export async function getHealth() {
  const { data } = await api.get(`${API}/health`);
  return data;
}

export const STAGES = {
  queued: 'Queued',
  downloading: 'Downloading from YouTube',
  transcribing: 'Transcribing',
  finding: 'Finding best moments',
  rendering: 'Rendering shorts',
  titling: 'Writing titles',
  done: 'Done',
  error: 'Failed',
};

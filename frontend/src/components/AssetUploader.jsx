// Multipart video/image/audio upload → POST /assets/upload, then onUploaded()
export default function AssetUploader({ onUploaded }) {
  const upload = async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const fd = new FormData();
    fd.append('file', f);
    const { api } = await import('../lib/api');
    await api.post('/assets/upload', fd);
    onUploaded?.();
  };
  return <input type="file" accept="video/*,image/*,audio/*" onChange={upload} />;
}

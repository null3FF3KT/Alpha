import React, { useState } from 'react';
/* Client-side checks are UX only; server revalidates size and MIME with sniffing. */

import { useMsal } from 'msal-react';
import { runUploadPipeline, PipelineEvent } from '../lib/rx/uploadPipeline';
import StatusPanel from './StatusPanel';
import { appInsights } from '../telemetry/appInsights';

const MAX_SIZE = 10 * 1024 * 1024;
const ALLOWED = ['image/png', 'image/jpeg'];

export default function UploadForm() {
  const { instance } = useMsal();
  const [events, setEvents] = useState<PipelineEvent[]>([]);
  const [error, setError] = useState<string | null>(null);

  const onFile = (f: File) => {
    setError(null);
    if (!ALLOWED.includes(f.type)) { setError('Only PNG/JPEG'); return; }
    if (f.size <= 0 || f.size > MAX_SIZE) { setError('File too large'); return; }

    const sub = runUploadPipeline(instance, f).subscribe({
      next: (e) => setEvents((prev) => [...prev, e]),
      error: (err) => { setError(String(err)); appInsights.trackEvent({ name: 'pipeline_error' }); },
    });

    return () => sub.unsubscribe();
  };

  return (
    <div style={{ padding: 24, fontFamily: 'sans-serif' }}>
      <h2>Secure Image Ingest</h2>
      <input type="file" accept="image/png,image/jpeg" onChange={(e) => {
        const file = e.target.files?.[0];
        if (file) onFile(file);
      }} />
      {error && <div style={{ color: 'red' }}>{error}</div>}
      <StatusPanel events={events} />
    </div>
  );
}

import React from 'react';
import type { PipelineEvent } from '../lib/rx/uploadPipeline';

export default function StatusPanel({ events }: { events: PipelineEvent[] }) {
  const progress = events.find((e) => e.type === 'progress') as any;
  const lastStatus = [...events].reverse().find((e) => e.type === 'status') as any;
  const result = events.find((e) => e.type === 'result') as any;

  return (
    <div style={{ marginTop: 16 }}>
      {progress && <div>Uploading: {Math.round((progress.loaded / progress.total) * 100)}%</div>}
      {result && <div>Correlation: {result.corrId}</div>}
      {lastStatus && (
        <div>
          Status: <span style={{ padding: '2px 6px', borderRadius: 4, background: chipColor(lastStatus.status) }}>{lastStatus.status}</span>
          {lastStatus.data.findings && lastStatus.data.findings.length > 0 && (
            <pre>{JSON.stringify(lastStatus.data.findings, null, 2)}</pre>
          )}
          {lastStatus.data.links?.resultBlobUrl && (
            <a href={lastStatus.data.links.resultBlobUrl} target="_blank">Results</a>
          )}
        </div>
      )}
    </div>
  );
}

function chipColor(s: string) {
  switch (s) {
    case 'received': return '#eef';
    case 'scanning': return '#ffe';
    case 'analyzing': return '#efe';
    case 'quarantined':
    case 'unsafe': return '#fdd';
    case 'complete': return '#def';
    default: return '#eee';
  }
}

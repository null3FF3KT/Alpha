import { describe, it, expect, vi } from 'vitest';
import { runUploadPipeline } from './uploadPipeline';

const fakePca: any = {
  getAllAccounts: () => [ { homeAccountId: 'x' } ],
  acquireTokenSilent: () => Promise.resolve({ accessToken: 't' })
};

global.fetch = vi.fn(async (url: string) => {
  if (url.toString().includes('/ingest')) {
    return { ok: true, json: async () => ({ corrId: '00000000-0000-0000-0000-000000000000' }) } as any;
  }
  return { ok: true, json: async () => ({ status: 'received', lastUpdate: new Date().toISOString() }) } as any;
}) as any;

describe('pipeline', () => {
  it('uploads and polls', async () => {
    const file = new File([new Uint8Array([1])], 'a.png', { type: 'image/png' });
    const evts: any[] = [];
    await new Promise((resolve, reject) => {
      runUploadPipeline(fakePca, file).subscribe({
        next: (e) => { evts.push(e); if (e.type === 'status') resolve(null); },
        error: reject
      });
    });
    expect(evts.some(e => e.type === 'result')).toBe(true);
  });
});

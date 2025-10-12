import { describe, it, expect, vi } from 'vitest';
import { runUploadPipeline } from './uploadPipeline';

describe('oversize and bad mime', () => {
  it('rejects oversize', async () => {
    const file = new File([new Uint8Array(11*1024*1024)], 'x.png', { type: 'image/png' });
    await expect(async () => new Promise((resolve, reject) => {
      runUploadPipeline({ getAllAccounts: () => [{id:1}], acquireTokenSilent: () => Promise.resolve({accessToken:'t'}) } as any, file).subscribe({ error: reject });
    })).rejects.toBeTruthy();
  });
  it('rejects bad mime', async () => {
    const file = new File([new Uint8Array([1])], 'x.txt', { type: 'text/plain' });
    await expect(async () => new Promise((resolve, reject) => {
      runUploadPipeline({ getAllAccounts: () => [{id:1}], acquireTokenSilent: () => Promise.resolve({accessToken:'t'}) } as any, file).subscribe({ error: reject });
    })).rejects.toBeTruthy();
  });
});

import { from, Observable, of, switchMap, throwError, timer } from 'rxjs';
import { map, takeUntil, catchError } from 'rxjs/operators';
import { apiScope, apiBaseUrl } from '../../msalConfig';
import type { IPublicClientApplication, AuthenticationResult } from '@azure/msal-browser';
import { StatusResponseSchema, IngestAcceptedSchema } from '../../types/contracts';
import { appInsights } from '../../telemetry/appInsights';

const MAX_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED = ['image/png', 'image/jpeg'];

export type UploadProgress = { type: 'progress'; loaded: number; total: number };
export type UploadResult = { type: 'result'; corrId: string };
export type StatusUpdate = { type: 'status'; status: ReturnType<typeof StatusResponseSchema.parse>['status']; data: ReturnType<typeof StatusResponseSchema.parse> };
export type PipelineEvent = UploadProgress | UploadResult | StatusUpdate;

export function runUploadPipeline(pca: IPublicClientApplication, file: File): Observable<PipelineEvent> {
  return from(validateFile(file)).pipe(
    switchMap(() => from(getToken(pca))),
    switchMap((token) => uploadWithProgress(token, file)),
    switchMap(({ corrId }) => pollStatus(corrId))
  );
}

async function validateFile(file: File) {
  if (!ALLOWED.includes(file.type)) throw new Error('Unsupported file type');
  if (file.size <= 0 || file.size > MAX_SIZE) throw new Error('Invalid size');
}

async function getToken(pca: IPublicClientApplication): Promise<string> {
  const accounts = pca.getAllAccounts();
  const acct = accounts[0] ?? (await pca.loginPopup({ scopes: [apiScope] })).account!;
  const res: AuthenticationResult = await pca.acquireTokenSilent({ account: acct, scopes: [apiScope] });
  return res.accessToken;
}

function uploadWithProgress(token: string, file: File): Observable<UploadResult | UploadProgress> {
  return new Observable((subscriber) => {
    appInsights.trackEvent({ name: 'upload_start' });
    const controller = new AbortController();
    const total = file.size;
    let loaded = 0;

    const stream = file.stream();
    const reader = stream.getReader();

    const upload = async () => {
      const body = new ReadableStream<Uint8Array>({
        async pull(ctrl) {
          const { done, value } = await reader.read();
          if (done) { ctrl.close(); return; }
          loaded += value.byteLength;
          subscriber.next({ type: 'progress', loaded, total });
          ctrl.enqueue(value);
        }
      });

      const resp = await fetch(`${apiBaseUrl}/ingest`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'X-Content-Size': String(file.size),
          'Content-Type': file.type,
        },
        body,
        signal: controller.signal
      });

      if (!resp.ok) {
        const msg = `${resp.status}`;
        appInsights.trackEvent({ name: 'upload_fail', properties: { status: msg } });
        subscriber.error(new Error(msg));
        return;
      }
      const json = await resp.json();
      const parsed = IngestAcceptedSchema.safeParse(json);
      if (!parsed.success) {
        subscriber.error(new Error('Bad response'));
        return;
      }
      const corrId = parsed.data.corrId;
      subscriber.next({ type: 'result', corrId });
      subscriber.complete();
    };

    upload().catch((e) => subscriber.error(e));

    return () => controller.abort();
  });
}

function pollStatus(corrId: string): Observable<PipelineEvent> {
  return timer(0, 2000).pipe(
    switchMap(() => fetch(`${apiBaseUrl}/status/${corrId}`).then(r => r.json())),
    map((j) => {
      const parsed = StatusResponseSchema.safeParse(j);
      if (!parsed.success) throw new Error('parse');
      return parsed.data;
    }),
    map((data) => ({ type: 'status', status: data.status, data }) as StatusUpdate),
    takeUntil(
      new Observable<StatusUpdate>((sub) => {
        const t = setInterval(async () => {
          const r = await fetch(`${apiBaseUrl}/status/${corrId}`);
          const j = await r.json();
          const p = StatusResponseSchema.safeParse(j);
          if (p.success && ['complete', 'quarantined', 'unsafe'].includes(p.data.status)) {
            sub.next({ type: 'status', status: p.data.status, data: p.data } as StatusUpdate);
            sub.complete();
          }
        }, 2000);
        return () => clearInterval(t);
      })
    ),
    catchError((e) => {
      appInsights.trackEvent({ name: 'status_poll_error', properties: { message: String(e) } });
      return throwError(() => e);
    })
  );
}

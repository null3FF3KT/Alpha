import { vi } from 'vitest';
import { appInsights } from './telemetry/appInsights';
vi.spyOn(appInsights, 'trackEvent').mockImplementation(() => {} as any);

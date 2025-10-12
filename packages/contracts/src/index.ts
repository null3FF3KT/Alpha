import { z } from 'zod';

export const Status = z.enum(['received','scanning','quarantined','unsafe','analyzing','complete']);
export type StatusType = z.infer<typeof Status>;

export const IngestAcceptedSchema = z.object({
  corrId: z.string().uuid(),
});

export const StatusResponseSchema = z.object({
  status: Status,
  lastUpdate: z.string(),
  findings: z.array(z.object({ labels: z.array(z.string()), score: z.number().optional() })).optional(),
  links: z.object({ resultBlobUrl: z.string().url().optional() }).partial().optional(),
});

export type StatusResponse = z.infer<typeof StatusResponseSchema>;

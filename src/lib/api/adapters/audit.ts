/**
 * auditApi — adapter over the orval-generated AuditService client.
 *
 * Preserves the hand-written module's public signature:
 *   list(params) -> { records: AuditLog[]; total: number }
 *
 * Maps the generated V1AuditRecord (proto shape) to the UI's AuditLog
 * domain type so consumers keep importing from ../types unchanged.
 */
import { auditServiceQueryAuditRecords } from '../generated/audit-service/audit-service';
import type { V1AuditRecord } from '../generated/model';
import type { AuditLog } from '../types';

function toAuditLog(r: V1AuditRecord): AuditLog {
  const meta = r.metadata;
  return {
    id: r.id || '',
    namespaceId: asString(meta?.namespaceId),
    resourceType: r.resource?.type,
    resourceName: r.resource?.id,
    version: asString(meta?.version),
    action: r.action || '',
    operator:
      r.actor?.subjectId ||
      asString(meta?.operator) ||
      asString(meta?.actorId),
    detail: meta,
    requestId: r.requestId,
    createTime: r.time ? Date.parse(r.time) : 0,
  };
}

function asString(v: unknown): string | undefined {
  return typeof v === 'string' ? v : undefined;
}

export const auditApi = {
  /**
   * Query audit records. Mirrors the hub's /v1/audit/records RPC.
   *
   * Filter fields are all optional — empty fields are wildcards.
   * Returns records sorted by time descending (newest first).
   */
  list: async (params: Record<string, unknown> = {}) => {
    const reply = await auditServiceQueryAuditRecords(
      // Generated params are all optional strings/number; pass through the
      // caller's filter keys (actorId, resourceType, action, limit, ...).
      params as Parameters<typeof auditServiceQueryAuditRecords>[0],
    );
    const records = (reply.records || []).map(toAuditLog);
    return { records, total: reply.total ?? records.length };
  },
};

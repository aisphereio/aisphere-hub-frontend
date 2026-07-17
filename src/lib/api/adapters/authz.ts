/**
 * authzApi — adapter over the orval-generated AuthzService client.
 *
 * Preserves the hand-written module's public signatures (check,
 * writeRelationships, deleteRelationships, readRelationships,
 * lookupResources, lookupSubjects, readSchema, writeSchema) so consumers
 * keep importing from ../index unchanged.
 *
 * The generated client uses flat query params ('subject.type',
 * 'filter.resourceType'); the hand-written API accepts nested objects, so
 * the adapter expands them. Response shapes already match the hand-written
 * inline types (effect/allowed, consistencyToken/written, relationships[],
 * nextCursor), so most methods are thin pass-throughs.
 */
import {
  authzServiceCheckPermission,
  authzServiceDeleteRelationships,
  authzServiceLookupResources,
  authzServiceLookupSubjects,
  authzServiceReadRelationships,
  authzServiceReadSchema,
  authzServiceWriteRelationships,
  authzServiceWriteSchema,
} from '../generated/authz-service/authz-service';

export const authzApi = {
  /** Check if subject has permission on resource. */
  check: (params: {
    subject: { type: string; id: string; relation?: string };
    resource: { type: string; id: string };
    permission: string;
    fullyConsistent?: boolean;
    consistencyToken?: string;
  }) =>
    authzServiceCheckPermission({
      subject: params.subject,
      resource: params.resource,
      permission: params.permission,
      fullyConsistent: params.fullyConsistent,
      consistencyToken: params.consistencyToken,
    }),

  /** Write (create or update) relationship tuples. Idempotent. */
  writeRelationships: (
    relationships: Array<{
      resource: { type: string; id: string };
      relation: string;
      subject: { type: string; id: string; relation?: string };
      caveatName?: string;
      caveatContext?: Record<string, unknown>;
      expiresAt?: string;
    }>,
  ) =>
    authzServiceWriteRelationships({ relationships }).then((r) => ({
      consistencyToken: r.consistencyToken || '',
      written: r.written ?? 0,
    })),

  /** Delete relationship tuples matching the filter. */
  deleteRelationships: (filter: {
    resourceType?: string;
    resourceId?: string;
    relation?: string;
    subjectType?: string;
    subjectId?: string;
    subjectRelation?: string;
  }) =>
    authzServiceDeleteRelationships({ filter }).then((r) => ({
      consistencyToken: r.consistencyToken || '',
      deleted: r.deleted ?? 0,
    })),

  /** List relationship tuples matching the filter. */
  readRelationships: (filter: {
    resourceType?: string;
    resourceId?: string;
    relation?: string;
    subjectType?: string;
    subjectId?: string;
    subjectRelation?: string;
  }) =>
    authzServiceReadRelationships({
      'filter.resourceType': filter.resourceType,
      'filter.resourceId': filter.resourceId,
      'filter.relation': filter.relation,
      'filter.subjectType': filter.subjectType,
      'filter.subjectId': filter.subjectId,
      'filter.subjectRelation': filter.subjectRelation,
    }).then((r) => ({
      relationships: r.relationships || [],
      nextCursor: r.nextCursor,
      consistencyToken: r.consistencyToken,
    })),

  /** List resources a subject can access with the given permission. */
  lookupResources: (params: {
    subject: { type: string; id: string; relation?: string };
    resourceType: string;
    permission: string;
  }) =>
    authzServiceLookupResources({
      'subject.type': params.subject.type,
      'subject.id': params.subject.id,
      'subject.relation': params.subject.relation,
      resourceType: params.resourceType,
      permission: params.permission,
    }).then((r) => ({
      resources: r.resources || [],
      nextCursor: r.nextCursor,
      consistencyToken: r.consistencyToken,
    })),

  /** List subjects that can access the given resource with the given permission. */
  lookupSubjects: (params: {
    resource: { type: string; id: string };
    permission: string;
    subjectType: string;
  }) =>
    authzServiceLookupSubjects({
      'resource.type': params.resource.type,
      'resource.id': params.resource.id,
      permission: params.permission,
      subjectType: params.subjectType,
    }).then((r) => ({
      subjects: r.subjects || [],
      nextCursor: r.nextCursor,
      consistencyToken: r.consistencyToken,
    })),

  /** Read the current SpiceDB schema text. */
  readSchema: () =>
    authzServiceReadSchema().then((r) => ({
      schemaText: r.schemaText || '',
    })),

  /** Replace the SpiceDB schema. Use with care. */
  writeSchema: (schemaText: string) =>
    authzServiceWriteSchema({ schemaText }),
};

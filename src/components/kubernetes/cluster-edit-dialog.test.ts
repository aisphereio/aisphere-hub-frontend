import { describe, expect, it } from 'vitest';

import {
  buildClusterUpdateBody,
  formatClusterLabels,
  parseClusterLabels,
} from './cluster-edit-dialog';

import type { V1Cluster } from '@/lib/api/generated/model';

describe('cluster edit helpers', () => {
  it('formats and parses labels deterministically', () => {
    expect(formatClusterLabels({ region: 'cn-north-1', environment: 'production' }))
      .toBe('environment=production\nregion=cn-north-1');

    expect(parseClusterLabels('region=cn-north-1\nenvironment=production'))
      .toEqual({ environment: 'production', region: 'cn-north-1' });
  });

  it('keeps equals signs inside label values', () => {
    expect(parseClusterLabels('selector=app=runtime')).toEqual({ selector: 'app=runtime' });
  });

  it('rejects malformed and duplicate labels', () => {
    expect(() => parseClusterLabels('invalid')).toThrow('key=value');
    expect(() => parseClusterLabels('region=cn\nregion=de')).toThrow('重复');
  });

  it('builds a minimal field mask with the current revision', () => {
    const cluster: V1Cluster = {
      id: 'cluster-1',
      displayName: 'Development',
      description: 'old',
      distribution: 'k3s',
      labels: { environment: 'dev' },
      revision: '7',
    };

    expect(buildClusterUpdateBody(cluster, {
      displayName: 'Development',
      description: 'new',
      distribution: 'k3s',
      labels: 'environment=dev\nregion=eu-central-1',
    })).toEqual({
      expectedRevision: '7',
      updateMask: 'description,labels',
      cluster: {
        description: 'new',
        labels: { environment: 'dev', region: 'eu-central-1' },
      },
    });
  });

  it('returns null when nothing changed', () => {
    const cluster: V1Cluster = {
      displayName: 'Production',
      description: 'primary cluster',
      distribution: 'rke2',
      labels: { region: 'eu-central-1' },
      revision: '3',
    };

    expect(buildClusterUpdateBody(cluster, {
      displayName: 'Production',
      description: 'primary cluster',
      distribution: 'rke2',
      labels: 'region=eu-central-1',
    })).toBeNull();
  });
});

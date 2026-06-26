'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { SkillVersion } from '@/lib/api/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Eye, Send, CheckCircle2, Play, Pause, Download, RotateCcw, Zap } from 'lucide-react';
import { fmtRelativeTime } from '@/lib/utils';
import { getStatusColor } from '@/lib/utils';
import { skillApi } from '@/lib/api';
import { toast } from 'sonner';

interface SkillVersionTimelineProps {
  versions: SkillVersion[];
  skillName: string;
  onViewFiles: (version: string) => void;
  onAction: (action: string, version: string) => void;
}

export function SkillVersionTimeline({ versions, skillName, onViewFiles, onAction }: SkillVersionTimelineProps) {
  if (versions.length === 0) {
    return <div className="text-xs text-muted-foreground text-center py-4">No versions found</div>;
  }

  const downloadVersion = async (version: string) => {
    try {
      const pkg = await skillApi.download(skillName, version);
      const raw = pkg.packageBytes || '';
      const binary = atob(raw);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
      const url = URL.createObjectURL(new Blob([bytes], { type: 'application/zip' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `${skillName}-${version}.zip`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Download failed');
    }
  };

  return (
    <div className="space-y-3">
      {versions.map((v) => (
        <Card key={v.version} className="border-border/50">
          <CardContent className="p-3">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <code className="text-xs font-mono bg-muted px-1.5 py-0.5 rounded">v{v.version}</code>
                  <Badge variant="secondary" className={`text-[10px] ${getStatusColor(v.status)}`}>{v.status || '-'}</Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  {v.commitMsg || 'No commit message'} &middot; {v.author || '-'} &middot; {fmtRelativeTime(v.updateTime || v.createdAt)}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5 mt-2">
              <Button variant="outline" size="sm" className="h-7 text-[11px]" onClick={() => onViewFiles(v.version)}>
                <Eye className="h-3 w-3 mr-1" /> Files
              </Button>
              <Button variant="outline" size="sm" className="h-7 text-[11px]" onClick={() => onAction('submit', v.version)}>
                <Send className="h-3 w-3 mr-1" /> Submit
              </Button>
              <Button variant="outline" size="sm" className="h-7 text-[11px]" onClick={() => onAction('publish', v.version)}>
                <CheckCircle2 className="h-3 w-3 mr-1" /> Publish
              </Button>
              <Button variant="outline" size="sm" className="h-7 text-[11px] text-emerald-600" onClick={() => onAction('online', v.version)}>
                <Play className="h-3 w-3 mr-1" /> Online
              </Button>
              <Button variant="outline" size="sm" className="h-7 text-[11px] text-amber-600" onClick={() => onAction('offline', v.version)}>
                <Pause className="h-3 w-3 mr-1" /> Offline
              </Button>
              {v.status === 'draft' && (
                <Button variant="outline" size="sm" className="h-7 text-[11px] text-violet-600" onClick={() => onAction('redraft', v.version)}>
                  <RotateCcw className="h-3 w-3 mr-1" /> Redraft
                </Button>
              )}
              <Button variant="outline" size="sm" className="h-7 text-[11px] text-orange-600" onClick={() => onAction('forcePublish', v.version)}>
                <Zap className="h-3 w-3 mr-1" /> Force Publish
              </Button>
              <Button variant="outline" size="sm" className="h-7 text-[11px]" onClick={() => downloadVersion(v.version)}>
                <Download className="h-3 w-3 mr-1" /> Download
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

'use client';

import { useState } from 'react';
import { ShieldCheck, Eye, Plus, Trash2, Search, X, Check, Code2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  useIamAuthzSchema,
  useIamAuthzValidateSchema,
  useIamAuthzPublishSchema,
  useIamAuthzRelationships,
  useIamAuthzWriteRelationships,
  useIamAuthzDeleteRelationships,
  useIamAuthzCheckPermission,
  useIamAuthzExplainPermission,
  useIamAuthzEffectivePermissions,
} from '@/hooks/use-iam';
import { toast } from 'sonner';
import type { IamRelationship, IamCheckPermissionRequest } from '@/lib/api/types';

type AuthzTab = 'schema' | 'relationships' | 'permissions';

export function AuthzAdminPage() {
  const [activeTab, setActiveTab] = useState<AuthzTab>('schema');

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-violet-500" />
            Authorization Admin
          </h1>
          <p className="text-sm text-muted-foreground">
            Manage SpiceDB schema, relationships, and permissions
          </p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as AuthzTab)}>
        <TabsList className="w-full justify-start overflow-x-auto">
          <TabsTrigger value="schema" className="gap-2">
            <Code2 className="h-4 w-4" /> Schema
          </TabsTrigger>
          <TabsTrigger value="relationships" className="gap-2">
            <Search className="h-4 w-4" /> Relationships
          </TabsTrigger>
          <TabsTrigger value="permissions" className="gap-2">
            <Check className="h-4 w-4" /> Permissions
          </TabsTrigger>
        </TabsList>

        <TabsContent value="schema" className="mt-4">
          <SchemaTab />
        </TabsContent>
        <TabsContent value="relationships" className="mt-4">
          <RelationshipsTab />
        </TabsContent>
        <TabsContent value="permissions" className="mt-4">
          <PermissionsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ─── Schema Tab ──────────────────────────────────────────────────────────

function SchemaTab() {
  const { data: schema, isLoading, refetch } = useIamAuthzSchema();
  const validateMutation = useIamAuthzValidateSchema();
  const publishMutation = useIamAuthzPublishSchema();
  const [editMode, setEditMode] = useState(false);
  const [editText, setEditText] = useState('');
  const [validationResult, setValidationResult] = useState<{ valid: boolean; error?: string } | null>(null);

  const handleValidate = async () => {
    try {
      const result = await validateMutation.mutateAsync(editText);
      setValidationResult(result);
      toast.success(result.valid ? 'Schema is valid' : 'Schema validation failed');
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Validation failed');
    }
  };

  const handlePublish = async () => {
    try {
      await publishMutation.mutateAsync(editText);
      toast.success('Schema published');
      setEditMode(false);
      setValidationResult(null);
      refetch();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Publish failed');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs">
            Version: {schema?.version || '-'}
          </Badge>
        </div>
        <div className="flex gap-2">
          {!editMode ? (
            <Button size="sm" variant="outline" onClick={() => {
              setEditText(schema?.text || '');
              setEditMode(true);
            }}>
              <Code2 className="h-3.5 w-3.5 mr-1" /> Edit Schema
            </Button>
          ) : (
            <>
              <Button size="sm" variant="outline" onClick={handleValidate}
                disabled={!editText || validateMutation.isPending}>
                Validate
              </Button>
              <Button size="sm" onClick={handlePublish}
                disabled={!editText || publishMutation.isPending}>
                Publish
              </Button>
            </>
          )}
        </div>
      </div>

      {validationResult && (
        <div className={`p-3 rounded text-xs ${validationResult.valid ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
          {validationResult.valid ? '✅ Schema is valid' : `❌ ${validationResult.error}`}
        </div>
      )}

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <Skeleton className="h-64 m-4" />
          ) : editMode ? (
            <Textarea
              className="font-mono text-xs min-h-[400px] border-0 rounded-none"
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
            />
          ) : (
            <pre className="p-4 text-xs font-mono overflow-auto max-h-[600px]">
              {schema?.text || 'No schema loaded'}
            </pre>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Relationships Tab ───────────────────────────────────────────────────

function RelationshipsTab() {
  const [filter, setFilter] = useState({ resourceType: '', resourceId: '', relation: '', subjectType: '', subjectId: '' });
  const { data, isLoading, refetch } = useIamAuthzRelationships(filter);
  const writeMutation = useIamAuthzWriteRelationships();
  const deleteMutation = useIamAuthzDeleteRelationships();
  const [showWrite, setShowWrite] = useState(false);
  const [writeForm, setWriteForm] = useState({ resourceType: '', resourceId: '', relation: '', subjectType: '', subjectId: '' });

  const relationships = data?.relationships || [];

  const handleWrite = async () => {
    try {
      await writeMutation.mutateAsync([{
        resource: { type: writeForm.resourceType, id: writeForm.resourceId },
        relation: writeForm.relation,
        subject: { type: writeForm.subjectType, id: writeForm.subjectId },
      }]);
      toast.success('Relationship written');
      setShowWrite(false);
      setWriteForm({ resourceType: '', resourceId: '', relation: '', subjectType: '', subjectId: '' });
      refetch();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Write failed');
    }
  };

  const handleDelete = async (rel: IamRelationship) => {
    try {
      await deleteMutation.mutateAsync({
        resourceType: rel.resource.type,
        resourceId: rel.resource.id,
        relation: rel.relation,
        subjectType: rel.subject.type,
        subjectId: rel.subject.id,
      });
      toast.success('Relationship deleted');
      refetch();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Delete failed');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Input className="h-7 w-28 text-xs" placeholder="Res type" value={filter.resourceType}
            onChange={(e) => setFilter({ ...filter, resourceType: e.target.value })} />
          <Input className="h-7 w-28 text-xs" placeholder="Res ID" value={filter.resourceId}
            onChange={(e) => setFilter({ ...filter, resourceId: e.target.value })} />
          <Input className="h-7 w-20 text-xs" placeholder="Relation" value={filter.relation}
            onChange={(e) => setFilter({ ...filter, relation: e.target.value })} />
          <Input className="h-7 w-20 text-xs" placeholder="Sub type" value={filter.subjectType}
            onChange={(e) => setFilter({ ...filter, subjectType: e.target.value })} />
          <Input className="h-7 w-28 text-xs" placeholder="Sub ID" value={filter.subjectId}
            onChange={(e) => setFilter({ ...filter, subjectId: e.target.value })} />
          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => refetch()}>
            <Search className="h-3 w-3 mr-1" /> Search
          </Button>
        </div>
        <Button size="sm" className="h-8" onClick={() => setShowWrite(true)}>
          <Plus className="h-3.5 w-3.5 mr-1" /> Write
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <Skeleton className="h-48 m-4" />
          ) : relationships.length === 0 ? (
            <div className="text-xs text-muted-foreground text-center py-8">No relationships found</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Resource Type</TableHead>
                  <TableHead className="text-xs">Resource ID</TableHead>
                  <TableHead className="text-xs">Relation</TableHead>
                  <TableHead className="text-xs">Subject Type</TableHead>
                  <TableHead className="text-xs">Subject ID</TableHead>
                  <TableHead className="text-xs">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {relationships.map((rel, i) => (
                  <TableRow key={i}>
                    <TableCell className="text-xs font-mono">{rel.resource.type}</TableCell>
                    <TableCell className="text-xs font-mono">{rel.resource.id}</TableCell>
                    <TableCell className="text-xs">{rel.relation}</TableCell>
                    <TableCell className="text-xs">{rel.subject.type}</TableCell>
                    <TableCell className="text-xs font-mono">{rel.subject.id}</TableCell>
                    <TableCell className="text-xs">
                      <Button variant="ghost" size="icon" className="h-6 w-6"
                        onClick={() => handleDelete(rel)}>
                        <Trash2 className="h-3 w-3 text-red-500" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Write Relationship Dialog */}
      <Dialog open={showWrite} onOpenChange={setShowWrite}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Write Relationship</DialogTitle>
            <DialogDescription>Create a new SpiceDB relationship tuple</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium">Resource Type *</label>
                <Input className="h-8 text-xs" placeholder="zone" value={writeForm.resourceType}
                  onChange={(e) => setWriteForm({ ...writeForm, resourceType: e.target.value })} />
              </div>
              <div>
                <label className="text-xs font-medium">Resource ID *</label>
                <Input className="h-8 text-xs" placeholder="aisphere" value={writeForm.resourceId}
                  onChange={(e) => setWriteForm({ ...writeForm, resourceId: e.target.value })} />
              </div>
            </div>
            <div>
              <label className="text-xs font-medium">Relation *</label>
              <Input className="h-8 text-xs" placeholder="member" value={writeForm.relation}
                onChange={(e) => setWriteForm({ ...writeForm, relation: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium">Subject Type *</label>
                <Input className="h-8 text-xs" placeholder="user" value={writeForm.subjectType}
                  onChange={(e) => setWriteForm({ ...writeForm, subjectType: e.target.value })} />
              </div>
              <div>
                <label className="text-xs font-medium">Subject ID *</label>
                <Input className="h-8 text-xs" placeholder="admin" value={writeForm.subjectId}
                  onChange={(e) => setWriteForm({ ...writeForm, subjectId: e.target.value })} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setShowWrite(false)}>Cancel</Button>
            <Button size="sm" onClick={handleWrite}
              disabled={!writeForm.resourceType || !writeForm.resourceId || !writeForm.relation || !writeForm.subjectType || !writeForm.subjectId || writeMutation.isPending}>
              {writeMutation.isPending ? 'Writing...' : 'Write'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Permissions Tab ─────────────────────────────────────────────────────

function PermissionsTab() {
  const checkMutation = useIamAuthzCheckPermission();
  const explainMutation = useIamAuthzExplainPermission();
  const [form, setForm] = useState({ subjectType: 'user', subjectId: '', resourceType: '', resourceId: '', permission: '' });
  const [result, setResult] = useState<{ allowed: boolean; reason?: string; steps?: string[] } | null>(null);

  const handleCheck = async () => {
    try {
      const req: IamCheckPermissionRequest = {
        subject: { type: form.subjectType, id: form.subjectId },
        resource: { type: form.resourceType, id: form.resourceId },
        permission: form.permission,
      };
      const res = await checkMutation.mutateAsync(req);
      setResult({ allowed: res.allowed, reason: res.reason });
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Check failed');
    }
  };

  const handleExplain = async () => {
    try {
      const req = {
        subject: { type: form.subjectType, id: form.subjectId },
        resource: { type: form.resourceType, id: form.resourceId },
        permission: form.permission,
      };
      const res = await explainMutation.mutateAsync(req);
      setResult(res);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Explain failed');
    }
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Check Permission</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium">Subject Type</label>
              <Select value={form.subjectType} onValueChange={(v) => setForm({ ...form, subjectType: v })}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">User</SelectItem>
                  <SelectItem value="group">Group</SelectItem>
                  <SelectItem value="service">Service</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium">Subject ID *</label>
              <Input className="h-8 text-xs" placeholder="admin" value={form.subjectId}
                onChange={(e) => setForm({ ...form, subjectId: e.target.value })} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium">Resource Type *</label>
              <Input className="h-8 text-xs" placeholder="zone" value={form.resourceType}
                onChange={(e) => setForm({ ...form, resourceType: e.target.value })} />
            </div>
            <div>
              <label className="text-xs font-medium">Resource ID *</label>
              <Input className="h-8 text-xs" placeholder="aisphere" value={form.resourceId}
                onChange={(e) => setForm({ ...form, resourceId: e.target.value })} />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium">Permission *</label>
            <Input className="h-8 text-xs" placeholder="view_zone" value={form.permission}
              onChange={(e) => setForm({ ...form, permission: e.target.value })} />
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={handleCheck}
              disabled={!form.subjectId || !form.resourceType || !form.resourceId || !form.permission || checkMutation.isPending}>
              Check
            </Button>
            <Button size="sm" variant="outline" onClick={handleExplain}
              disabled={!form.subjectId || !form.resourceType || !form.resourceId || !form.permission || explainMutation.isPending}>
              Explain
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Result</CardTitle>
        </CardHeader>
        <CardContent>
          {result ? (
            <div className="space-y-3">
              <div className={`p-3 rounded text-xs font-medium ${
                result.allowed ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
              }`}>
                {result.allowed ? '✅ ALLOWED' : '❌ DENIED'}
              </div>
              {result.reason && (
                <div className="text-xs text-muted-foreground">
                  <span className="font-medium">Reason:</span> {result.reason}
                </div>
              )}
              {result.steps && result.steps.length > 0 && (
                <div className="space-y-1">
                  <span className="text-xs font-medium">Explanation steps:</span>
                  {result.steps.map((step, i) => (
                    <div key={i} className="text-xs font-mono bg-muted p-2 rounded">{step}</div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="text-xs text-muted-foreground text-center py-8">
              Submit a permission check to see results
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
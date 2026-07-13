'use client';

import { useState } from 'react';
import {
  Users, Building2, FolderKanban, KeyRound, ShieldCheck, Database,
  Plus, Trash2, Save, Pencil, X, Check, Search, RefreshCw, GroupIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
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
  useIamUsers,
  useIamSaveUser,
  useIamDeleteUser,
  useIamOrganizations,
  useIamCreateOrganization,
  useIamProjects,
  useIamCreateProject,
  useIamCapabilities,
  useIamProjectCapabilities,
  useIamResourceTypes,
  useIamResources,
  useIamRoleTemplates,
  useIamGrants,
  useIamGrantAccess,
  useIamRevokeAccess,
  useIamDirectoryGroups,
  useIamCreateGroup,
  useIamUpdateGroup,
  useIamDeleteGroup,
  useIamAssignUserToGroup,
  useIamRemoveUserFromGroup,
} from '@/hooks/use-iam';
import { useT } from '@/lib/i18n';
import { toast } from 'sonner';
import type { LocalUser, IamCpOrganization, IamProject, IamGrant, IamSubjectRef, IamResourceRef, IamGroup } from '@/lib/api/types';

// ─── Tab Configuration ─────────────────────────────────────────────────

type IamTab = 'local-users' | 'organizations' | 'projects' | 'grants' | 'resources' | 'groups';

const IAM_TABS: { key: IamTab; label: string; icon: React.ReactNode }[] = [
  { key: 'local-users', label: 'Local Users', icon: <Users className="h-4 w-4" /> },
  { key: 'groups', label: 'Groups', icon: <GroupIcon className="h-4 w-4" /> },
  { key: 'organizations', label: 'Organizations', icon: <Building2 className="h-4 w-4" /> },
  { key: 'projects', label: 'Projects', icon: <FolderKanban className="h-4 w-4" /> },
  { key: 'grants', label: 'Grants & Roles', icon: <ShieldCheck className="h-4 w-4" /> },
  { key: 'resources', label: 'Resources', icon: <KeyRound className="h-4 w-4" /> },
];

// ─── Main IAM Page ─────────────────────────────────────────────────────

export function IamPage() {
  const [activeTab, setActiveTab] = useState<IamTab>('local-users');

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">IAM Management</h1>
          <p className="text-sm text-muted-foreground">
            Identity, directory, and access control management
          </p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as IamTab)}>
        <TabsList className="w-full justify-start overflow-x-auto">
          {IAM_TABS.map((tab) => (
            <TabsTrigger key={tab.key} value={tab.key} className="gap-2">
              {tab.icon}
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="local-users" className="mt-4">
          <LocalUsersTab />
        </TabsContent>
        <TabsContent value="groups" className="mt-4">
          <GroupsTab />
        </TabsContent>
        <TabsContent value="organizations" className="mt-4">
          <OrganizationsTab />
        </TabsContent>
        <TabsContent value="projects" className="mt-4">
          <ProjectsTab />
        </TabsContent>
        <TabsContent value="grants" className="mt-4">
          <GrantsTab />
        </TabsContent>
        <TabsContent value="resources" className="mt-4">
          <ResourcesTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ─── Local Users Tab ───────────────────────────────────────────────────

function LocalUsersTab() {
  const [form, setForm] = useState<LocalUser & { password?: string }>({
    username: '', password: '', subjectType: 'human', roles: ['agent'], permissions: ['skill:read'], namespaces: ['public'],
  });
  const [editing, setEditing] = useState(false);

  const { data: items = [], isLoading, refetch } = useIamUsers();
  const saveMutation = useIamSaveUser();
  const deleteMutation = useIamDeleteUser();

  const handleSave = async () => {
    try {
      await saveMutation.mutateAsync(form);
      toast.success(editing ? 'User updated' : 'User created');
      setForm({ username: '', password: '', subjectType: 'human', roles: ['agent'], permissions: ['skill:read'], namespaces: ['public'] });
      setEditing(false);
      refetch();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Save failed');
    }
  };

  const handleDelete = async (username: string) => {
    try {
      await deleteMutation.mutateAsync(username);
      toast.success('User deleted');
      refetch();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Delete failed');
    }
  };

  const handleEdit = (u: LocalUser) => {
    setForm({ ...u, password: '' });
    setEditing(true);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <div className="lg:col-span-2">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center justify-between">
              Local Users
              <Badge variant="secondary">{items.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Username</TableHead>
                  <TableHead className="text-xs">Subject ID</TableHead>
                  <TableHead className="text-xs">Type</TableHead>
                  <TableHead className="text-xs">Roles</TableHead>
                  <TableHead className="text-xs">Status</TableHead>
                  <TableHead className="text-xs w-20">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? Array.from({ length: 3 }).map((_, i) => (
                  <TableRow key={i}><TableCell colSpan={6}><Skeleton className="h-4 w-full" /></TableCell></TableRow>
                )) : items.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center text-xs text-muted-foreground py-6">No local users</TableCell></TableRow>
                ) : items.map((u) => (
                  <TableRow key={u.username}>
                    <TableCell className="font-medium text-xs">{u.username}</TableCell>
                    <TableCell className="text-xs font-mono">{u.subjectId || '-'}</TableCell>
                    <TableCell><Badge variant="outline" className="text-[10px]">{u.subjectType}</Badge></TableCell>
                    <TableCell><div className="flex flex-wrap gap-1">{(u.roles || []).map((r) => <Badge key={r} variant="secondary" className="text-[10px]">{r}</Badge>)}</div></TableCell>
                    <TableCell>{u.disabled ? <Badge variant="destructive" className="text-[10px]">Disabled</Badge> : <Badge variant="default" className="text-[10px] bg-green-500">Active</Badge>}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => handleEdit(u)}><Pencil className="h-3 w-3" /></Button>
                        <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-destructive" onClick={() => handleDelete(u.username)}><Trash2 className="h-3 w-3" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <Card className="h-fit sticky top-4">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">{editing ? 'Edit User' : 'Create User'}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1.5">
            <label className="text-xs font-medium">Username</label>
            <Input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} className="h-8 text-xs" />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium">Password</label>
            <Input type="password" value={form.password || ''} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder={editing ? 'Leave blank to keep' : 'Enter password'} className="h-8 text-xs" />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium">Subject ID</label>
            <Input value={form.subjectId || ''} onChange={(e) => setForm({ ...form, subjectId: e.target.value })} placeholder="agent:xxx" className="h-8 text-xs" />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium">Type</label>
            <Select value={form.subjectType || 'human'} onValueChange={(v) => setForm({ ...form, subjectType: v })}>
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="human">Human</SelectItem>
                <SelectItem value="agent">Agent</SelectItem>
                <SelectItem value="service">Service</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium">Roles (comma separated)</label>
            <Input value={(form.roles || []).join(',')} onChange={(e) => setForm({ ...form, roles: e.target.value.split(',').map(x => x.trim()).filter(Boolean) })} className="h-8 text-xs" />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium">Permissions (one per line)</label>
            <Textarea value={(form.permissions || []).join('\n')} onChange={(e) => setForm({ ...form, permissions: e.target.value.split('\n').map(x => x.trim()).filter(Boolean) })} rows={3} className="text-xs" />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium">Namespaces (comma separated)</label>
            <Input value={(form.namespaces || []).join(',')} onChange={(e) => setForm({ ...form, namespaces: e.target.value.split(',').map(x => x.trim()).filter(Boolean) })} className="h-8 text-xs" />
          </div>
          <div className="flex gap-2">
            {editing && (
              <Button variant="outline" size="sm" className="flex-1" onClick={() => { setEditing(false); setForm({ username: '', password: '', subjectType: 'human', roles: ['agent'], permissions: ['skill:read'], namespaces: ['public'] }); }}>
                <X className="h-3 w-3 mr-1" /> Cancel
              </Button>
            )}
            <Button size="sm" className="flex-1 bg-gradient-to-r from-violet-600 to-fuchsia-500" onClick={handleSave} disabled={saveMutation.isPending}>
              <Save className="h-3 w-3 mr-1" /> {editing ? 'Update' : 'Save'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Organizations Tab ─────────────────────────────────────────────────

function OrganizationsTab() {
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ slug: '', displayName: '', casdoorOrg: '' });

  const { data, isLoading, refetch } = useIamOrganizations();
  const createMutation = useIamCreateOrganization();
  const organizations = data?.organizations || [];

  const handleCreate = async () => {
    if (!form.slug) { toast.error('Slug is required'); return; }
    try {
      await createMutation.mutateAsync(form);
      toast.success('Organization created');
      setForm({ slug: '', displayName: '', casdoorOrg: '' });
      setShowCreate(false);
      refetch();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Create failed');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Input placeholder="Search organizations..." className="h-8 w-64 text-xs" />
        </div>
        <Button size="sm" className="h-8" onClick={() => setShowCreate(true)}>
          <Plus className="h-3.5 w-3.5 mr-1" /> Create Organization
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Slug</TableHead>
                <TableHead className="text-xs">Display Name</TableHead>
                <TableHead className="text-xs">Status</TableHead>
                <TableHead className="text-xs">Casdoor Org</TableHead>
                <TableHead className="text-xs">Plan</TableHead>
                <TableHead className="text-xs">Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? Array.from({ length: 3 }).map((_, i) => (
                <TableRow key={i}><TableCell colSpan={6}><Skeleton className="h-4 w-full" /></TableCell></TableRow>
              )) : organizations.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center text-xs text-muted-foreground py-6">No organizations</TableCell></TableRow>
              ) : organizations.map((org) => (
                <TableRow key={org.id}>
                  <TableCell className="font-medium text-xs">{org.slug}</TableCell>
                  <TableCell className="text-xs">{org.displayName || '-'}</TableCell>
                  <TableCell><Badge variant={org.status === 'ACTIVE' ? 'default' : 'secondary'} className="text-[10px]">{org.status}</Badge></TableCell>
                  <TableCell className="text-xs font-mono">{org.casdoorOrg || '-'}</TableCell>
                  <TableCell className="text-xs">{org.plan || '-'}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{org.createdAt ? new Date(org.createdAt).toLocaleDateString() : '-'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Organization</DialogTitle>
            <DialogDescription>Create a new organization in the IAM control plane</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium">Slug *</label>
              <Input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} placeholder="my-org" className="h-8 text-xs" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium">Display Name</label>
              <Input value={form.displayName} onChange={(e) => setForm({ ...form, displayName: e.target.value })} placeholder="My Organization" className="h-8 text-xs" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium">Casdoor Org</label>
              <Input value={form.casdoorOrg} onChange={(e) => setForm({ ...form, casdoorOrg: e.target.value })} placeholder="casdoor-org-id" className="h-8 text-xs" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button size="sm" onClick={handleCreate} disabled={createMutation.isPending}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Projects Tab ──────────────────────────────────────────────────────

function ProjectsTab() {
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ orgId: '', slug: '', displayName: '', description: '' });

  const { data, isLoading, refetch } = useIamProjects();
  const { data: orgsData } = useIamOrganizations();
  const createMutation = useIamCreateProject();
  const projects = data?.projects || [];
  const organizations = orgsData?.organizations || [];

  const handleCreate = async () => {
    if (!form.slug || !form.orgId) { toast.error('Slug and Org are required'); return; }
    try {
      await createMutation.mutateAsync({ orgId: form.orgId, slug: form.slug, displayName: form.displayName, description: form.description });
      toast.success('Project created');
      setForm({ orgId: '', slug: '', displayName: '', description: '' });
      setShowCreate(false);
      refetch();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Create failed');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Search className="h-3.5 w-3.5 text-muted-foreground" />
          <Input placeholder="Search projects..." className="h-8 w-64 text-xs" />
        </div>
        <Button size="sm" className="h-8" onClick={() => setShowCreate(true)}>
          <Plus className="h-3.5 w-3.5 mr-1" /> Create Project
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Slug</TableHead>
                <TableHead className="text-xs">Display Name</TableHead>
                <TableHead className="text-xs">Org</TableHead>
                <TableHead className="text-xs">Status</TableHead>
                <TableHead className="text-xs">Visibility</TableHead>
                <TableHead className="text-xs">Resources</TableHead>
                <TableHead className="text-xs">Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? Array.from({ length: 3 }).map((_, i) => (
                <TableRow key={i}><TableCell colSpan={7}><Skeleton className="h-4 w-full" /></TableCell></TableRow>
              )) : projects.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center text-xs text-muted-foreground py-6">No projects found</TableCell></TableRow>
              ) : projects.map((proj) => (
                <TableRow key={proj.id}>
                  <TableCell className="font-medium text-xs">{proj.slug}</TableCell>
                  <TableCell className="text-xs">{proj.displayName || '-'}</TableCell>
                  <TableCell className="text-xs font-mono">{proj.orgId?.slice(0, 12)}...</TableCell>
                  <TableCell><Badge variant={proj.status === 'ACTIVE' ? 'default' : 'secondary'} className="text-[10px]">{proj.status}</Badge></TableCell>
                  <TableCell className="text-xs">{proj.visibility}</TableCell>
                  <TableCell className="text-xs">{proj.stats?.countResources ?? '-'}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{proj.createdAt ? new Date(proj.createdAt).toLocaleDateString() : '-'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Project</DialogTitle>
            <DialogDescription>Create a new project under an organization</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium">Organization *</label>
              <Select value={form.orgId} onValueChange={(v) => setForm({ ...form, orgId: v })}>
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select org" /></SelectTrigger>
                <SelectContent>
                  {organizations.map((org) => (
                    <SelectItem key={org.id} value={org.id}>{org.slug}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium">Slug *</label>
              <Input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} placeholder="my-project" className="h-8 text-xs" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium">Display Name</label>
              <Input value={form.displayName} onChange={(e) => setForm({ ...form, displayName: e.target.value })} placeholder="My Project" className="h-8 text-xs" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium">Description</label>
              <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} className="text-xs" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button size="sm" onClick={handleCreate} disabled={createMutation.isPending}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Grants & Roles Tab ────────────────────────────────────────────────

function GrantsTab() {
  const [showGrant, setShowGrant] = useState(false);
  const [grantForm, setGrantForm] = useState({
    resourceType: '', resourceId: '',
    subjectType: 'user', subjectId: '',
    roleKey: 'viewer', relation: 'viewer',
    reason: '',
  });

  const { data: rolesData, isLoading: rolesLoading } = useIamRoleTemplates();
  const { data: grantsData, isLoading: grantsLoading, refetch: refetchGrants } = useIamGrants();
  const grantMutation = useIamGrantAccess();
  const revokeMutation = useIamRevokeAccess();

  const roleTemplates = rolesData?.roleTemplates || [];
  const grants = grantsData?.grants || [];

  const handleGrant = async () => {
    if (!grantForm.resourceType || !grantForm.resourceId || !grantForm.subjectId) {
      toast.error('Resource and Subject are required');
      return;
    }
    try {
      await grantMutation.mutateAsync({
        resource: { type: grantForm.resourceType, id: grantForm.resourceId },
        roleKey: grantForm.roleKey,
        relation: grantForm.relation || grantForm.roleKey,
        subject: { type: grantForm.subjectId.includes(':') ? grantForm.subjectId.split(':')[0] : grantForm.subjectType, id: grantForm.subjectId.includes(':') ? grantForm.subjectId.split(':').slice(1).join(':') : grantForm.subjectId },
        reason: grantForm.reason,
      });
      toast.success('Access granted');
      setGrantForm({ resourceType: '', resourceId: '', roleKey: 'viewer', relation: 'viewer', subjectType: 'user', subjectId: '', reason: '' });
      setShowGrant(false);
      refetchGrants();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Grant failed');
    }
  };

  const handleRevoke = async (grantId: string) => {
    try {
      await revokeMutation.mutateAsync(grantId);
      toast.success('Access revoked');
      refetchGrants();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Revoke failed');
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <div className="lg:col-span-2 space-y-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center justify-between">
              <span>Role Templates</span>
              <Badge variant="secondary">{roleTemplates.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Role Key</TableHead>
                  <TableHead className="text-xs">Display Name</TableHead>
                  <TableHead className="text-xs">Resource Type</TableHead>
                  <TableHead className="text-xs">Relation</TableHead>
                  <TableHead className="text-xs">Built-in</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rolesLoading ? (
                  <TableRow><TableCell colSpan={5}><Skeleton className="h-4 w-full" /></TableCell></TableRow>
                ) : roleTemplates.length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="text-center text-xs text-muted-foreground py-6">No role templates</TableCell></TableRow>
                ) : roleTemplates.map((rt) => (
                  <TableRow key={rt.id}>
                    <TableCell className="font-medium text-xs">{rt.roleKey}</TableCell>
                    <TableCell className="text-xs">{rt.displayName || '-'}</TableCell>
                    <TableCell className="text-xs font-mono">{rt.resourceType || '-'}</TableCell>
                    <TableCell className="text-xs">{rt.relation || '-'}</TableCell>
                    <TableCell>{rt.builtIn ? <Badge className="text-[10px] bg-green-500">Yes</Badge> : <Badge variant="secondary" className="text-[10px]">No</Badge>}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center justify-between">
              <span>Active Grants</span>
              <Badge variant="secondary">{grants.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Resource</TableHead>
                  <TableHead className="text-xs">Subject</TableHead>
                  <TableHead className="text-xs">Role</TableHead>
                  <TableHead className="text-xs">Created By</TableHead>
                  <TableHead className="text-xs">Created</TableHead>
                  <TableHead className="text-xs w-16">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {grantsLoading ? (
                  <TableRow><TableCell colSpan={6}><Skeleton className="h-4 w-full" /></TableCell></TableRow>
                ) : grants.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center text-xs text-muted-foreground py-6">No grants found</TableCell></TableRow>
                ) : grants.map((g) => (
                  <TableRow key={g.id}>
                    <TableCell className="text-xs font-mono">{g.resource ? `${g.resource.type}:${g.resource.id}` : '-'}</TableCell>
                    <TableCell className="text-xs font-mono">{g.subject ? `${g.subject.type}:${g.subject.id}` : '-'}</TableCell>
                    <TableCell><Badge variant="outline" className="text-[10px]">{g.roleKey || g.relation || '-'}</Badge></TableCell>
                    <TableCell className="text-xs">{g.createdBy || '-'}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{g.createdAt ? new Date(g.createdAt).toLocaleDateString() : '-'}</TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive" onClick={() => handleRevoke(g.id)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        <Card className="h-fit sticky top-4">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Grant Access</CardTitle>
            <CardDescription className="text-[10px]">Assign a role to a subject on a resource</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium">Resource Type</label>
              <Input value={grantForm.resourceType} onChange={(e) => setGrantForm({ ...grantForm, resourceType: e.target.value })} placeholder="e.g. skill" className="h-8 text-xs" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium">Resource ID</label>
              <Input value={grantForm.resourceId} onChange={(e) => setGrantForm({ ...grantForm, resourceId: e.target.value })} placeholder="resource-id" className="h-8 text-xs" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium">Subject Type</label>
              <Select value={grantForm.subjectType} onValueChange={(v) => setGrantForm({ ...grantForm, subjectType: v })}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">User</SelectItem>
                  <SelectItem value="group">Group</SelectItem>
                  <SelectItem value="org">Organization</SelectItem>
                  <SelectItem value="agent">Agent</SelectItem>
                  <SelectItem value="service">Service</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium">Subject ID</label>
              <Input value={grantForm.subjectId} onChange={(e) => setGrantForm({ ...grantForm, subjectId: e.target.value })} placeholder="user-id" className="h-8 text-xs" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium">Role</label>
              <Select value={grantForm.roleKey} onValueChange={(v) => setGrantForm({ ...grantForm, roleKey: v, relation: v })}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="viewer">Viewer</SelectItem>
                  <SelectItem value="consumer">Consumer</SelectItem>
                  <SelectItem value="editor">Editor</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="owner">Owner</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium">Reason (optional)</label>
              <Input value={grantForm.reason} onChange={(e) => setGrantForm({ ...grantForm, reason: e.target.value })} placeholder="Why this grant?" className="h-8 text-xs" />
            </div>
            <Button size="sm" className="w-full" onClick={handleGrant} disabled={grantMutation.isPending}>
              <ShieldCheck className="h-3 w-3 mr-1" /> Grant Access
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ─── Resources Tab ─────────────────────────────────────────────────────

function ResourcesTab() {
  const [filterType, setFilterType] = useState('');

  const { data: typesData, isLoading: typesLoading } = useIamResourceTypes();
  const { data: resourcesData, isLoading: resourcesLoading, refetch: refetchResources } = useIamResources(filterType ? { resourceType: filterType } : {});

  const resourceTypes = typesData?.resourceTypes || [];
  const resources = resourcesData?.resources || [];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <div className="lg:col-span-2 space-y-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center justify-between">
              <span>Resource Types</span>
              <Badge variant="secondary">{resourceTypes.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Type</TableHead>
                  <TableHead className="text-xs">Display Name</TableHead>
                  <TableHead className="text-xs">SpiceDB Type</TableHead>
                  <TableHead className="text-xs">Grantable</TableHead>
                  <TableHead className="text-xs">Relations</TableHead>
                  <TableHead className="text-xs">Permissions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {typesLoading ? (
                  <TableRow><TableCell colSpan={6}><Skeleton className="h-4 w-full" /></TableCell></TableRow>
                ) : resourceTypes.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center text-xs text-muted-foreground py-6">No resource types registered</TableCell></TableRow>
                ) : resourceTypes.map((rt) => (
                  <TableRow key={rt.type}>
                    <TableCell className="font-medium text-xs font-mono">{rt.type}</TableCell>
                    <TableCell className="text-xs">{rt.displayName || '-'}</TableCell>
                    <TableCell className="text-xs font-mono">{rt.spicedbType || '-'}</TableCell>
                    <TableCell>{rt.grantable ? <Badge className="text-[10px] bg-green-500">Yes</Badge> : <Badge variant="secondary" className="text-[10px]">No</Badge>}</TableCell>
                    <TableCell className="text-xs">{(rt.relations || []).length}</TableCell>
                    <TableCell className="text-xs">{(rt.permissions || []).length}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center justify-between">
              <span>Resources</span>
              <div className="flex items-center gap-2">
                <Select value={filterType} onValueChange={setFilterType}>
                  <SelectTrigger className="h-7 text-xs w-36"><SelectValue placeholder="All types" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All types</SelectItem>
                    {resourceTypes.map((rt) => (
                      <SelectItem key={rt.type} value={rt.type}>{rt.type}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => refetchResources()}>
                  <RefreshCw className="h-3 w-3" />
                </Button>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Type</TableHead>
                  <TableHead className="text-xs">ID</TableHead>
                  <TableHead className="text-xs">Display Name</TableHead>
                  <TableHead className="text-xs">Status</TableHead>
                  <TableHead className="text-xs">Project</TableHead>
                  <TableHead className="text-xs">Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {resourcesLoading ? (
                  <TableRow><TableCell colSpan={6}><Skeleton className="h-4 w-full" /></TableCell></TableRow>
                ) : resources.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center text-xs text-muted-foreground py-6">No resources found</TableCell></TableRow>
                ) : resources.map((r, i) => (
                  <TableRow key={r.ref?.id || i}>
                    <TableCell><Badge variant="outline" className="text-[10px] font-mono">{r.ref?.type || '-'}</Badge></TableCell>
                    <TableCell className="text-xs font-mono">{r.ref?.id || '-'}</TableCell>
                    <TableCell className="text-xs">{r.displayName || '-'}</TableCell>
                    <TableCell><Badge variant={r.status === 'ACTIVE' ? 'default' : 'secondary'} className="text-[10px]">{r.status || '-'}</Badge></TableCell>
                    <TableCell className="text-xs font-mono">{r.projectId ? r.projectId.slice(0, 12) + '...' : '-'}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{r.createdAt ? new Date(r.createdAt).toLocaleDateString() : '-'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <Card className="h-fit sticky top-4">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Resource Details</CardTitle>
          <CardDescription className="text-[10px]">Select a resource to view details</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-xs text-muted-foreground text-center py-8">
            Click on a resource row to view its details, bindings, and grants
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Groups Tab ──────────────────────────────────────────────────────────

export function GroupsTab() {
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({ name: '', displayName: '', type: 'folder', parentId: '' });
  const [selectedGroup, setSelectedGroup] = useState<IamGroup | null>(null);
  const [showMembers, setShowMembers] = useState(false);
  const [memberUserId, setMemberUserId] = useState('');
  const [showUpdate, setShowUpdate] = useState(false);
  const [updateForm, setUpdateForm] = useState({ displayName: '', type: 'folder' });

  const orgId = 'aisphere';
  const { data: groupsData, isLoading, refetch } = useIamDirectoryGroups(orgId);
  const createMutation = useIamCreateGroup();
  const updateMutation = useIamUpdateGroup();
  const deleteMutation = useIamDeleteGroup();
  const assignMutation = useIamAssignUserToGroup();
  const removeMutation = useIamRemoveUserFromGroup();

  const items = groupsData?.groups || [];
  const filtered = items.filter((g) =>
    g.name?.toLowerCase().includes(search.toLowerCase()) ||
    g.displayName?.toLowerCase().includes(search.toLowerCase())
  );

  const handleCreate = async () => {
    try {
      await createMutation.mutateAsync({
        orgId,
        group: {
          name: createForm.name,
          displayName: createForm.displayName,
          type: createForm.type,
          parentId: createForm.parentId || undefined,
        },
      });
      toast.success('Group created');
      setShowCreate(false);
      setCreateForm({ name: '', displayName: '', type: 'folder', parentId: '' });
      refetch();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Create failed');
    }
  };

  const handleDelete = async (groupId: string) => {
    try {
      await deleteMutation.mutateAsync({ orgId, groupId });
      toast.success('Group deleted');
      refetch();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Delete failed');
    }
  };

  const handleUpdate = async () => {
    if (!selectedGroup) return;
    try {
      await updateMutation.mutateAsync({
        orgId,
        groupId: selectedGroup.id,
        group: { displayName: updateForm.displayName, type: updateForm.type },
      });
      toast.success('Group updated');
      setShowUpdate(false);
      refetch();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Update failed');
    }
  };

  const handleAssignMember = async () => {
    if (!selectedGroup || !memberUserId) return;
    try {
      await assignMutation.mutateAsync({ orgId, groupId: selectedGroup.id, userId: memberUserId });
      toast.success('User assigned');
      setMemberUserId('');
      refetch();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Assign failed');
    }
  };

  const handleRemoveMember = async (userId: string) => {
    if (!selectedGroup) return;
    try {
      await removeMutation.mutateAsync({ orgId, groupId: selectedGroup.id, userId });
      toast.success('Member removed');
      refetch();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Remove failed');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Search className="h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search groups..."
            className="h-8 w-64 text-xs"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Button size="sm" className="h-8" onClick={() => setShowCreate(true)}>
          <Plus className="h-3.5 w-3.5 mr-1" /> Create Group
        </Button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <Card className="xl:col-span-2">
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-4 space-y-3">
                {[1,2,3].map((i) => (
                  <Skeleton key={i} className="h-8 w-full" />
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-xs text-muted-foreground text-center py-8">
                {search ? 'No groups match your search' : 'No groups found'}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Name</TableHead>
                    <TableHead className="text-xs">Display Name</TableHead>
                    <TableHead className="text-xs">Type</TableHead>
                    <TableHead className="text-xs">Members</TableHead>
                    <TableHead className="text-xs">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((group) => (
                    <TableRow
                      key={group.id}
                      className="cursor-pointer"
                      onClick={() => { setSelectedGroup(group); setShowMembers(true); }}
                    >
                      <TableCell className="text-xs font-mono">{group.name}</TableCell>
                      <TableCell className="text-xs">{group.displayName}</TableCell>
                      <TableCell className="text-xs">
                        <Badge variant="outline" className="text-[10px]">{group.type || 'folder'}</Badge>
                      </TableCell>
                      <TableCell className="text-xs">{group.users?.length || 0}</TableCell>
                      <TableCell className="text-xs">
                        <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                          <Button variant="ghost" size="icon" className="h-6 w-6"
                            onClick={() => {
                              setSelectedGroup(group);
                              setUpdateForm({ displayName: group.displayName || '', type: group.type || 'folder' });
                              setShowUpdate(true);
                            }}>
                            <Pencil className="h-3 w-3" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-6 w-6"
                            onClick={() => handleDelete(group.id)}>
                            <Trash2 className="h-3 w-3 text-red-500" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Member management panel */}
        {showMembers && selectedGroup && (
          <Card className="h-fit sticky top-4">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm">{selectedGroup.displayName} Members</CardTitle>
                <Button variant="ghost" size="icon" className="h-6 w-6"
                  onClick={() => { setShowMembers(false); setSelectedGroup(null); }}>
                  <X className="h-3 w-3" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {/* Add member */}
              <div className="flex gap-2">
                <Input
                  placeholder="User ID..."
                  className="h-7 text-xs"
                  value={memberUserId}
                  onChange={(e) => setMemberUserId(e.target.value)}
                />
                <Button size="sm" className="h-7 text-xs" onClick={handleAssignMember}
                  disabled={!memberUserId || assignMutation.isPending}>
                  Add
                </Button>
              </div>

              {/* Member list */}
              <div className="space-y-1">
                {(!selectedGroup.users || selectedGroup.users.length === 0) ? (
                  <p className="text-xs text-muted-foreground text-center py-4">No members</p>
                ) : (
                  selectedGroup.users.map((userId) => (
                    <div key={userId} className="flex items-center justify-between py-1 px-2 rounded bg-muted/50">
                      <span className="text-xs font-mono">{userId}</span>
                      <Button variant="ghost" size="icon" className="h-5 w-5"
                        onClick={() => handleRemoveMember(userId)}>
                        <X className="h-2.5 w-2.5 text-red-500" />
                      </Button>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Create Group Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create Group</DialogTitle>
            <DialogDescription>Create a new group in the organization</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium">Name *</label>
              <Input
                className="h-8 text-xs"
                placeholder="my-group"
                value={createForm.name}
                onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
              />
              <p className="text-[10px] text-muted-foreground mt-0.5">Lowercase letters, numbers, and hyphens</p>
            </div>
            <div>
              <label className="text-xs font-medium">Display Name *</label>
              <Input
                className="h-8 text-xs"
                placeholder="My Group"
                value={createForm.displayName}
                onChange={(e) => setCreateForm({ ...createForm, displayName: e.target.value })}
              />
            </div>
            <div>
              <label className="text-xs font-medium">Type</label>
              <Select value={createForm.type} onValueChange={(v) => setCreateForm({ ...createForm, type: v })}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="folder">Folder</SelectItem>
                  <SelectItem value="group">Group</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button size="sm" onClick={handleCreate}
              disabled={!createForm.name || !createForm.displayName || createMutation.isPending}>
              {createMutation.isPending ? 'Creating...' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Update Group Dialog */}
      <Dialog open={showUpdate} onOpenChange={setShowUpdate}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Update Group</DialogTitle>
            <DialogDescription>Edit group settings</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium">Display Name *</label>
              <Input
                className="h-8 text-xs"
                value={updateForm.displayName}
                onChange={(e) => setUpdateForm({ ...updateForm, displayName: e.target.value })}
              />
            </div>
            <div>
              <label className="text-xs font-medium">Type</label>
              <Select value={updateForm.type} onValueChange={(v) => setUpdateForm({ ...updateForm, type: v })}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="folder">Folder</SelectItem>
                  <SelectItem value="group">Group</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setShowUpdate(false)}>Cancel</Button>
            <Button size="sm" onClick={handleUpdate}
              disabled={!updateForm.displayName || updateMutation.isPending}>
              {updateMutation.isPending ? 'Saving...' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
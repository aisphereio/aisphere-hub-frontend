'use client';

import { useState, useMemo, useCallback } from 'react';
import {
  ChevronRight, ChevronDown, Folder, FolderOpen,
  FileText, FileCode, FileJson, FileCog, FileImage, File, FileType2,
  Plus, Trash2, Pencil, FolderPlus, FilePlus, Check, X,
} from 'lucide-react';
import { cn, fmtSize, type TreeNode } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ConfirmDialog } from '@/components/shared';
import { useT } from '@/lib/i18n';

// File icon mapping by extension
function getFileIcon(name: string) {
  const lower = name.toLowerCase();
  if (lower.endsWith('.md') || lower.endsWith('.markdown')) return <FileText className="h-3.5 w-3.5 text-sky-500" />;
  if (lower.endsWith('.json')) return <FileJson className="h-3.5 w-3.5 text-amber-500" />;
  if (lower.endsWith('.yaml') || lower.endsWith('.yml')) return <FileJson className="h-3.5 w-3.5 text-orange-500" />;
  if (lower.endsWith('.py')) return <FileCode className="h-3.5 w-3.5 text-blue-500" />;
  if (lower.endsWith('.js') || lower.endsWith('.jsx') || lower.endsWith('.mjs') || lower.endsWith('.cjs')) return <FileCode className="h-3.5 w-3.5 text-yellow-500" />;
  if (lower.endsWith('.ts') || lower.endsWith('.tsx')) return <FileCode className="h-3.5 w-3.5 text-blue-600" />;
  if (lower.endsWith('.go')) return <FileCode className="h-3.5 w-3.5 text-cyan-500" />;
  if (lower.endsWith('.sh') || lower.endsWith('.bash')) return <FileCog className="h-3.5 w-3.5 text-emerald-500" />;
  if (lower.endsWith('.env') || lower.endsWith('.conf') || lower.endsWith('.toml') || lower.endsWith('.ini')) return <FileCog className="h-3.5 w-3.5 text-violet-500" />;
  if (lower.endsWith('.png') || lower.endsWith('.jpg') || lower.endsWith('.jpeg') || lower.endsWith('.gif') || lower.endsWith('.svg') || lower.endsWith('.webp')) return <FileImage className="h-3.5 w-3.5 text-fuchsia-500" />;
  if (lower.endsWith('.txt') || lower.endsWith('.log')) return <FileType2 className="h-3.5 w-3.5 text-muted-foreground" />;
  if (lower === 'skill.md' || lower === 'readme.md') return <FileText className="h-3.5 w-3.5 text-violet-500" />;
  return <File className="h-3.5 w-3.5 text-muted-foreground" />;
}

interface FileTreeProps {
  nodes: TreeNode[];
  selectedPath?: string;
  onOpenFile: (path: string) => void;
  /** Initially-expanded top-level folders */
  defaultExpanded?: string[];
  /** Compact mode (smaller padding) */
  compact?: boolean;
  /** When true, file/folder CRUD actions are shown. */
  editable?: boolean;
  /** Create a new file at the given path. */
  onCreateFile?: (parentDir: string, name: string, type: 'file' | 'dir') => Promise<void> | void;
  /** Delete a file or directory. */
  onDeleteNode?: (path: string) => Promise<void> | void;
  /** Rename / move a file or directory. */
  onRenameNode?: (oldPath: string, newPath: string) => Promise<void> | void;
}

interface TreeRowProps {
  node: TreeNode;
  depth: number;
  selectedPath?: string;
  expanded: Set<string>;
  toggle: (path: string) => void;
  onOpenFile: (path: string) => void;
  compact?: boolean;
  editable?: boolean;
  onCreateFile?: (parentDir: string, name: string, type: 'file' | 'dir') => Promise<void> | void;
  onDeleteNode?: (path: string) => Promise<void> | void;
  onRenameNode?: (oldPath: string, newPath: string) => Promise<void> | void;
}

function joinPath(parent: string, name: string): string {
  return parent ? `${parent}/${name}` : name;
}

function dirOf(path: string): string {
  const idx = path.lastIndexOf('/');
  return idx < 0 ? '' : path.slice(0, idx);
}

function basenameOf(path: string): string {
  const idx = path.lastIndexOf('/');
  return idx < 0 ? path : path.slice(idx + 1);
}

function TreeRow({
  node,
  depth,
  selectedPath,
  expanded,
  toggle,
  onOpenFile,
  compact,
  editable,
  onCreateFile,
  onDeleteNode,
  onRenameNode,
}: TreeRowProps) {
  const t = useT();
  const isDir = node.type === 'dir';
  const isExpanded = expanded.has(node.path);
  const isSelected = selectedPath === node.path;
  const pad = compact ? 8 : 10;

  const [creating, setCreating] = useState<null | 'file' | 'dir'>(null);
  const [newName, setNewName] = useState('');
  const [renaming, setRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(node.name);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  const handleCreateSubmit = async () => {
    const trimmed = newName.trim();
    if (!trimmed || !onCreateFile) return;
    const parentDir = isDir ? node.path : dirOf(node.path);
    try {
      await onCreateFile(parentDir, trimmed, creating === 'dir' ? 'dir' : 'file');
      setCreating(null);
      setNewName('');
      if (isDir && !isExpanded) toggle(node.path);
    } catch {
      /* error handled by caller via toast */
    }
  };

  const handleRenameSubmit = async () => {
    const trimmed = renameValue.trim();
    if (!trimmed || trimmed === node.name || !onRenameNode) {
      setRenaming(false);
      return;
    }
    const newPath = joinPath(dirOf(node.path), trimmed);
    try {
      await onRenameNode(node.path, newPath);
      setRenaming(false);
    } catch {
      /* error handled by caller */
    }
  };

  if (isDir) {
    return (
      <div>
        <div
          className={cn(
            'group flex items-center w-full text-left rounded-sm transition-colors relative',
            compact ? 'py-0.5' : 'py-[3px]',
            'hover:bg-accent/70 text-foreground/80 hover:text-foreground',
          )}
          style={{ paddingLeft: depth * pad + 4, paddingRight: 6 }}
        >
          <button
            onClick={() => toggle(node.path)}
            className="flex items-center gap-1 flex-1 min-w-0"
          >
            <span className="flex items-center justify-center w-3 h-3 shrink-0 text-muted-foreground">
              {isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
            </span>
            <span className="shrink-0 text-muted-foreground group-hover:text-foreground">
              {isExpanded ? <FolderOpen className="h-3.5 w-3.5 text-violet-500" /> : <Folder className="h-3.5 w-3.5 text-violet-500/80" />}
            </span>
            <span className="truncate text-xs font-medium">{node.name}</span>
            {node.children.length > 0 && (
              <span className="ml-auto text-[10px] text-muted-foreground/70 tabular-nums">{node.children.length}</span>
            )}
          </button>

          {editable && (
            <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
              <Button
                variant="ghost"
                size="icon"
                className="h-5 w-5"
                title={t('editor.newFile')}
                onClick={(e) => { e.stopPropagation(); setCreating('file'); if (!isExpanded) toggle(node.path); }}
              >
                <FilePlus className="h-3 w-3" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-5 w-5"
                title={t('editor.newFolder')}
                onClick={(e) => { e.stopPropagation(); setCreating('dir'); if (!isExpanded) toggle(node.path); }}
              >
                <FolderPlus className="h-3 w-3" />
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-5 w-5" onClick={(e) => e.stopPropagation()}>
                    <Plus className="h-3 w-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-40">
                  <DropdownMenuItem onClick={() => { setCreating('file'); if (!isExpanded) toggle(node.path); }}>
                    <FilePlus className="h-3 w-3 mr-2" /> {t('editor.newFile')}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => { setCreating('dir'); if (!isExpanded) toggle(node.path); }}>
                    <FolderPlus className="h-3 w-3 mr-2" /> {t('editor.newFolder')}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => setRenaming(true)}>
                    <Pencil className="h-3 w-3 mr-2" /> {t('editor.rename')}
                  </DropdownMenuItem>
                  <DropdownMenuItem className="text-destructive" onClick={() => setDeleteConfirmOpen(true)}>
                    <Trash2 className="h-3 w-3 mr-2" /> {t('editor.delete')}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}
        </div>

        {/* Inline create input */}
        {creating && (
          <div className="flex items-center gap-1 py-0.5" style={{ paddingLeft: (depth + 1) * pad + 4 }}>
            {creating === 'dir' ? (
              <Folder className="h-3.5 w-3.5 text-violet-500/80 shrink-0" />
            ) : (
              <File className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            )}
            <Input
              autoFocus
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onBlur={handleCreateSubmit}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCreateSubmit();
                if (e.key === 'Escape') { setCreating(null); setNewName(''); }
              }}
              placeholder={creating === 'dir' ? t('editor.folderName') : t('editor.fileName')}
              className="h-6 text-xs flex-1"
            />
          </div>
        )}

        {/* Inline rename input */}
        {renaming && (
          <div className="flex items-center gap-1 py-0.5" style={{ paddingLeft: depth * pad + 4 + 16 }}>
            {isDir ? (
              <Folder className="h-3.5 w-3.5 text-violet-500/80 shrink-0" />
            ) : (
              <File className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            )}
            <Input
              autoFocus
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onBlur={handleRenameSubmit}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleRenameSubmit();
                if (e.key === 'Escape') { setRenaming(false); setRenameValue(node.name); }
              }}
              className="h-6 text-xs flex-1"
            />
          </div>
        )}

        {isExpanded && node.children.length > 0 && !renaming && (
          <div>
            {node.children.map((child) => (
              <TreeRow
                key={child.path}
                node={child}
                depth={depth + 1}
                selectedPath={selectedPath}
                expanded={expanded}
                toggle={toggle}
                onOpenFile={onOpenFile}
                compact={compact}
                editable={editable}
                onCreateFile={onCreateFile}
                onDeleteNode={onDeleteNode}
                onRenameNode={onRenameNode}
              />
            ))}
          </div>
        )}

        <ConfirmDialog
          open={deleteConfirmOpen}
          onOpenChange={setDeleteConfirmOpen}
          title={t('editor.delete')}
          description={t('editor.confirmDelete', { name: node.path })}
          confirmLabel={t('editor.delete')}
          variant="destructive"
          onConfirm={async () => {
            if (onDeleteNode) await onDeleteNode(node.path);
            setDeleteConfirmOpen(false);
          }}
        />
      </div>
    );
  }

  return (
    <div
      className={cn(
        'group flex items-center w-full text-left rounded-sm transition-colors relative',
        compact ? 'py-0.5' : 'py-[3px]',
        isSelected
          ? 'bg-violet-600/10 text-violet-700 dark:text-violet-300'
          : 'text-foreground/75 hover:bg-accent/70 hover:text-foreground',
      )}
      style={{ paddingLeft: depth * pad + 4 + 16, paddingRight: 6 }}
    >
      {isSelected && (
        <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[2px] h-4 rounded-full bg-violet-500" />
      )}
      {renaming ? (
        <>
          <span className="shrink-0">{getFileIcon(node.name)}</span>
          <Input
            autoFocus
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onBlur={handleRenameSubmit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleRenameSubmit();
              if (e.key === 'Escape') { setRenaming(false); setRenameValue(node.name); }
            }}
            className="h-6 text-xs flex-1 ml-1"
          />
        </>
      ) : (
        <button
          onClick={() => onOpenFile(node.path)}
          className="flex items-center gap-1 flex-1 min-w-0"
          title={node.path}
        >
          <span className="shrink-0">{getFileIcon(node.name)}</span>
          <span className="truncate text-xs">{node.name}</span>
          {node.size !== undefined && node.size > 0 && (
            <span className="ml-auto text-[10px] text-muted-foreground/70 tabular-nums">{fmtSize(node.size)}</span>
          )}
        </button>
      )}

      {editable && !renaming && (
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
          <Button
            variant="ghost"
            size="icon"
            className="h-5 w-5"
            title={t('editor.rename')}
            onClick={(e) => { e.stopPropagation(); setRenaming(true); setRenameValue(node.name); }}
          >
            <Pencil className="h-3 w-3" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-5 w-5 text-destructive"
            title={t('editor.delete')}
            onClick={(e) => { e.stopPropagation(); setDeleteConfirmOpen(true); }}
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      )}

      <ConfirmDialog
        open={deleteConfirmOpen}
        onOpenChange={setDeleteConfirmOpen}
        title={t('editor.delete')}
        description={t('editor.confirmDelete', { name: node.path })}
        confirmLabel={t('editor.delete')}
        variant="destructive"
        onConfirm={async () => {
          if (onDeleteNode) await onDeleteNode(node.path);
          setDeleteConfirmOpen(false);
        }}
      />
    </div>
  );
}

export function FileTree({
  nodes,
  selectedPath,
  onOpenFile,
  defaultExpanded = [],
  compact = false,
  editable = false,
  onCreateFile,
  onDeleteNode,
  onRenameNode,
}: FileTreeProps) {
  const t = useT();
  const [rootCreating, setRootCreating] = useState<null | 'file' | 'dir'>(null);
  const [rootName, setRootName] = useState('');
  const [rootSubmitting, setRootSubmitting] = useState(false);
  // Compute initial expanded set: defaultExpanded + all folder paths with selected descendant
  const initialExpanded = useMemo(() => {
    const set = new Set<string>(defaultExpanded);
    if (selectedPath) {
      // Walk up the path, expanding every ancestor folder
      const parts = selectedPath.split('/').filter(Boolean);
      let acc = '';
      for (let i = 0; i < parts.length - 1; i++) {
        acc = acc ? `${acc}/${parts[i]}` : parts[i];
        set.add(acc);
      }
    }
    return set;
  }, [defaultExpanded, selectedPath]);

  const [expanded, setExpanded] = useState<Set<string>>(initialExpanded);

  // Re-sync when selectedPath changes (so opening a file from outside expands its parents)
  const lastSyncedRef = useMemo(() => selectedPath, [selectedPath]);
  if (selectedPath && selectedPath === lastSyncedRef) {
    const parts = selectedPath.split('/').filter(Boolean);
    let acc = '';
    for (let i = 0; i < parts.length - 1; i++) {
      acc = acc ? `${acc}/${parts[i]}` : parts[i];
      if (!expanded.has(acc)) {
        const next = new Set(expanded);
        next.add(acc);
        setExpanded(next);
      }
    }
  }

  const toggle = useCallback((path: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }, []);

  const submitRootCreate = async () => {
    const trimmed = rootName.trim();
    if (!trimmed || !rootCreating || !onCreateFile || rootSubmitting) return;
    setRootSubmitting(true);
    try {
      await onCreateFile('', trimmed, rootCreating);
      setRootCreating(null);
      setRootName('');
    } catch {
      /* error handled by caller */
    } finally {
      setRootSubmitting(false);
    }
  };

  const cancelRootCreate = () => {
    if (rootSubmitting) return;
    setRootCreating(null);
    setRootName('');
  };

  const rootCreateControls = editable && onCreateFile && (
    <div className="px-1 py-1">
      {rootCreating ? (
        <div className="flex items-center gap-1 rounded-md border border-border bg-background px-1.5 py-1 shadow-sm">
          {rootCreating === 'dir' ? (
            <Folder className="h-3.5 w-3.5 text-violet-500/80 shrink-0" />
          ) : (
            <File className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          )}
          <Input
            autoFocus
            disabled={rootSubmitting}
            value={rootName}
            onChange={(e) => setRootName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') submitRootCreate();
              if (e.key === 'Escape') cancelRootCreate();
            }}
            placeholder={rootCreating === 'dir' ? t('editor.folderName') : t('editor.fileName')}
            className="h-7 text-xs flex-1"
          />
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="h-7 w-7 text-emerald-600"
            disabled={!rootName.trim() || rootSubmitting}
            onClick={submitRootCreate}
            title={t('common.confirm')}
          >
            <Check className="h-3.5 w-3.5" />
          </Button>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="h-7 w-7"
            disabled={rootSubmitting}
            onClick={cancelRootCreate}
            title={t('common.cancel')}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      ) : (
        <div className="flex items-center gap-1">
          <Button
            size="sm"
            variant="ghost"
            className="h-6 px-2 text-[11px] gap-1"
            onClick={() => setRootCreating('file')}
          >
            <FilePlus className="h-3 w-3" /> {t('editor.newFile')}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-6 px-2 text-[11px] gap-1"
            onClick={() => setRootCreating('dir')}
          >
            <FolderPlus className="h-3 w-3" /> {t('editor.newFolder')}
          </Button>
        </div>
      )}
    </div>
  );

  if (nodes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-center px-4 gap-2">
        <Folder className="h-8 w-8 text-muted-foreground/50 mb-1" />
        <p className="text-xs text-muted-foreground">No files in this version</p>
        <div className="w-full max-w-[220px]">{rootCreateControls}</div>
      </div>
    );
  }

  return (
    <div className="py-1">
      {rootCreateControls}
      {nodes.map((n) => (
        <TreeRow
          key={n.path}
          node={n}
          depth={0}
          selectedPath={selectedPath}
          expanded={expanded}
          toggle={toggle}
          onOpenFile={onOpenFile}
          compact={compact}
          editable={editable}
          onCreateFile={onCreateFile}
          onDeleteNode={onDeleteNode}
          onRenameNode={onRenameNode}
        />
      ))}
    </div>
  );
}

// ─── Breadcrumbs for the currently-open file ─────────────────────────
interface FileBreadcrumbsProps {
  path: string;
  onNavigate?: (path: string) => void;
}

export function FileBreadcrumbs({ path, onNavigate }: FileBreadcrumbsProps) {
  const parts = path.split('/').filter(Boolean);
  return (
    <nav className="flex items-center gap-0.5 text-xs text-muted-foreground min-w-0">
      {parts.map((part, i) => {
        const isLast = i === parts.length - 1;
        const sub = parts.slice(0, i + 1).join('/');
        return (
          <span key={sub} className="flex items-center gap-0.5 min-w-0">
            {i > 0 && <span className="text-muted-foreground/50">/</span>}
            <button
              onClick={() => !isLast && onNavigate?.(sub)}
              disabled={isLast}
              className={cn(
                'truncate max-w-[160px] px-1 py-0.5 rounded transition-colors',
                isLast
                  ? 'text-foreground font-medium'
                  : 'hover:bg-accent hover:text-foreground',
              )}
              title={sub}
            >
              {part}
            </button>
          </span>
        );
      })}
    </nav>
  );
}

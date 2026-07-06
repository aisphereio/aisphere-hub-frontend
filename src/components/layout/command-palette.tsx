'use client';

import { useEffect, useState } from 'react';
import {
  Cpu, Layers, Bot, Hammer, Boxes, Shield, ClipboardCheck, Activity,
  FileText, Users, BookOpen, CircleDot, Search, ArrowRight, type LucideIcon,
} from 'lucide-react';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command';
import { useT } from '@/lib/i18n';
import type { Tab } from '@/lib/api/types';

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onNavigate: (tab: Tab) => void;
}

interface NavItem {
  key: Tab;
  labelKey: string;
  hintKey: string;
  icon: LucideIcon;
  group: string;
}

const NAV_ITEMS: NavItem[] = [
  { key: 'skills', labelKey: 'nav.skills', hintKey: 'nav.skills.hint', icon: Cpu, group: 'nav.registry' },
  { key: 'skillsets', labelKey: 'nav.skillsets', hintKey: 'nav.skillsets.hint', icon: Layers, group: 'nav.registry' },
  { key: 'agents', labelKey: 'nav.agents', hintKey: 'nav.agents.hint', icon: Bot, group: 'nav.registry' },
  { key: 'tools', labelKey: 'nav.tools', hintKey: 'nav.tools.hint', icon: Hammer, group: 'nav.registry' },
  { key: 'model-profiles', labelKey: 'nav.modelProfiles', hintKey: 'nav.modelProfiles.hint', icon: CircleDot, group: 'nav.registry' },
  { key: 'sandbox-profiles', labelKey: 'nav.sandboxProfiles', hintKey: 'nav.sandboxProfiles.hint', icon: Boxes, group: 'nav.registry' },
  { key: 'sandboxes', labelKey: 'nav.sandboxes', hintKey: 'nav.sandboxes.hint', icon: Boxes, group: 'nav.registry' },
  { key: 'proposals', labelKey: 'nav.proposals', hintKey: 'nav.proposals.hint', icon: FileText, group: 'nav.governance' },
  { key: 'governance', labelKey: 'nav.governance', hintKey: 'nav.governance.hint', icon: ClipboardCheck, group: 'nav.governance' },
  { key: 'access', labelKey: 'nav.access', hintKey: 'nav.access.hint', icon: Shield, group: 'nav.access' },
  { key: 'iam', labelKey: 'nav.iam', hintKey: 'nav.iam.hint', icon: Users, group: 'nav.access' },
  { key: 'ops', labelKey: 'nav.ops', hintKey: 'nav.ops.hint', icon: Activity, group: 'nav.operations' },
  { key: 'docs', labelKey: 'nav.docs', hintKey: 'nav.docs.hint', icon: BookOpen, group: 'nav.operations' },
];

export function CommandPalette({ open, onOpenChange, onNavigate }: CommandPaletteProps) {
  const t = useT();

  // Group items by their group key
  const grouped = NAV_ITEMS.reduce<Record<string, NavItem[]>>((acc, item) => {
    (acc[item.group] ||= []).push(item);
    return acc;
  }, {});

  const handleSelect = (tab: Tab) => {
    onNavigate(tab);
    onOpenChange(false);
  };

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder={t('topbar.search') + '…'} />
      <CommandList>
        <CommandEmpty>{t('common.none')}</CommandEmpty>
        {Object.entries(grouped).map(([groupKey, items], idx) => (
          <div key={groupKey}>
            {idx > 0 && <CommandSeparator />}
            <CommandGroup heading={t(groupKey)}>
              {items.map((item) => {
                const Icon = item.icon;
                return (
                  <CommandItem
                    key={item.key}
                    value={`${item.key} ${t(item.labelKey)} ${t(item.hintKey)}`}
                    onSelect={() => handleSelect(item.key)}
                    className="gap-2"
                  >
                    <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <span className="text-sm">{t(item.labelKey)}</span>
                    <span className="text-[10px] text-muted-foreground truncate">
                      {t(item.hintKey)}
                    </span>
                    <ArrowRight className="h-3 w-3 ml-auto text-muted-foreground/50 shrink-0" />
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </div>
        ))}
      </CommandList>
    </CommandDialog>
  );
}

/** Hook that registers a global ⌘K / Ctrl+K keyboard shortcut to toggle the palette. */
export function useCommandPaletteShortcut(onToggle: () => void) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        onToggle();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onToggle]);
}

/** Standalone hook that manages open state + shortcut. */
export function useCommandPalette() {
  const [open, setOpen] = useState(false);
  useCommandPaletteShortcut(() => setOpen((o) => !o));
  return { open, setOpen };
}

import { BookOpen, FileText, Folder, LayoutList, ScrollText, type LucideIcon } from 'lucide-react';

export type ContainerKind = 'Feature' | 'Specification' | 'Container' | 'Standard';

export function isContainerKind(kind: string): kind is ContainerKind {
  return kind === 'Feature' || kind === 'Specification' || kind === 'Container' || kind === 'Standard';
}

export function isNativeTestKind(kind: string): boolean {
  return kind === 'Test';
}

interface KindPresentation {
  label: string;
  plural: string;
  icon: LucideIcon;
  navIcon: LucideIcon;
  childrenLabel?: string;
}

const presentations: Record<string, KindPresentation> = {
  Group: { label: 'Folder', plural: 'Folders', icon: Folder, navIcon: Folder },
  Feature: { label: 'Feature', plural: 'Features', icon: BookOpen, navIcon: FileText, childrenLabel: 'Scenarios' },
  Specification: { label: 'Specification', plural: 'Specifications', icon: ScrollText, navIcon: FileText, childrenLabel: 'Rules' },
  Container: { label: 'Container', plural: 'Containers', icon: LayoutList, navIcon: Folder, childrenLabel: 'Tests' },
  Standard: { label: 'Standard test container', plural: 'Standard test containers', icon: LayoutList, navIcon: Folder, childrenLabel: 'Tests' },
  Test: { label: 'Test', plural: 'Tests', icon: FileText, navIcon: FileText },
};

export function getKindPresentation(kind: string): KindPresentation {
  return Object.prototype.hasOwnProperty.call(presentations, kind)
    ? presentations[kind]!
    : { label: kind, plural: `${kind}s`, icon: FileText, navIcon: FileText };
}

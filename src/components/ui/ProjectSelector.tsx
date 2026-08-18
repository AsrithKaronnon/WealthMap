import React from 'react';
import { tracksExpenses } from '../../lib/projects';

interface ProjectSelectorProps {
  projects: any[];
  value: string;
  onChange: (value: string) => void;
  /** Show an "All projects" option (empty string). */
  includeAll?: boolean;
  /** Show a "regular / none" option. */
  noneLabel?: string;
  /** Only list active + paused (hide completed). */
  activeOnly?: boolean;
  /** Hide projects that stay inside Projects only. */
  trackedOnly?: boolean;
  className?: string;
  id?: string;
}

export const ProjectSelector: React.FC<ProjectSelectorProps> = ({
  projects,
  value,
  onChange,
  includeAll = false,
  noneLabel = 'None (regular expense)',
  activeOnly = false,
  trackedOnly = false,
  className = '',
  id,
}) => {
  const list = (projects || []).filter((p) => {
    if (activeOnly && p.status === 'completed') return false;
    if (trackedOnly && !tracksExpenses(p)) return false;
    return true;
  });

  return (
    <select
      id={id}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`w-full px-3 py-2 rounded-lg border border-border bg-background text-xs focus:outline-none focus:ring-2 focus:ring-primary/40 ${className}`}
    >
      {includeAll && <option value="">All projects</option>}
      {noneLabel && <option value={includeAll ? 'regular' : ''}>{noneLabel}</option>}
      {list.map((p) => (
        <option key={p.id} value={p.id}>
          {p.emoji || '📁'} {p.name}
        </option>
      ))}
    </select>
  );
};

import React from 'react';
import { useNavigate } from '@tanstack/react-router';
import { projectColor } from '../../lib/projects';

interface ProjectBadgeProps {
  project?: { id: string; name?: string; emoji?: string; color?: string } | null;
}

export const ProjectBadge: React.FC<ProjectBadgeProps> = ({ project }) => {
  const navigate = useNavigate();
  if (!project?.id) return null;
  const tone = projectColor(project.color);

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        navigate({ to: '/projects/$projectId', params: { projectId: project.id } });
      }}
      className={`mt-1 inline-flex items-center gap-1 max-w-full px-1.5 py-0.5 rounded-full text-[10px] font-semibold leading-none ${tone.bg} ${tone.text} cursor-pointer`}
    >
      <span className="shrink-0">{project.emoji || '📁'}</span>
      <span className="truncate">{project.name || 'Project'}</span>
    </button>
  );
};

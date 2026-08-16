import React from 'react';
import { MobileProfileButton } from './MobileProfileButton';

interface MobilePageHeaderProps {
  title: string;
  children?: React.ReactNode;
  /** Hide the top-right profile avatar (e.g. already on Settings). Default false. */
  hideProfile?: boolean;
}

/** Sticky in-page header for mobile only. Uses a span so global h1 rules do not inflate it. */
export const MobilePageHeader: React.FC<MobilePageHeaderProps> = ({ title, children, hideProfile = false }) => {
  return (
    <div className="md:hidden sticky top-0 z-30 -mx-3 px-3 h-12 flex items-center gap-2 bg-background/90 backdrop-blur-md border-b border-border/40">
      {!hideProfile && <MobileProfileButton className="!h-10 !w-10 text-[12px]" />}
      <span className="min-w-0 flex-1 text-[17px] font-semibold tracking-tight text-foreground truncate leading-none">
        {title}
      </span>
      {children ? (
        <div className="flex items-center gap-1 shrink-0">{children}</div>
      ) : null}
    </div>
  );
};

export const mobileHeaderIconBtn =
  'flex items-center justify-center h-10 w-10 rounded-full text-muted-foreground cursor-pointer active:scale-95';

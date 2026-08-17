import React from 'react';

/** Soft drifting color wash — parent should be relative. */
export function SprayFlow() {
  return (
    <div className="spray-flow" aria-hidden>
      <div className="spray-flow-wash" />
      <div className="spray-flow-wave" />
    </div>
  );
}

/** Header background + spray that continues upward so pull-to-refresh has no seam. */
export function HeaderWash() {
  return (
    <div className="pointer-events-none absolute inset-x-0 -top-48 bottom-0" aria-hidden>
      <div className="absolute inset-0 bg-background" />
      <SprayFlow />
    </div>
  );
}

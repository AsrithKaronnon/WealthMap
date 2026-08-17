import { useEffect } from 'react';

export const APP_REFRESH_EVENT = 'wealthmap:refresh';

type RefreshDetail = {
  register: (p: Promise<unknown>) => void;
};

/** Ask the current screen to reload data. Resolves when listeners finish. */
export function dispatchAppRefresh(): Promise<void> {
  const pending: Promise<unknown>[] = [];
  const event = new CustomEvent<RefreshDetail>(APP_REFRESH_EVENT, {
    detail: {
      register: (p) => pending.push(Promise.resolve(p)),
    },
  });
  window.dispatchEvent(event);
  if (pending.length === 0) {
    return new Promise((r) => setTimeout(r, 400));
  }
  return Promise.allSettled(pending).then(() => undefined);
}

/** Subscribe the current page to pull-to-refresh. */
export function useAppRefresh(handler: () => Promise<unknown> | void) {
  useEffect(() => {
    const onRefresh = (e: Event) => {
      const detail = (e as CustomEvent<RefreshDetail>).detail;
      const result = handler();
      if (result && detail?.register) detail.register(result);
    };
    window.addEventListener(APP_REFRESH_EVENT, onRefresh);
    return () => window.removeEventListener(APP_REFRESH_EVENT, onRefresh);
  }, [handler]);
}

export type ToastPayload = {
  type?: 'success' | 'info' | 'warning' | 'error';
  title?: string;
  message: string;
  actionLabel?: string;
  actionHref?: string;
};

export function dispatchToast(payload: ToastPayload) {
  try {
    const evt = new CustomEvent('ursus:toast', { detail: payload });
    window.dispatchEvent(evt);
  } catch {}
}


import React from 'react';

export interface ToastMessage {
  id: string;
  title?: string;
  message: string;
  type?: 'success' | 'info' | 'warning' | 'error';
  actionLabel?: string;
  actionHref?: string;
}

interface ToastProps {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}

const typeStyles: Record<NonNullable<ToastMessage['type']>, string> = {
  success: 'bg-green-500/15 border-green-500/30 text-green-300',
  info: 'bg-blue-500/15 border-blue-500/30 text-blue-300',
  warning: 'bg-yellow-500/15 border-yellow-500/30 text-yellow-300',
  error: 'bg-red-500/15 border-red-500/30 text-red-300',
};

export const Toast: React.FC<ToastProps> = ({ toasts, onDismiss }) => {
  return (
    <div className="fixed top-4 right-4 z-50 space-y-3">
      {toasts.map(t => (
        <div
          key={t.id}
          className={`min-w-[260px] max-w-sm border rounded-lg p-3 shadow-lg ${typeStyles[t.type || 'info']}`}
        >
          {t.title && <div className="font-semibold mb-1">{t.title}</div>}
          <div className="text-sm">{t.message}</div>
          <div className="mt-2 flex items-center gap-3">
            {t.actionHref && t.actionLabel && (
              <a href={t.actionHref} className="text-xs underline opacity-90 hover:opacity-100" onClick={() => onDismiss(t.id)}>
                {t.actionLabel}
              </a>
            )}
            <button
              onClick={() => onDismiss(t.id)}
              className="text-xs underline opacity-70 hover:opacity-100"
            >
              Dismiss
            </button>
          </div>
        </div>
      ))}
    </div>
  );
};

export default Toast;


'use client';

import { useEffect, useState } from 'react';

interface ToastProps {
  message: string;
  type?: 'success' | 'error' | 'info';
  onDismiss?: () => void;
  undoAction?: () => void;
  duration?: number;
}

export function Toast({ message, type = 'info', onDismiss, undoAction, duration = 5000 }: ToastProps) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(false);
      onDismiss?.();
    }, duration);
    return () => clearTimeout(timer);
  }, [duration, onDismiss]);

  if (!visible) return null;

  const colours = {
    success: 'bg-green-800 text-white',
    error: 'bg-red-800 text-white',
    info: 'bg-gray-900 text-white',
  };

  return (
    <div className={`flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg ${colours[type]} min-w-[260px]`}>
      <span className="text-sm flex-1">{message}</span>
      {undoAction && (
        <button
          onClick={() => { undoAction(); setVisible(false); onDismiss?.(); }}
          className="text-sm font-semibold underline underline-offset-2 shrink-0"
        >
          Undo
        </button>
      )}
      <button
        onClick={() => { setVisible(false); onDismiss?.(); }}
        className="shrink-0 opacity-70 hover:opacity-100"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}

// Toast container (place at bottom of screen)
interface ToastItem {
  id: string;
  message: string;
  type?: 'success' | 'error' | 'info';
  undoAction?: () => void;
}

let toastListeners: ((toasts: ToastItem[]) => void)[] = [];
let toasts: ToastItem[] = [];

function notify(listeners: typeof toastListeners, newToasts: ToastItem[]) {
  toasts = newToasts;
  listeners.forEach((l) => l([...newToasts]));
}

export function showToast(message: string, options?: { type?: ToastItem['type']; undoAction?: () => void }) {
  const id = Math.random().toString(36).slice(2);
  const item: ToastItem = { id, message, ...options };
  notify(toastListeners, [...toasts, item]);
}

export function ToastContainer() {
  const [items, setItems] = useState<ToastItem[]>([]);

  useEffect(() => {
    toastListeners.push(setItems);
    return () => {
      toastListeners = toastListeners.filter((l) => l !== setItems);
    };
  }, []);

  return (
    <div className="fixed bottom-24 md:bottom-6 left-1/2 -translate-x-1/2 z-50 flex flex-col gap-2 items-center pointer-events-none">
      {items.map((item) => (
        <div key={item.id} className="pointer-events-auto">
          <Toast
            message={item.message}
            type={item.type}
            undoAction={item.undoAction}
            onDismiss={() => notify(toastListeners, toasts.filter((t) => t.id !== item.id))}
          />
        </div>
      ))}
    </div>
  );
}

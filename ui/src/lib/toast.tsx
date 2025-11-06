/**
 * Toast Notification System
 * Material UI Snackbar-based notifications
 */

import { create } from 'zustand';
import { Snackbar, Alert, AlertColor } from '@mui/material';

// ============================================================================
// Toast Store
// ============================================================================

interface Toast {
  id: string;
  message: string;
  severity: AlertColor;
  duration?: number;
}

interface ToastState {
  toasts: Toast[];
  addToast: (message: string, severity?: AlertColor, duration?: number) => void;
  removeToast: (id: string) => void;
}

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  
  addToast: (message, severity = 'info', duration = 5000) => {
    const id = `toast-${Date.now()}-${Math.random()}`;
    set((state) => ({
      toasts: [...state.toasts, { id, message, severity, duration }],
    }));
  },
  
  removeToast: (id) => {
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    }));
  },
}));

// ============================================================================
// Toast Helper Functions
// ============================================================================

export const toast = {
  success: (message: string, duration?: number) => {
    useToastStore.getState().addToast(message, 'success', duration);
  },
  
  error: (message: string, duration?: number) => {
    useToastStore.getState().addToast(message, 'error', duration);
  },
  
  warning: (message: string, duration?: number) => {
    useToastStore.getState().addToast(message, 'warning', duration);
  },
  
  info: (message: string, duration?: number) => {
    useToastStore.getState().addToast(message, 'info', duration);
  },
};

// ============================================================================
// Toast Container Component
// ============================================================================

export function ToastContainer() {
  const toasts = useToastStore((state) => state.toasts);
  const removeToast = useToastStore((state) => state.removeToast);

  return (
    <>
      {toasts.map((toast, index) => (
        <Snackbar
          key={toast.id}
          open={true}
          autoHideDuration={toast.duration}
          onClose={() => removeToast(toast.id)}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
          sx={{
            bottom: `${(index * 70) + 24}px !important`, // Stack toasts
          }}
        >
          <Alert
            onClose={() => removeToast(toast.id)}
            severity={toast.severity}
            variant="filled"
            sx={{
              minWidth: 300,
              backdropFilter: 'blur(20px)',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)',
            }}
          >
            {toast.message}
          </Alert>
        </Snackbar>
      ))}
    </>
  );
}

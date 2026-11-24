import React from 'react';
import { AlertDialog } from 'radix-ui';
import { X } from 'lucide-react';
import { Button } from './Button';

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
  isDestructive?: boolean;
}

export function ConfirmModal({
  isOpen,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  onConfirm,
  onCancel,
  isDestructive = false,
}: ConfirmModalProps) {
  return (
    <AlertDialog.Root open={isOpen} onOpenChange={(open) => { if (!open) onCancel(); }}>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="fixed inset-0 z-[110] bg-black/45 backdrop-blur-md" />
        <AlertDialog.Content className="liquid-glass-strong fixed left-1/2 top-1/2 z-[111] w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-3xl outline-none">
          <div className="flex items-center justify-between border-b border-content/10 px-6 py-4">
            <AlertDialog.Title className="text-lg font-bold text-content">
              {title}
            </AlertDialog.Title>
            <button
              type="button"
              onClick={onCancel}
              aria-label="Close"
              className="liquid-btn-glass flex h-10 w-10 items-center justify-center rounded-full text-muted hover:text-content transition-colors cursor-pointer"
            >
              <X size={16} />
            </button>
          </div>
          <div className="px-6 py-5">
            <AlertDialog.Description className="text-sm leading-relaxed text-muted">
              {message}
            </AlertDialog.Description>
          </div>
          <div className="flex items-center gap-3 border-t border-content/10 bg-content/5 px-6 py-4">
            <AlertDialog.Cancel asChild>
              <Button variant="secondary" onClick={onCancel} className="flex-1">
                {cancelText}
              </Button>
            </AlertDialog.Cancel>
            <AlertDialog.Action asChild>
              <Button
                variant={isDestructive ? 'dangerSolid' : 'primary'}
                onClick={onConfirm}
                className="flex-1"
              >
                {confirmText}
              </Button>
            </AlertDialog.Action>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}

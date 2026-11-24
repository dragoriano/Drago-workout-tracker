import React, { useState, useEffect } from 'react';
import { AppDialog } from './Dialog';
import { Button } from './Button';
import { Input } from './Input';

interface PromptModalProps {
  isOpen: boolean;
  title: string;
  initialValue?: string;
  placeholder?: string;
  onConfirm: (value: string) => void;
  onCancel: () => void;
}

export function PromptModal({
  isOpen,
  title,
  initialValue = '',
  placeholder = '',
  onConfirm,
  onCancel,
}: PromptModalProps) {
  const [value, setValue] = useState(initialValue);

  useEffect(() => {
    if (isOpen) {
      setValue(initialValue);
    }
  }, [isOpen, initialValue]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (value.trim()) {
      onConfirm(value.trim());
    }
  };

  return (
    <AppDialog
      open={isOpen}
      onOpenChange={(open) => { if (!open) onCancel(); }}
      title={title}
      layout="center"
      size="sm"
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        <Input
          autoFocus
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={placeholder}
          className="h-12 text-base"
        />
        <div className="flex items-center gap-3">
          <Button type="button" variant="secondary" onClick={onCancel} className="flex-1">
            Cancel
          </Button>
          <Button type="submit" disabled={!value.trim()} className="flex-1">
            Save
          </Button>
        </div>
      </form>
    </AppDialog>
  );
}

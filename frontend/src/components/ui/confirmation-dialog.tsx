// src/components/ui/confirmation-dialog.tsx
'use client';
import { useState } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import clsx from 'clsx';

interface ConfirmationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  onConfirm: () => void;
  confirmText?: string;
  cancelText?: string;
  isDestructive?: boolean;
  requireExactMatch?: string;
}

export function ConfirmationDialog({
  open,
  onOpenChange,
  title,
  description,
  onConfirm,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  isDestructive = false,
  requireExactMatch,
}: ConfirmationDialogProps) {
  const [inputValue, setInputValue] = useState('');

  // Reset the confirmation input on every open/close transition instead of
  // watching `open` in an effect (avoids a redundant re-render cascade).
  const handleOpenChange = (nextOpen: boolean) => {
    setInputValue('');
    onOpenChange(nextOpen);
  };

  const handleConfirm = () => {
    onConfirm();
  };

  const isConfirmDisabled = requireExactMatch
    ? inputValue !== requireExactMatch
    : false;

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent className="max-w-[95vw] sm:max-w-lg gap-6">
        <AlertDialogHeader className="space-y-3">
          <AlertDialogTitle className="text-xl font-semibold tracking-tight break-all">
            {title}
          </AlertDialogTitle>
          <AlertDialogDescription className="text-left text-sm text-muted-foreground leading-relaxed break-all">
            {description}
          </AlertDialogDescription>
        </AlertDialogHeader>

        {requireExactMatch && (
          <div className="space-y-3">
            <Label
              htmlFor="confirm-input"
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            >
              Type{' '}
              <span className="font-mono font-semibold text-foreground break-all inline-block">
                {requireExactMatch}
              </span>{' '}
              to confirm:
            </Label>
            <Input
              id="confirm-input"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder={requireExactMatch}
              className="font-mono text-sm break-all"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck="false"
            />
          </div>
        )}

        <AlertDialogFooter className="gap-2 sm:gap-2">
          <AlertDialogCancel className="cursor-pointer transition-colors">
            {cancelText}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={isConfirmDisabled}
            className={clsx(
              'cursor-pointer transition-colors',
              isDestructive && [
                'bg-destructive text-destructive-foreground hover:bg-destructive/90',
                'focus-visible:ring-destructive',
                'disabled:opacity-50 disabled:cursor-not-allowed',
              ],
            )}
          >
            {confirmText}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

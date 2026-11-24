import React from 'react';
import { Dialog as RadixDialog } from 'radix-ui';
import { X } from 'lucide-react';
import { cn } from '../../utils/cn';

export const Dialog = RadixDialog.Root;
export const DialogTrigger = RadixDialog.Trigger;
export const DialogClose = RadixDialog.Close;
export const DialogTitle = RadixDialog.Title;
export const DialogDescription = RadixDialog.Description;

interface DialogContentProps extends React.ComponentPropsWithoutRef<typeof RadixDialog.Content> {
  layout?: 'center' | 'sheet';
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showCloseButton?: boolean;
  onCloseClick?: () => void;
}

const SIZE_CLASSES: Record<NonNullable<DialogContentProps['size']>, string> = {
  sm: 'max-w-[380px]',
  md: 'max-w-[460px]',
  lg: 'max-w-[460px]',
  xl: 'max-w-[460px]',
};

export const DialogContent = React.forwardRef<
  React.ElementRef<typeof RadixDialog.Content>,
  DialogContentProps
>(({ className, children, layout = 'sheet', size = 'md', showCloseButton = false, onCloseClick, ...props }, ref) => (
  <RadixDialog.Portal>
    <RadixDialog.Overlay
      className="fixed inset-0 z-[100] bg-black/45 backdrop-blur-md transition-opacity"
    />
    <RadixDialog.Content
      ref={ref}
      className={cn(
        'liquid-glass-strong fixed z-[101] w-full outline-none',
        SIZE_CLASSES[size],
        layout === 'sheet'
          ? 'bottom-0 left-1/2 -translate-x-1/2 rounded-t-[28px] p-5 pt-3 pb-safe max-h-[90dvh] overflow-y-auto overscroll-y-contain'
          : 'left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-3xl p-6 max-h-[88dvh] overflow-y-auto w-[calc(100%-2rem)]',
        className,
      )}
      {...props}
    >
      {children}
      {showCloseButton && (
        <RadixDialog.Close
          onClick={onCloseClick}
          aria-label="Close dialog"
          className="liquid-btn-glass absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full text-muted hover:text-content transition-colors cursor-pointer"
        >
          <X size={18} />
        </RadixDialog.Close>
      )}
    </RadixDialog.Content>
  </RadixDialog.Portal>
));
DialogContent.displayName = 'DialogContent';

interface AppDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: React.ReactNode;
  description?: string;
  layout?: 'center' | 'sheet';
  size?: 'sm' | 'md' | 'lg' | 'xl';
  children: React.ReactNode;
  className?: string;
  headerRight?: React.ReactNode;
}

/**
 * Mobile-first Liquid Glass bottom sheet / modal built on Radix Dialog.
 */
export function AppDialog({
  open,
  onOpenChange,
  title,
  description,
  layout = 'sheet',
  size = 'md',
  children,
  className,
  headerRight,
}: AppDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent layout={layout} size={size} className={className}>
        {layout === 'sheet' && (
          <div aria-hidden="true" className="mx-auto mb-3.5 h-1 w-10 rounded-full bg-content/25" />
        )}
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <DialogTitle className="text-lg font-extrabold tracking-tight text-content">
              {title}
            </DialogTitle>
            {description ? (
              <DialogDescription className="mt-0.5 text-xs font-medium text-muted">
                {description}
              </DialogDescription>
            ) : (
              <DialogDescription className="sr-only">Dialog panel</DialogDescription>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {headerRight}
            <DialogClose
              aria-label="Close"
              className="liquid-btn-glass flex h-10 w-10 items-center justify-center rounded-full text-muted hover:text-content transition-colors cursor-pointer"
            >
              <X size={18} />
            </DialogClose>
          </div>
        </div>
        {children}
      </DialogContent>
    </Dialog>
  );
}

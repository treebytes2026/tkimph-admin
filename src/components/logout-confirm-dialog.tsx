"use client";

import { Dialog } from "@base-ui/react/dialog";
import { Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type LogoutConfirmDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void | Promise<void>;
  pending?: boolean;
};

export function LogoutConfirmDialog({
  open,
  onOpenChange,
  onConfirm,
  pending = false,
}: LogoutConfirmDialogProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop
          className={cn(
            "fixed inset-0 z-[250] bg-black/45 transition-opacity duration-200",
            "data-ending-style:opacity-0 data-starting-style:opacity-0"
          )}
        />
        <Dialog.Popup
          className={cn(
            "fixed top-1/2 left-1/2 z-[251] w-[min(calc(100vw-2rem),400px)] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-border/80 bg-background p-0 shadow-xl outline-none",
            "transition duration-200 data-ending-style:scale-[0.98] data-ending-style:opacity-0 data-starting-style:scale-[0.98] data-starting-style:opacity-0"
          )}
        >
          <div className="flex items-start justify-between gap-3 border-b border-border/80 px-5 py-4">
            <Dialog.Title className="text-lg font-bold tracking-tight text-foreground">
              Logging out?
            </Dialog.Title>
            <button
              type="button"
              className="flex size-9 shrink-0 items-center justify-center rounded-full text-muted-foreground transition hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-50"
              aria-label="Close"
              disabled={pending}
              onClick={() => onOpenChange(false)}
            >
              <X className="size-5" />
            </button>
          </div>

          <Dialog.Description className="px-5 py-4 text-sm leading-relaxed text-muted-foreground">
            Thanks for stopping by. See you again soon!
          </Dialog.Description>

          <div className="flex justify-end gap-3 border-t border-border/80 px-5 py-4">
            <Button
              type="button"
              variant="outline"
              className="rounded-xl border-border font-semibold"
              onClick={() => onOpenChange(false)}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button
              type="button"
              className="min-w-[6.5rem] rounded-xl border-0 bg-primary font-semibold text-primary-foreground hover:bg-primary/90"
              onClick={() => void onConfirm()}
              disabled={pending}
            >
              {pending ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : (
                "Log out"
              )}
            </Button>
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

import { useTranslation } from 'react-i18next';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Mic, ShieldCheck } from 'lucide-react';

interface MicPermissionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRequestPermission: () => void;
  title?: string;
  description?: string;
  actionLabel?: string;
}

export function MicPermissionDialog({
  open,
  onOpenChange,
  onRequestPermission,
  title,
  description,
  actionLabel,
}: MicPermissionDialogProps) {
  const { t } = useTranslation();
  const resolvedTitle = title ?? t("voice.micDefaultTitle");
  const resolvedDescription = description ?? t("voice.micDefaultDesc");
  const resolvedAction = actionLabel ?? t("voice.micDefaultAction");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md overflow-hidden border border-border bg-background text-foreground shadow-lg backdrop-blur-2xl">
        <div aria-hidden className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-indigo-300/70 to-transparent" />
        <DialogHeader>
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl border border-indigo-500/20 bg-gradient-to-br from-indigo-500/25 to-violet-500/20 shadow-[0_12px_28px_rgba(99,102,241,.2)]">
            <Mic className="text-indigo-700 dark:text-indigo-200" size={24} />
          </div>
          <DialogTitle className="text-center text-lg font-bold">{resolvedTitle}</DialogTitle>
          <DialogDescription className="text-center text-muted-foreground text-sm mt-2">
            {resolvedDescription}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 rounded-2xl border border-border bg-muted/40 p-4">
          <div className="flex gap-3">
            <ShieldCheck size={18} className="mt-0.5 shrink-0 text-indigo-700 dark:text-indigo-200" />
            <div className="space-y-1">
              <h4 className="text-xs font-semibold text-foreground">{t("voice.micDataTitle")}</h4>
              <p className="text-xs leading-relaxed text-muted-foreground">
                {t("voice.micDataBody")}
              </p>
            </div>
          </div>
        </div>

        <DialogFooter className="sm:justify-center mt-2">
          <Button
            onClick={onRequestPermission}
            className="w-full rounded-xl bg-gradient-to-r from-indigo-500 to-violet-500 px-6 py-2 font-semibold text-white shadow-[0_12px_28px_rgba(99,102,241,.26)] hover:brightness-110 sm:w-auto"
          >
            {resolvedAction}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

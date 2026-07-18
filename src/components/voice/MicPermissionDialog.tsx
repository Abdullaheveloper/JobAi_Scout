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
  title = "Microphone access required",
  description = "Allow microphone access to speak with JobAI Scout.",
  actionLabel = "Try microphone again",
}: MicPermissionDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md overflow-hidden border border-white/10 bg-[#0b1028]/95 text-white shadow-[0_30px_90px_rgba(2,6,23,.7)] backdrop-blur-2xl">
        <div aria-hidden className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-indigo-300/70 to-transparent" />
        <DialogHeader>
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl border border-indigo-300/20 bg-gradient-to-br from-indigo-500/25 to-violet-500/20 shadow-[0_12px_28px_rgba(99,102,241,.2)]">
            <Mic className="text-indigo-200" size={24} />
          </div>
          <DialogTitle className="text-center text-lg font-bold">{title}</DialogTitle>
          <DialogDescription className="text-center text-white/50 text-sm mt-2">
            {description}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 rounded-2xl border border-white/10 bg-white/[.045] p-4">
          <div className="flex gap-3">
            <ShieldCheck size={18} className="mt-0.5 shrink-0 text-indigo-200" />
            <div className="space-y-1">
              <h4 className="text-xs font-semibold text-white/90">Your voice data</h4>
              <p className="text-xs leading-relaxed text-slate-400">
                Audio is recorded to transcribe your question. Your voice history may be stored privately in your account so you can replay it later.
              </p>
            </div>
          </div>
        </div>

        <DialogFooter className="sm:justify-center mt-2">
          <Button
            onClick={onRequestPermission}
            className="w-full rounded-xl bg-gradient-to-r from-indigo-500 to-violet-500 px-6 py-2 font-semibold text-white shadow-[0_12px_28px_rgba(99,102,241,.26)] hover:brightness-110 sm:w-auto"
          >
            {actionLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

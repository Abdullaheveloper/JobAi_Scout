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
      <DialogContent className="sm:max-w-md bg-slate-900 border-white/10 text-white">
        <DialogHeader>
          <div className="mx-auto w-12 h-12 rounded-full bg-indigo-500/10 flex items-center justify-center mb-4">
            <Mic className="text-indigo-400" size={24} />
          </div>
          <DialogTitle className="text-center text-lg font-bold">{title}</DialogTitle>
          <DialogDescription className="text-center text-white/50 text-sm mt-2">
            {description}
          </DialogDescription>
        </DialogHeader>

        <div className="bg-white/5 rounded-xl p-4 border border-white/10 space-y-3">
          <div className="flex gap-3">
            <ShieldCheck size={18} className="text-indigo-400 flex-shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h4 className="text-xs font-semibold text-white/80">Your voice data</h4>
              <p className="text-xs text-white/40 leading-relaxed">
                Audio is recorded to transcribe your question. Your voice history may be stored privately in your account so you can replay it later.
              </p>
            </div>
          </div>
        </div>

        <DialogFooter className="sm:justify-center mt-2">
          <Button
            onClick={onRequestPermission}
            className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-xl px-6 py-2"
          >
            {actionLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

import { useState } from "react";

interface FillButtonProps {
  onFill: () => Promise<{
    filledCount: number;
    skippedCount: number;
    unknownCount: number;
  } | null>;
}

export function FillButton({ onFill }: FillButtonProps) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    filledCount: number;
    skippedCount: number;
    unknownCount: number;
  } | null>(null);

  const handleClick = async () => {
    setLoading(true);
    setResult(null);
    try {
      const res = await onFill();
      if (res) setResult(res);
    } catch (e) {
      console.error("Fill failed:", e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-3">
      <button
        onClick={handleClick}
        disabled={loading}
        className="w-full py-3 bg-gradient-to-r from-blue-500 to-indigo-500 text-white font-semibold rounded-lg hover:opacity-90 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        {loading ? (
          <>
            <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            Filling...
          </>
        ) : (
          "Autofill This Page"
        )}
      </button>

      {result && (
        <div className="bg-white border border-gray-200 rounded-xl p-3 space-y-1">
          <div className="flex items-center gap-2 text-sm">
            <span className="text-green-600 font-semibold">
              {result.filledCount} filled
            </span>
            {result.skippedCount > 0 && (
              <>
                <span className="text-gray-300">·</span>
                <span className="text-amber-600">
                  {result.skippedCount} need input
                </span>
              </>
            )}
            {result.unknownCount > 0 && (
              <>
                <span className="text-gray-300">·</span>
                <span className="text-gray-500">
                  {result.unknownCount} unrecognized
                </span>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

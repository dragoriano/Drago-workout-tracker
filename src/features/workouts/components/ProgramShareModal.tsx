import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, Copy, Download, FileText, Share2, X } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import type { WorkoutProgram } from '../../../types';
import {
  encodeProgramShareCode,
  formatProgramPlainText,
  stripProgramForShare,
} from '../../../utils/programShare';

interface ProgramShareModalProps {
  isOpen: boolean;
  program: WorkoutProgram | null;
  unit?: string;
  onClose: () => void;
}

export function ProgramShareModal({
  isOpen,
  program,
  unit = 'kg',
  onClose,
}: ProgramShareModalProps) {
  const [shareCode, setShareCode] = useState('');
  const [fitsQR, setFitsQR] = useState(true);
  const [copiedMode, setCopiedMode] = useState<'code' | 'text' | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!isOpen || !program) {
      setShareCode('');
      setError(null);
      return;
    }

    encodeProgramShareCode(program)
      .then((res) => {
        if (cancelled) return;
        setShareCode(res.code);
        setFitsQR(res.fitsQR);
        setError(null);
      })
      .catch(() => {
        if (!cancelled) setError('Could not encode program share payload.');
      });

    return () => {
      cancelled = true;
    };
  }, [isOpen, program]);

  if (!program) return null;

  const totalExercises = program.days.reduce((sum, d) => sum + d.exercises.length, 0);

  const handleCopy = async (kind: 'code' | 'text') => {
    const content = kind === 'code' ? shareCode : formatProgramPlainText(program, unit);
    if (!content) return;
    try {
      await navigator.clipboard.writeText(content);
      setCopiedMode(kind);
      setTimeout(() => setCopiedMode(null), 2000);
    } catch {
      setError('Clipboard access was denied. Try downloading JSON instead.');
    }
  };

  const handleExportJson = () => {
    const payload = JSON.stringify(
      {
        type: 'dragoriano-program',
        v: 3,
        data: stripProgramForShare(program),
      },
      null,
      2,
    );
    const slug = program.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
    const blob = new Blob([payload], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${slug || 'program'}-program.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleNativeShare = async () => {
    if (!shareCode || !navigator.share) return;
    try {
      await navigator.share({
        title: `${program.name} — Dragoriano Program`,
        text: `Import "${program.name}" in Dragoriano Workout Tracker:\n\n${shareCode}`,
      });
    } catch {
      // User dismissed share sheet
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[110] flex items-end justify-center bg-page/75 backdrop-blur-sm sm:items-center p-0 sm:p-4">
          <motion.div
            initial={{ opacity: 0, y: '100%' }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: '100%' }}
            transition={{ type: 'spring', damping: 26, stiffness: 320 }}
            className="w-full max-w-md rounded-t-3xl bg-card sm:rounded-3xl border border-content/10 shadow-2xl p-5 space-y-4 max-h-[90dvh] overflow-y-auto"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <h2 className="text-lg font-bold text-content truncate">Share Program</h2>
                <p className="text-xs text-muted truncate">
                  {program.name} · {program.days.length} days · {totalExercises} exercises
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="rounded-full bg-page/10 dark:bg-content/10 p-2 text-content hover:bg-page/20 shrink-0"
              >
                <X size={18} />
              </button>
            </div>

            {error && (
              <div className="rounded-xl bg-red-500/15 border border-red-500/30 px-3 py-2 text-xs font-bold text-red-400">
                {error}
              </div>
            )}

            {shareCode && fitsQR ? (
              <div className="flex flex-col items-center gap-2">
                <div className="rounded-2xl bg-white p-4 shadow-md border border-black/10">
                  <QRCodeSVG value={shareCode} size={200} />
                </div>
                <p className="text-xs text-muted text-center max-w-[280px]">
                  Scan this QR code in Programs → Add → Import Program on another device.
                </p>
              </div>
            ) : shareCode ? (
              <div className="rounded-2xl bg-amber-500/10 border border-amber-500/25 p-4 text-center">
                <p className="text-xs font-bold text-amber-400">
                  Program exceeds QR capacity ({shareCode.length} chars)
                </p>
                <p className="text-[11px] text-muted mt-1">
                  Share via Copy Share Code or Download JSON below instead.
                </p>
              </div>
            ) : null}

            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                disabled={!shareCode}
                onClick={() => handleCopy('code')}
                className="flex items-center justify-center gap-2 rounded-xl bg-primary-500 px-3 py-3 text-xs font-black text-white hover:bg-primary-400 active:scale-95 transition-all disabled:opacity-40"
              >
                {copiedMode === 'code' ? <Check size={15} /> : <Copy size={15} />}
                <span>{copiedMode === 'code' ? 'Code Copied!' : 'Copy Share Code'}</span>
              </button>

              <button
                type="button"
                onClick={handleExportJson}
                className="flex items-center justify-center gap-2 rounded-xl bg-surface border border-content/10 px-3 py-3 text-xs font-bold text-content hover:bg-content/5 active:scale-95 transition-all"
              >
                <Download size={15} className="text-sky-400" />
                <span>Download JSON</span>
              </button>

              <button
                type="button"
                onClick={() => handleCopy('text')}
                className="flex items-center justify-center gap-2 rounded-xl bg-surface border border-content/10 px-3 py-2.5 text-xs font-bold text-content hover:bg-content/5 active:scale-95 transition-all"
              >
                {copiedMode === 'text' ? (
                  <Check size={15} className="text-emerald-400" />
                ) : (
                  <FileText size={15} className="text-emerald-400" />
                )}
                <span>{copiedMode === 'text' ? 'Copied Text!' : 'Copy Summary'}</span>
              </button>

              {typeof navigator !== 'undefined' && typeof navigator.share === 'function' ? (
                <button
                  type="button"
                  disabled={!shareCode}
                  onClick={handleNativeShare}
                  className="flex items-center justify-center gap-2 rounded-xl bg-surface border border-content/10 px-3 py-2.5 text-xs font-bold text-content hover:bg-content/5 active:scale-95 transition-all disabled:opacity-40"
                >
                  <Share2 size={15} className="text-primary-400" />
                  <span>Share Link/Text</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={onClose}
                  className="flex items-center justify-center rounded-xl bg-surface border border-content/10 px-3 py-2.5 text-xs font-bold text-muted hover:text-content transition-all"
                >
                  Done
                </button>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

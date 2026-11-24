import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Calendar, Camera, Check, Dumbbell, FileUp, QrCode, X } from 'lucide-react';
import type { WorkoutProgram } from '../../../types';
import {
  decodeProgramSharePayload,
  prepareImportedProgram,
} from '../../../utils/programShare';

const QRCodeScanner = React.lazy(() =>
  import('../../../components/QRCodeScanner').then((m) => ({ default: m.QRCodeScanner })),
);

interface ImportProgramModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportPrograms: (programs: WorkoutProgram[]) => Promise<void>;
}

export function ImportProgramModal({
  isOpen,
  onClose,
  onImportPrograms,
}: ImportProgramModalProps) {
  const [rawInput, setRawInput] = useState('');
  const [previewPrograms, setPreviewPrograms] = useState<WorkoutProgram[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setRawInput('');
    setPreviewPrograms(null);
    setError(null);
    setIsScannerOpen(false);
    setIsImporting(false);
  }, [isOpen]);

  const handleDecodeText = async (text: string) => {
    setError(null);
    try {
      const { programs } = await decodeProgramSharePayload(text);
      setPreviewPrograms(programs);
    } catch (err: unknown) {
      setPreviewPrograms(null);
      setError(err instanceof Error ? err.message : 'Invalid share code or JSON payload.');
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const text = typeof ev.target?.result === 'string' ? ev.target.result : '';
      setRawInput(text);
      await handleDecodeText(text);
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleConfirmImport = async () => {
    if (!previewPrograms || previewPrograms.length === 0 || isImporting) return;
    setIsImporting(true);
    setError(null);
    try {
      const prepared = previewPrograms.map((p) =>
        prepareImportedProgram(p, { status: 'paused' }),
      );
      await onImportPrograms(prepared);
      onClose();
    } catch {
      setError('Failed to save imported program. Please try again.');
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <>
      <AnimatePresence>
        {isOpen && (
          <div className="fixed inset-0 z-[105] flex items-end justify-center bg-page/75 backdrop-blur-sm sm:items-center p-0 sm:p-4">
            <motion.div
              initial={{ opacity: 0, y: '100%' }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: '100%' }}
              transition={{ type: 'spring', damping: 26, stiffness: 320 }}
              className="w-full max-w-md rounded-t-3xl bg-card sm:rounded-3xl border border-content/10 shadow-2xl p-5 space-y-4 max-h-[90dvh] overflow-y-auto"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-500/15 text-sky-400">
                    <QrCode size={18} />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-content">Import Program</h2>
                    <p className="text-xs text-muted">Scan QR, paste share code, or upload JSON</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-full bg-page/10 dark:bg-content/10 p-2 text-content hover:bg-page/20"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsScannerOpen(true)}
                  className="flex items-center justify-center gap-2 rounded-xl bg-primary-500/15 border border-primary-500/30 px-3 py-3 text-xs font-bold text-primary-400 hover:bg-primary-500/25 active:scale-95 transition-all"
                >
                  <Camera size={16} />
                  <span>Scan QR Code</span>
                </button>

                <label className="cursor-pointer flex items-center justify-center gap-2 rounded-xl bg-surface border border-content/10 px-3 py-3 text-xs font-bold text-content hover:bg-content/5 active:scale-95 transition-all">
                  <input
                    type="file"
                    accept=".json,application/json"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                  <FileUp size={16} className="text-sky-400" />
                  <span>Upload JSON</span>
                </label>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-wider text-muted block">
                  Paste Share Code (DRG2:...) or JSON
                </label>
                <textarea
                  rows={3}
                  value={rawInput}
                  onChange={(e) => {
                    setRawInput(e.target.value);
                    setPreviewPrograms(null);
                    setError(null);
                  }}
                  placeholder="DRG2:... or {"
                  className="w-full rounded-xl bg-surface border border-content/10 px-3 py-2 text-xs font-mono text-content outline-none focus:ring-2 focus:ring-primary-500 resize-none"
                />
                <button
                  type="button"
                  disabled={!rawInput.trim()}
                  onClick={() => handleDecodeText(rawInput)}
                  className="w-full rounded-xl bg-surface border border-content/15 py-2 text-xs font-bold text-content hover:bg-content/5 disabled:opacity-40 transition-colors"
                >
                  Preview Shared Program
                </button>
              </div>

              {error && (
                <div className="rounded-xl bg-red-500/15 border border-red-500/30 px-3 py-2 text-xs font-bold text-red-400">
                  {error}
                </div>
              )}

              {previewPrograms && previewPrograms.length > 0 && (
                <div className="rounded-2xl bg-emerald-500/10 border border-emerald-500/25 p-3.5 space-y-2.5">
                  <p className="text-[10px] font-black uppercase tracking-wider text-emerald-400">
                    Ready to Import ({previewPrograms.length}{' '}
                    {previewPrograms.length === 1 ? 'program' : 'programs'})
                  </p>
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {previewPrograms.map((p, idx) => {
                      const exCount = (p.days || []).reduce(
                        (sum, d) => sum + (d.exercises?.length || 0),
                        0,
                      );
                      return (
                        <div
                          key={`${p.name}-${idx}`}
                          className="rounded-xl bg-card/80 border border-content/10 px-3 py-2 flex items-center justify-between gap-2"
                        >
                          <div className="min-w-0">
                            <p className="text-sm font-bold text-content truncate">{p.name}</p>
                            <p className="text-[11px] text-muted flex items-center gap-2 mt-0.5">
                              <span className="inline-flex items-center gap-1">
                                <Calendar size={11} /> {p.days.length}d
                              </span>
                              <span className="inline-flex items-center gap-1">
                                <Dumbbell size={11} /> {exCount} exercises
                              </span>
                            </p>
                          </div>
                          {p.goal && (
                            <span className="shrink-0 rounded-full bg-primary-500/15 px-2 py-0.5 text-[10px] font-bold text-primary-400">
                              {p.goal}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  <button
                    type="button"
                    disabled={isImporting}
                    onClick={handleConfirmImport}
                    className="w-full flex items-center justify-center gap-2 rounded-xl bg-emerald-500 py-3 text-xs font-black text-zinc-950 hover:bg-emerald-400 active:scale-95 transition-all disabled:opacity-50"
                  >
                    <Check size={15} />
                    <span>
                      {isImporting
                        ? 'Importing...'
                        : `Import ${previewPrograms.length === 1 ? 'Program' : `${previewPrograms.length} Programs`}`}
                    </span>
                  </button>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {isScannerOpen && (
        <React.Suspense fallback={null}>
          <QRCodeScanner
            isOpen={isScannerOpen}
            onClose={() => setIsScannerOpen(false)}
            onScanSuccess={async (decodedText) => {
              setIsScannerOpen(false);
              setRawInput(decodedText);
              await handleDecodeText(decodedText);
            }}
          />
        </React.Suspense>
      )}
    </>
  );
}

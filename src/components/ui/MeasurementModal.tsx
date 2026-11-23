import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Ruler, Weight, CheckCircle2 } from 'lucide-react';
import { Measurement } from '../../types';
import { useAppStore } from '../../store/useAppStore';
import { generateId } from '../../utils/uuid';

interface MeasurementModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
}

export function MeasurementModal({ isOpen, onClose, onSaved }: MeasurementModalProps) {
  const settings = useAppStore(s => s.settings);

  const types = [
    { id: 'weight', label: 'Body Weight', unit: settings?.weightUnit || 'kg', icon: <Weight size={18}/> },
    { id: 'chest', label: 'Chest', unit: 'cm', icon: <Ruler size={18}/> },
    { id: 'arms', label: 'Arms', unit: 'cm', icon: <Ruler size={18}/> },
    { id: 'waist', label: 'Waist', unit: 'cm', icon: <Ruler size={18}/> },
    { id: 'thighs', label: 'Thighs', unit: 'cm', icon: <Ruler size={18}/> },
    { id: 'calves', label: 'Calves', unit: 'cm', icon: <Ruler size={18}/> },
  ];

  const [selectedType, setSelectedType] = useState(types[0]);
  const [value, setValue] = useState('');
  const [note, setNote] = useState('');

  // Update selectedType if it was 'weight' and settings loaded
  React.useEffect(() => {
    if (selectedType.id === 'weight' && settings?.weightUnit) {
      setSelectedType(prev => ({ ...prev, unit: settings.weightUnit! }));
    }
  }, [settings]);

  const handleSave = async () => {
    if (!value || isNaN(Number(value))) return;

    const measurement: Measurement = {
      id: generateId(),
      type: selectedType.id,
      value: Number(value),
      unit: selectedType.unit,
      date: Date.now(),
      note: note.trim() || undefined
    };

    await useAppStore.getState().saveMeasurement(measurement);
    setValue('');
    setNote('');
    onSaved();
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-page/60 backdrop-blur-sm sm:items-center">
          <motion.div
            initial={{ opacity: 0, y: '100%' }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="w-full max-w-md rounded-t-3xl bg-card p-6 sm:rounded-3xl"
          >
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-xl font-bold text-content ">Log Measurement</h2>
              <button
                onClick={onClose}
                className="rounded-full bg-page/10 dark:bg-content/10 p-2 text-content hover:bg-page/20 dark:bg-content/20"
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-muted uppercase tracking-wider mb-2 block">Type</label>
                <div className="flex flex-wrap gap-2">
                  {types.map(t => (
                    <button
                      key={t.id}
                      onClick={() => setSelectedType(t)}
                      className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-bold transition-colors ${
                        selectedType.id === t.id 
                        ? 'bg-primary-500 text-content shadow-md shadow-primary-500/30'
                        : 'bg-page/5 dark:bg-content/5 text-muted hover:bg-page/10'
                      }`}
                    >
                      {t.icon}
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-muted uppercase tracking-wider mb-2 block">
                  Value ({selectedType.unit})
                </label>
                <input
                  type="number"
                  value={value}
                  onChange={e => setValue(e.target.value)}
                  placeholder={`e.g. ${selectedType.id === 'weight' ? '75.5' : '40'}`}
                  className="w-full rounded-2xl bg-page/5 dark:bg-content/5 px-4 py-3 text-content placeholder-zinc-600 outline-none focus:ring-2 focus:ring-primary-500 text-lg font-bold transition-all"
                  autoFocus
                />
              </div>

              <div>
                <label className="text-xs font-bold text-muted uppercase tracking-wider mb-2 block">Note (Optional)</label>
                <input
                  type="text"
                  value={note}
                  onChange={e => setNote(e.target.value)}
                  placeholder="e.g. Fasted morning weight"
                  className="w-full rounded-2xl bg-page/5 dark:bg-content/5 px-4 py-3 text-content placeholder-zinc-600 outline-none focus:ring-2 focus:ring-primary-500 transition-all"
                />
              </div>

              <button
                onClick={handleSave}
                disabled={!value || isNaN(Number(value))}
                className="mt-4 w-full rounded-2xl bg-primary-500 py-4 text-base font-black text-content shadow-lg shadow-primary-500/40 transition-all hover:bg-primary-400 active:scale-95 disabled:opacity-40 disabled:pointer-events-none flex items-center justify-center gap-2"
              >
                <CheckCircle2 size={20}/> Save Measurement
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

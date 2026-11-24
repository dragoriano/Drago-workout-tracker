import React, { useState, useEffect } from 'react';
import { Ruler, Weight, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { Measurement } from '../../types';
import { useAppStore } from '../../store/useAppStore';
import { generateId } from '../../utils/uuid';
import { AppDialog } from './Dialog';
import { Button } from './Button';
import { Input } from './Input';

interface MeasurementModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
}

export function MeasurementModal({ isOpen, onClose, onSaved }: MeasurementModalProps) {
  const settings = useAppStore(s => s.settings);

  const types = [
    { id: 'weight', label: 'Body Weight', unit: settings?.weightUnit || 'kg', icon: <Weight size={16} /> },
    { id: 'chest', label: 'Chest', unit: 'cm', icon: <Ruler size={16} /> },
    { id: 'arms', label: 'Arms', unit: 'cm', icon: <Ruler size={16} /> },
    { id: 'waist', label: 'Waist', unit: 'cm', icon: <Ruler size={16} /> },
    { id: 'thighs', label: 'Thighs', unit: 'cm', icon: <Ruler size={16} /> },
    { id: 'calves', label: 'Calves', unit: 'cm', icon: <Ruler size={16} /> },
  ];

  const [selectedType, setSelectedType] = useState(types[0]);
  const [value, setValue] = useState('');
  const [note, setNote] = useState('');

  useEffect(() => {
    if (selectedType.id === 'weight' && settings?.weightUnit) {
      setSelectedType(prev => ({ ...prev, unit: settings.weightUnit! }));
    }
  }, [settings, selectedType.id]);

  const handleSave = async () => {
    if (!value || isNaN(Number(value))) return;

    const measurement: Measurement = {
      id: generateId(),
      type: selectedType.id,
      value: Number(value),
      unit: selectedType.unit,
      date: Date.now(),
      note: note.trim() || undefined,
    };

    await useAppStore.getState().saveMeasurement(measurement);
    toast.success(`${selectedType.label} logged (${value} ${selectedType.unit})`);
    setValue('');
    setNote('');
    onSaved();
    onClose();
  };

  return (
    <AppDialog
      open={isOpen}
      onOpenChange={(open) => { if (!open) onClose(); }}
      title="Log Measurement"
      layout="sheet"
    >
      <div className="space-y-4">
        <div>
          <label className="mb-2 block text-[11px] font-bold uppercase tracking-wider text-muted">
            Type
          </label>
          <div className="flex flex-wrap gap-2">
            {types.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setSelectedType(t)}
                className={`flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold transition-all cursor-pointer ${
                  selectedType.id === t.id
                    ? 'bg-primary-500 text-white shadow-sm shadow-primary-500/25'
                    : 'bg-elevated text-muted hover:text-content border border-content/8'
                }`}
              >
                {t.icon}
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-muted">
            Value ({selectedType.unit})
          </label>
          <Input
            type="number"
            inputMode="decimal"
            step="0.1"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={`e.g. ${selectedType.id === 'weight' ? '75.5' : '40'}`}
            className="h-12 text-lg font-bold"
            autoFocus
          />
        </div>

        <div>
          <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-muted">
            Note (Optional)
          </label>
          <Input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="e.g. Fasted morning weight"
          />
        </div>

        <Button
          onClick={handleSave}
          disabled={!value || isNaN(Number(value))}
          size="lg"
          className="mt-2 w-full"
        >
          <CheckCircle2 size={18} />
          Save Measurement
        </Button>
      </div>
    </AppDialog>
  );
}

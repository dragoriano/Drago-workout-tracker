import React from 'react';

interface MuscleGroupChartProps {
  data: { name: string; volume: number; color: string }[];
  unit?: string;
}

const MUSCLE_COLORS: Record<string, string> = {
  'Chest': '#ef4444',
  'Back': '#3b82f6',
  'Shoulders': '#f97316',
  'Arms': '#6366f1',
  'Legs': '#22c55e',
  'Core': '#eab308',
  'Glutes': '#ec4899',
  'Other': '#6b7280',
};

// Maps detailed muscle names to broad groups for the chart
const MUSCLE_GROUP_MAP: Record<string, string> = {
  'Upper Chest': 'Chest', 'Mid Chest': 'Chest', 'Lower Chest': 'Chest', 'Chest': 'Chest',
  'Upper Back': 'Back', 'Mid Back': 'Back', 'Lats': 'Back', 'Erector Spinae': 'Back', 'Back': 'Back',
  'Front Delt': 'Shoulders', 'Side Delt': 'Shoulders', 'Rear Delt': 'Shoulders', 'Shoulders': 'Shoulders',
  'Biceps': 'Arms', 'Triceps': 'Arms', 'Forearms': 'Arms', 'Forearm Flexors': 'Arms', 'Forearm Extensors': 'Arms', 'Brachioradialis': 'Arms', 'Brachialis': 'Arms', 'Arms': 'Arms',
  'Quads': 'Legs', 'Hamstrings': 'Legs', 'Calves': 'Legs', 'Legs': 'Legs',
  'Abdominals': 'Core', 'Obliques': 'Core', 'Core': 'Core', 'Transverse/Anti-Rotation': 'Core',
  'Glutes': 'Glutes',
};

export function mapToMuscleGroup(detailed: string): string {
  return MUSCLE_GROUP_MAP[detailed] || 'Other';
}

export function getMuscleColor(group: string): string {
  return MUSCLE_COLORS[group] || MUSCLE_COLORS['Other'];
}

export function MuscleGroupChart({ data, unit = 'kg' }: MuscleGroupChartProps) {
  if (data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center text-muted">
        <p className="text-sm">No muscle data for this period yet.</p>
      </div>
    );
  }

  const maxVolume = Math.max(...data.map(d => d.volume));
  const totalVolume = data.reduce((sum, d) => sum + d.volume, 0);

  return (
    <div className="space-y-2.5">
      {data.map(item => {
        const pct = maxVolume > 0 ? (item.volume / maxVolume) * 100 : 0;
        const sharePct = totalVolume > 0 ? (item.volume / totalVolume) * 100 : 0;
        return (
          <div key={item.name} className="flex items-center gap-3">
            <div className="w-20 text-xs font-bold text-white/80 text-right shrink-0">{item.name}</div>
            <div className="flex-1 h-6 bg-white/5 rounded-lg overflow-hidden relative">
              <div
                className="h-full rounded-lg transition-all duration-700 ease-out"
                style={{ width: `${pct}%`, backgroundColor: item.color }}
              />
              <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-bold text-white/60">
                {(item.volume / 1000).toFixed(1)}k {unit}
              </span>
            </div>
            <div className="w-10 text-right text-[10px] font-bold text-white/40">{sharePct.toFixed(0)}%</div>
          </div>
        );
      })}
    </div>
  );
}

import React, { useId } from 'react';
import type { BroadMuscleGroup, MuscleRecoveryStatus } from '../../utils/muscleRecovery';
import { getRegionVisualStyle, type AnatomyHeatmapMode } from '../../utils/anatomicalRecovery';
import { cn } from '../../utils/cn';

export type AnatomyViewMode = 'both' | 'front' | 'back';

interface AnatomicalBodyMapProps {
  items: MuscleRecoveryStatus[];
  mode: AnatomyHeatmapMode;
  view: AnatomyViewMode;
  selectedMuscle: BroadMuscleGroup | null;
  onSelectMuscle: (muscle: BroadMuscleGroup) => void;
  isLightMode?: boolean;
}

const BODY_CHASSIS_FRONT =
  'M 100 14 ' +
  'C 110 14 116 22 116 33 C 116 44 111 52 108 55 L 111 66 ' +
  'L 132 76 C 144 80 151 89 152 103 ' +
  'L 155 138 L 166 184 L 169 197 C 169 204 163 207 159 203 L 154 187 L 143 145 L 138 118 ' +
  'C 136 138 130 156 127 170 C 131 182 134 195 135 215 ' +
  'C 136 244 134 270 128 294 C 134 316 133 344 127 386 ' +
  'L 133 398 C 134 404 127 406 118 405 L 114 391 ' +
  'C 112 356 110 326 111 296 C 107 270 105 238 103 213 L 100 212 L 97 213 ' +
  'C 95 238 93 270 89 296 C 90 326 88 356 86 391 L 82 405 ' +
  'C 73 406 66 404 67 398 L 73 386 ' +
  'C 67 344 66 316 72 294 C 66 270 64 244 65 215 C 66 195 69 182 73 170 ' +
  'C 70 156 64 138 62 118 L 57 145 L 46 187 L 41 203 ' +
  'C 37 207 31 204 31 197 L 34 184 L 45 138 L 48 103 ' +
  'C 49 89 56 80 68 76 L 89 66 L 92 55 C 89 52 84 44 84 33 C 84 22 90 14 100 14 Z';

const BODY_CHASSIS_BACK =
  'M 100 14 ' +
  'C 110 14 116 22 116 33 C 116 44 111 52 108 55 L 112 65 ' +
  'L 133 75 C 145 80 151 89 152 103 ' +
  'L 155 138 L 166 184 L 169 197 C 169 204 163 207 159 203 L 154 187 L 143 145 L 137 117 ' +
  'C 135 138 129 156 127 170 C 132 183 135 198 135 218 ' +
  'C 136 246 133 271 128 294 C 134 316 133 344 127 386 ' +
  'L 132 398 C 133 404 126 406 118 405 L 114 391 ' +
  'C 112 356 110 326 111 296 C 107 270 105 238 103 215 L 100 214 L 97 215 ' +
  'C 95 238 93 270 89 296 C 90 326 88 356 86 391 L 82 405 ' +
  'C 74 406 67 404 68 398 L 73 386 ' +
  'C 67 344 66 316 72 294 C 67 271 64 246 65 218 C 65 198 68 183 73 170 ' +
  'C 71 156 65 138 63 117 L 57 145 L 46 187 L 41 203 ' +
  'C 37 207 31 204 31 197 L 34 184 L 45 138 L 48 103 ' +
  'C 49 89 55 80 67 75 L 88 65 L 92 55 C 89 52 84 44 84 33 C 84 22 90 14 100 14 Z';

interface MuscleRegionSpec {
  muscle: BroadMuscleGroup;
  paths: string[];
}

const FRONT_REGIONS: MuscleRegionSpec[] = [
  {
    muscle: 'Shoulders',
    paths: [
      'M 71 75 C 61 76 53 84 51 97 C 51 104 56 108 62 106 C 67 99 71 89 74 80 Z',
      'M 129 75 C 139 76 147 84 149 97 C 149 104 144 108 138 106 C 133 99 129 89 126 80 Z',
    ],
  },
  {
    muscle: 'Chest',
    paths: [
      'M 98 84 L 74 81 C 69 87 68 100 72 110 C 79 117 91 118 98 113 Z',
      'M 102 84 L 126 81 C 131 87 132 100 128 110 C 121 117 109 118 102 113 Z',
    ],
  },
  {
    muscle: 'Arms',
    paths: [
      'M 63 107 C 56 108 50 107 48 115 C 45 127 45 137 51 143 C 57 141 62 130 64 116 Z',
      'M 50 146 C 43 151 39 164 36 181 C 38 183 41 183 43 181 C 48 168 53 156 54 148 Z',
      'M 137 107 C 144 108 150 107 152 115 C 155 127 155 137 149 143 C 143 141 138 130 136 116 Z',
      'M 150 146 C 157 151 161 164 164 181 C 162 183 159 183 157 181 C 152 168 147 156 146 148 Z',
    ],
  },
  {
    muscle: 'Core',
    paths: [
      // Upper, middle, and lower Rectus Abdominis pairs
      'M 88 120 L 98.5 120 L 98.5 133 L 88 133 Z',
      'M 101.5 120 L 112 120 L 112 133 L 101.5 133 Z',
      'M 88 136 L 98.5 136 L 98.5 150 L 89 150 Z',
      'M 101.5 136 L 112 136 L 111 150 L 101.5 150 Z',
      'M 89.5 153 L 98.5 153 L 98.5 179 C 94 176 90.5 167 89.5 153 Z',
      'M 110.5 153 L 101.5 153 L 101.5 179 C 106 176 109.5 167 110.5 153 Z',
      // External Obliques
      'M 75 124 L 84 128 C 85 142 86 156 88 169 C 81 167 76 158 74 145 Z',
      'M 125 124 L 116 128 C 115 142 114 156 112 169 C 119 167 124 158 126 145 Z',
    ],
  },
  {
    muscle: 'Legs',
    paths: [
      // Left & Right Quads + Anterior lower legs
      'M 71 196 C 65 224 65 256 71 286 C 78 291 84 289 88 278 C 93 255 94 226 94 209 C 86 204 77 199 71 196 Z',
      'M 71 308 C 66 324 67 346 73 371 L 80 371 C 84 351 86 326 83 308 Z',
      'M 129 196 C 135 224 135 256 129 286 C 122 291 116 289 112 278 C 107 255 106 226 106 209 C 114 204 123 199 129 196 Z',
      'M 129 308 C 134 324 133 346 127 371 L 120 371 C 116 351 114 326 117 308 Z',
    ],
  },
];

const BACK_REGIONS: MuscleRegionSpec[] = [
  {
    muscle: 'Shoulders',
    paths: [
      'M 71 75 C 61 76 53 84 51 97 C 51 104 56 108 62 106 C 67 99 71 89 74 80 Z',
      'M 129 75 C 139 76 147 84 149 97 C 149 104 144 108 138 106 C 133 99 129 89 126 80 Z',
    ],
  },
  {
    muscle: 'Back',
    paths: [
      // Upper Traps & Rhomboids hood
      'M 92 66 L 108 66 L 126 78 C 118 89 108 98 100 105 C 92 98 82 89 74 78 Z',
      // Left & Right Lat wings
      'M 74 88 L 97 107 L 96 150 C 86 146 77 136 72 121 C 69 109 70 97 74 88 Z',
      'M 126 88 L 103 107 L 104 150 C 114 146 123 136 128 121 C 131 109 130 97 126 88 Z',
      // Lower Erector Spinae columns
      'M 90 148 L 98 152 L 98 175 L 89 172 Z',
      'M 110 148 L 102 152 L 102 175 L 111 172 Z',
    ],
  },
  {
    muscle: 'Arms',
    paths: [
      'M 62 107 C 56 108 50 107 48 115 C 45 127 45 138 52 144 C 58 140 63 128 63 116 Z',
      'M 50 146 C 43 151 39 164 36 181 C 38 183 41 183 43 181 C 48 168 53 156 54 148 Z',
      'M 138 107 C 144 108 150 107 152 115 C 155 127 155 138 148 144 C 142 140 137 128 137 116 Z',
      'M 150 146 C 157 151 161 164 164 181 C 162 183 159 183 157 181 C 152 168 147 156 146 148 Z',
    ],
  },
  {
    muscle: 'Glutes',
    paths: [
      'M 71 178 C 78 173 91 174 98 181 L 98 209 C 90 216 76 215 70 205 C 68 196 69 186 71 178 Z',
      'M 129 178 C 122 173 109 174 102 181 L 102 209 C 110 216 124 215 130 205 C 132 196 131 186 129 178 Z',
    ],
  },
  {
    muscle: 'Legs',
    paths: [
      // Left & Right Hamstrings + Gastrocnemius Calves
      'M 71 218 C 79 221 89 221 94 217 C 93 248 90 272 86 286 C 78 289 72 284 70 272 C 67 253 68 234 71 218 Z',
      'M 70 310 C 75 304 82 305 85 314 C 87 331 84 352 79 369 L 73 369 C 68 351 66 327 70 310 Z',
      'M 129 218 C 121 221 111 221 106 217 C 107 248 110 272 114 286 C 122 289 128 284 130 272 C 133 253 132 234 129 218 Z',
      'M 130 310 C 125 304 118 305 115 314 C 113 331 116 352 121 369 L 127 369 C 132 351 134 327 130 310 Z',
    ],
  },
];

const SINGLE_VIEW_CALLOUTS: Record<
  'front' | 'back',
  Array<{ muscle: BroadMuscleGroup; side: 'left' | 'right'; topPct: number }>
> = {
  front: [
    { muscle: 'Shoulders', side: 'left', topPct: 21 },
    { muscle: 'Chest', side: 'right', topPct: 24 },
    { muscle: 'Arms', side: 'left', topPct: 37 },
    { muscle: 'Core', side: 'right', topPct: 39 },
    { muscle: 'Legs', side: 'left', topPct: 62 },
  ],
  back: [
    { muscle: 'Shoulders', side: 'left', topPct: 21 },
    { muscle: 'Back', side: 'right', topPct: 28 },
    { muscle: 'Arms', side: 'left', topPct: 37 },
    { muscle: 'Glutes', side: 'right', topPct: 47 },
    { muscle: 'Legs', side: 'left', topPct: 64 },
  ],
};

function renderSilhouette({
  side,
  chassisPath,
  regions,
  statusByMuscle,
  mode,
  selectedMuscle,
  onSelectMuscle,
  isLightMode,
  filterId,
  sheenGradId,
  compact,
}: {
  side: 'Front' | 'Back';
  chassisPath: string;
  regions: MuscleRegionSpec[];
  statusByMuscle: Map<BroadMuscleGroup, MuscleRecoveryStatus>;
  mode: AnatomyHeatmapMode;
  selectedMuscle: BroadMuscleGroup | null;
  onSelectMuscle: (muscle: BroadMuscleGroup) => void;
  isLightMode: boolean;
  filterId: string;
  sheenGradId: string;
  compact: boolean;
}) {
  return (
    <div className="flex flex-col items-center">
      <svg
        viewBox="0 0 200 420"
        className={cn(
          'w-full select-none overflow-visible',
          compact ? 'max-h-[290px] sm:max-h-[325px]' : 'max-h-[320px] sm:max-h-[350px]',
        )}
        role="img"
        aria-label={`${side} anatomical muscle recovery silhouette`}
      >
        <defs>
          <filter id={filterId} x="-35%" y="-35%" width="170%" height="170%">
            <feGaussianBlur stdDeviation="3.4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <linearGradient id={sheenGradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ffffff" stopOpacity={isLightMode ? '0.22' : '0.26'} />
            <stop offset="55%" stopColor="#ffffff" stopOpacity="0.04" />
            <stop offset="100%" stopColor="#000000" stopOpacity="0.16" />
          </linearGradient>
        </defs>

        {/* Subtle athletic chassis silhouette */}
        <path
          d={chassisPath}
          className={cn(
            isLightMode
              ? 'fill-slate-900/[0.06] stroke-slate-900/20'
              : 'fill-white/[0.05] stroke-white/15',
          )}
          strokeWidth={1.35}
          strokeLinejoin="round"
        />

        {/* Subtle centerline axis */}
        <line
          x1="100"
          y1="74"
          x2="100"
          y2="208"
          stroke={isLightMode ? 'rgba(15,23,42,0.08)' : 'rgba(255,255,255,0.07)'}
          strokeWidth={0.8}
          strokeDasharray="2.5 3"
        />

        {/* Interactive bilateral muscle regions */}
        {regions.map((region) => {
          const status = statusByMuscle.get(region.muscle);
          if (!status) return null;
          const isSelected = selectedMuscle === region.muscle;
          const isDimmed = selectedMuscle !== null && !isSelected;
          const style = getRegionVisualStyle(status, mode, isSelected, isDimmed, isLightMode);

          return (
            <g
              key={`${side}-${region.muscle}`}
              role="button"
              tabIndex={0}
              aria-pressed={isSelected}
              aria-label={`${region.muscle}: ${status.recoveryPercent}% recovered, ${status.readiness}`}
              onClick={() => onSelectMuscle(region.muscle)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onSelectMuscle(region.muscle);
                }
              }}
              filter={style.showGlow ? `url(#${filterId})` : undefined}
              className="cursor-pointer outline-none transition-all duration-300"
            >
              {region.paths.map((d, idx) => (
                <React.Fragment key={idx}>
                  <path
                    d={d}
                    fill={style.fill}
                    fillOpacity={style.fillOpacity}
                    stroke={style.stroke}
                    strokeOpacity={style.strokeOpacity}
                    strokeWidth={isSelected ? 1.8 : 1.05}
                    strokeLinejoin="round"
                    className="transition-all duration-300"
                  />
                  {/* Specular sheen pass for dimensional sculpted look */}
                  <path
                    d={d}
                    fill={`url(#${sheenGradId})`}
                    fillOpacity={isDimmed ? 0.25 : 0.75}
                    pointerEvents="none"
                  />
                </React.Fragment>
              ))}
            </g>
          );
        })}
      </svg>
      <span className="mt-1 text-[10px] font-bold uppercase tracking-[0.2em] text-muted">
        {side}
      </span>
    </div>
  );
}

export function AnatomicalBodyMap({
  items,
  mode,
  view,
  selectedMuscle,
  onSelectMuscle,
  isLightMode = false,
}: AnatomicalBodyMapProps) {
  const uid = useId().replace(/:/g, '');
  const statusByMuscle = new Map<BroadMuscleGroup, MuscleRecoveryStatus>(
    items.map((item) => [item.muscle, item]),
  );

  const legendItems =
    mode === 'readiness'
      ? [
          { label: 'Ready 85%+', colorClass: 'bg-emerald-500' },
          { label: 'Recovering 50–84%', colorClass: 'bg-amber-500' },
          { label: 'Fatigued <50%', colorClass: 'bg-red-500' },
        ]
      : [
          { label: 'Untrained', colorClass: 'bg-slate-500/60' },
          { label: 'Below Target', colorClass: 'bg-amber-500' },
          { label: 'Optimal', colorClass: 'bg-emerald-500' },
          { label: 'High Vol', colorClass: 'bg-red-500' },
        ];

  return (
    <div className="space-y-3">
      {view === 'both' ? (
        <div className="grid grid-cols-2 gap-2 px-1">
          {renderSilhouette({
            side: 'Front',
            chassisPath: BODY_CHASSIS_FRONT,
            regions: FRONT_REGIONS,
            statusByMuscle,
            mode,
            selectedMuscle,
            onSelectMuscle,
            isLightMode,
            filterId: `${uid}-glow-front`,
            sheenGradId: `${uid}-sheen-front`,
            compact: true,
          })}
          {renderSilhouette({
            side: 'Back',
            chassisPath: BODY_CHASSIS_BACK,
            regions: BACK_REGIONS,
            statusByMuscle,
            mode,
            selectedMuscle,
            onSelectMuscle,
            isLightMode,
            filterId: `${uid}-glow-back`,
            sheenGradId: `${uid}-sheen-back`,
            compact: true,
          })}
        </div>
      ) : (
        <div className="relative mx-auto max-w-[270px] px-2">
          {renderSilhouette({
            side: view === 'front' ? 'Front' : 'Back',
            chassisPath: view === 'front' ? BODY_CHASSIS_FRONT : BODY_CHASSIS_BACK,
            regions: view === 'front' ? FRONT_REGIONS : BACK_REGIONS,
            statusByMuscle,
            mode,
            selectedMuscle,
            onSelectMuscle,
            isLightMode,
            filterId: `${uid}-glow-single`,
            sheenGradId: `${uid}-sheen-single`,
            compact: false,
          })}

          {SINGLE_VIEW_CALLOUTS[view].map((callout) => {
            const st = statusByMuscle.get(callout.muscle);
            if (!st) return null;
            const isSel = selectedMuscle === callout.muscle;
            const dotClass =
              mode === 'readiness'
                ? st.readiness === 'ready'
                  ? 'bg-emerald-400'
                  : st.readiness === 'recovering'
                    ? 'bg-amber-400'
                    : 'bg-red-400'
                : st.volumeZone === 'optimal'
                  ? 'bg-emerald-400'
                  : st.volumeZone === 'under'
                    ? 'bg-amber-400'
                    : st.volumeZone === 'over'
                      ? 'bg-red-400'
                      : 'bg-slate-400';

            return (
              <button
                key={callout.muscle}
                type="button"
                onClick={() => onSelectMuscle(callout.muscle)}
                style={{ top: `${callout.topPct}%` }}
                className={cn(
                  'liquid-pill absolute flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold transition-all cursor-pointer',
                  callout.side === 'left' ? '-left-2 sm:-left-6' : '-right-2 sm:-right-6',
                  isSel
                    ? 'border-primary-400 bg-primary-500/20 text-content shadow-sm scale-105'
                    : 'bg-page/75 text-muted hover:text-content border-content/10',
                )}
              >
                <span className={cn('h-1.5 w-1.5 rounded-full', dotClass)} />
                <span>{callout.muscle}</span>
                <span className="font-mono text-[9px] tabular-nums opacity-80">
                  {mode === 'readiness' ? `${st.recoveryPercent}%` : `${st.effectiveSets}s`}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* Adaptive Heatmap Legend */}
      <div className="flex flex-wrap items-center justify-center gap-x-3.5 gap-y-1.5 pt-1 text-[10px] font-semibold text-muted">
        {legendItems.map((leg) => (
          <span key={leg.label} className="inline-flex items-center gap-1.5">
            <span className={cn('h-2 w-2 rounded-full', leg.colorClass)} />
            <span>{leg.label}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

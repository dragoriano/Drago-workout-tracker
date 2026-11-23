import React, { useState, useRef, useEffect } from 'react';
import { Plus, Search, Youtube } from 'lucide-react';
import { EXERCISE_DATABASE } from '../../data/exercises';
import { useAppStore } from '../../store/useAppStore';
import { CatalogExerciseItem, mergeExerciseCatalog } from '../../utils/customExercises';
import { mapToMuscleGroup } from '../../utils/muscleRecovery';
import { cn } from '../../utils/cn';

interface AutocompleteInputProps {
  value: string;
  onChange: (val: string) => void;
  onSelect: (exercise: CatalogExerciseItem) => void;
  onCreateCustom?: (initialName: string) => void;
  placeholder?: string;
  className?: string;
  filterByMuscle?: string;
}

export function AutocompleteInput({
  value,
  onChange,
  onSelect,
  onCreateCustom,
  placeholder,
  className,
  filterByMuscle,
}: AutocompleteInputProps) {
  const customExercises = useAppStore((s) => s.customExercises);
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const catalog = React.useMemo(
    () => mergeExerciseCatalog(EXERCISE_DATABASE, customExercises),
    [customExercises],
  );

  const matchesMuscle = React.useCallback(
    (ex: CatalogExerciseItem, muscle: string): boolean => {
      if (ex.primaryMuscle === muscle || ex.muscleGroups.includes(muscle)) return true;
      return (
        mapToMuscleGroup(ex.primaryMuscle) === muscle ||
        ex.muscleGroups.some((g) => mapToMuscleGroup(g) === muscle)
      );
    },
    [],
  );

  // Filter exercises based on input & optional muscle filter
  const suggestions = React.useMemo(() => {
    const query = value.trim().toLowerCase();
    if (query !== '') {
      const matched = catalog.filter((ex) => ex.name.toLowerCase().includes(query));
      if (filterByMuscle) {
        matched.sort(
          (a, b) =>
            Number(matchesMuscle(b, filterByMuscle)) - Number(matchesMuscle(a, filterByMuscle)),
        );
      }
      return matched.slice(0, 50);
    }

    if (filterByMuscle) {
      return catalog.filter((ex) => matchesMuscle(ex, filterByMuscle)).slice(0, 40);
    }

    return customExercises.length > 0 ? catalog.filter((ex) => ex.isCustom).slice(0, 12) : [];
  }, [value, filterByMuscle, catalog, customExercises.length, matchesMuscle]);

  const trimmedQuery = value.trim();
  const hasExactMatch =
    trimmedQuery !== '' &&
    catalog.some((ex) => ex.name.toLowerCase() === trimmedQuery.toLowerCase());
  const showCreateOption = Boolean(onCreateCustom && trimmedQuery.length > 0 && !hasExactMatch);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div ref={wrapperRef} className={cn('relative w-full', className)}>
      <div className="relative">
        <input
          type="text"
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => {
            if (trimmedQuery !== '' || filterByMuscle || customExercises.length > 0) {
              setIsOpen(true);
            }
          }}
          placeholder={placeholder || 'Search exercises...'}
          className="w-full rounded-2xl bg-page/5 dark:bg-content/5 pl-10 pr-4 py-3 text-sm text-content placeholder-zinc-600 outline-none focus:ring-2 focus:ring-primary-500 transition-all"
        />
        <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted" />
      </div>

      {isOpen && (suggestions.length > 0 || showCreateOption) && (
        <div className="absolute z-50 w-full mt-2 overflow-hidden rounded-2xl bg-card shadow-2xl ring-1 ring-content/10 max-h-60 overflow-y-auto custom-scrollbar">
          {suggestions.map((ex) => (
            <div
              key={`${ex.isCustom ? 'c' : 'b'}-${ex.name}`}
              className="w-full flex items-center justify-between hover:bg-page/10 dark:bg-content/10 transition-colors border-b border-content/5 last:border-0 group"
            >
              <button
                type="button"
                className="flex-1 text-left px-4 py-3 flex items-center gap-2 min-w-0"
                onClick={() => {
                  onChange(ex.name);
                  onSelect(ex);
                  setIsOpen(false);
                }}
              >
                <span className="font-semibold text-sm text-content truncate">{ex.name}</span>
                {ex.isCustom && (
                  <span className="shrink-0 rounded bg-sky-500/15 border border-sky-500/30 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider text-sky-400">
                    Custom
                  </span>
                )}
              </button>

              <div className="flex items-center gap-1 pr-2 shrink-0">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    window.open(
                      `https://www.youtube.com/results?search_query=how+to+do+${encodeURIComponent(ex.name)}+exercise`,
                      '_blank',
                    );
                  }}
                  className="text-red-500/60 hover:text-red-500 p-1.5 transition-colors shrink-0"
                  title="Watch Tutorial"
                >
                  <Youtube size={14} />
                </button>
                <span className="text-[10px] text-muted group-hover:text-primary-400 transition-colors uppercase tracking-wider hidden sm:block pr-2 shrink-0">
                  {ex.muscleGroups.slice(0, 2).join(', ')}
                  {ex.muscleGroups.length > 2 ? '...' : ''}
                </span>
              </div>
            </div>
          ))}

          {showCreateOption && onCreateCustom && (
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                onCreateCustom(trimmedQuery);
              }}
              className="w-full flex items-center gap-2 px-4 py-3 text-left text-sm font-bold text-sky-400 hover:bg-sky-500/10 transition-colors"
            >
              <Plus size={15} className="shrink-0" />
              <span className="truncate">Create &ldquo;{trimmedQuery}&rdquo; as custom exercise</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}

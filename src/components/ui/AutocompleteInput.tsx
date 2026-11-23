import React, { useState, useRef, useEffect } from 'react';
import { Search, Youtube } from 'lucide-react';
import { EXERCISE_DATABASE, ExerciseMetadata } from '../../data/exercises';
import { cn } from '../../utils/cn';

interface AutocompleteInputProps {
  value: string;
  onChange: (val: string) => void;
  onSelect: (exercise: ExerciseMetadata) => void;
  placeholder?: string;
  className?: string;
  filterByMuscle?: string;
}

export function AutocompleteInput({ 
  value, 
  onChange, 
  onSelect, 
  placeholder, 
  className,
  filterByMuscle 
}: AutocompleteInputProps) {
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Filter exercises based on input
  const suggestions = React.useMemo(() => {
    if (value.trim() !== '') {
      return EXERCISE_DATABASE
        .filter(ex => ex.name.toLowerCase().includes(value.toLowerCase()))
        .slice(0, 50);
    }
    
    if (filterByMuscle) {
      return EXERCISE_DATABASE
        .filter(ex => ex.primaryMuscle === filterByMuscle || ex.muscleGroups.includes(filterByMuscle))
        .slice(0, 20);
    }
    
    return [];
  }, [value, filterByMuscle]);

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
    <div ref={wrapperRef} className={cn("relative w-full", className)}>
      <div className="relative">
        <input
          type="text"
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => {
            if (value.trim() !== '' || filterByMuscle) setIsOpen(true);
          }}
          placeholder={placeholder || "Search exercises..."}
          className="w-full rounded-2xl bg-page/5 dark:bg-content/5 pl-10 pr-4 py-3 text-sm text-content placeholder-zinc-600 outline-none focus:ring-2 focus:ring-primary-500 transition-all"
        />
        <Search size={16}className="absolute left-4 top-1/2 -translate-y-1/2 text-muted" />
      </div>

      {isOpen && suggestions.length > 0 && (
        <div className="absolute z-50 w-full mt-2 overflow-hidden rounded-2xl bg-card shadow-2xl ring-1 ring-content/10 max-h-56 overflow-y-auto custom-scrollbar">
          {suggestions.map((ex) => (
            <div
              key={ex.name}
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
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    window.open(`https://www.youtube.com/results?search_query=how+to+do+${encodeURIComponent(ex.name)}+exercise`, '_blank');
                  }}
                  className="text-red-500/60 hover:text-red-500 p-1.5 transition-colors shrink-0"
                  title="Watch Tutorial"
                >
                  <Youtube size={14}/>
                </button>
              </button>

              <span className="text-[10px] text-muted group-hover:text-primary-400 transition-colors uppercase tracking-wider hidden sm:block pr-4 shrink-0">
                {ex.muscleGroups.slice(0, 2).join(', ')}{ex.muscleGroups.length > 2 ? '...' : ''}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

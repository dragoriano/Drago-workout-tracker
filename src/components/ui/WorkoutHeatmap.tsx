import React from 'react';
import { format, subDays, startOfDay, eachDayOfInterval, formatISO } from 'date-fns';
import { WorkoutSession } from '../../types';

interface WorkoutHeatmapProps {
  sessions: WorkoutSession[];
  daysToShow?: number;
  unit?: string;
  selectedDate?: string | null;
  onDateClick?: (dateStr: string) => void;
}

export function WorkoutHeatmap({ sessions, daysToShow = 140, unit = 'kg', selectedDate, onDateClick }: WorkoutHeatmapProps) {
  const today = startOfDay(new Date());
  const startDate = subDays(today, daysToShow - 1);
  
  const dateRange = eachDayOfInterval({ start: startDate, end: today });
  
  const sessionMap = new Map<string, number>();
  let maxVolume = 1;

  sessions.forEach(s => {
    if (!s.date || isNaN(new Date(s.date).getTime())) return;
    const dateStr = formatISO(startOfDay(new Date(s.date)), { representation: 'date' });
    const current = sessionMap.get(dateStr) || 0;
    const newVol = current + (s.totalVolume || 0);
    sessionMap.set(dateStr, newVol);
    if (newVol > maxVolume) maxVolume = newVol;
  });

  const weeks: Date[][] = [];
  let currentWeek: Date[] = [];

  dateRange.forEach(date => {
    const dayOfWeek = date.getDay();
    if (dayOfWeek === 0 && currentWeek.length > 0) {
      weeks.push(currentWeek);
      currentWeek = [];
    }
    if (weeks.length === 0 && currentWeek.length === 0 && dayOfWeek !== 0) {
      for (let i = 0; i < dayOfWeek; i++) {
        currentWeek.push(subDays(date, dayOfWeek - i));
      }
    }
    currentWeek.push(date);
  });
  if (currentWeek.length > 0) weeks.push(currentWeek);

  const getIntensityClass = (date: Date) => {
    const dateStr = formatISO(date, { representation: 'date' });
    const vol = sessionMap.get(dateStr);
    if (!vol) return 'bg-content/5 dark:bg-card/40';
    const ratio = vol / maxVolume;
    if (ratio < 0.25) return 'bg-primary-500/30';
    if (ratio < 0.5) return 'bg-primary-500/50';
    if (ratio < 0.75) return 'bg-primary-500/80';
    return 'bg-primary-500 shadow-[0_0_8px_rgba(var(--color-primary-500),0.6)]';
  };

  const getMonthLabels = () => {
    const labels: { text: string; colIndex: number }[] = [];
    let lastMonth = -1;
    weeks.forEach((week, i) => {
      const firstDay = week.find(d => d >= startDate);
      if (firstDay) {
        const month = firstDay.getMonth();
        if (month !== lastMonth) {
          labels.push({ text: format(firstDay, 'MMM'), colIndex: i });
          lastMonth = month;
        }
      }
    });
    return labels;
  };

  return (
    <div>
      <div className="overflow-x-auto pb-4 scrollbar-hide" dir="rtl">
        <div className="inline-flex flex-col gap-1 pr-1 min-w-max" dir="ltr">
          <div className="flex h-4 relative text-[10px] font-bold text-muted uppercase tracking-wider mb-1">
            {getMonthLabels().map((label, i) => (
              <span 
                key={i} 
                className="absolute"
                style={{ left: `${label.colIndex * (12 + 4)}px` }}
              >
                {label.text}
              </span>
            ))}
          </div>

          <div className="flex gap-1 items-start">
            {weeks.map((week, weekIndex) => (
              <div key={weekIndex} className="flex flex-col gap-1">
                {week.map((date, dayIndex) => {
                  const dateStr = formatISO(date, { representation: 'date' });
                  const vol = sessionMap.get(dateStr);
                  const isFuture = date > today;
                  const isBeforeStart = date < startDate;
                  const isSelected = selectedDate === dateStr;
                  
                  if (isFuture || isBeforeStart) {
                    return <div key={`${weekIndex}-${dayIndex}`} className="w-3 h-3 rounded-sm opacity-0" />;
                  }

                  return (
                    <div
                      key={dateStr}
                      className={`w-3 h-3 rounded-sm transition-all cursor-pointer hover:ring-1 hover:ring-white/40 ${getIntensityClass(date)} ${isSelected ? 'ring-2 ring-primary-400 ring-offset-1 ring-offset-black scale-125' : ''}`}
                      title={`${format(date, 'MMM d, yyyy')}: ${vol ? (vol / 1000).toFixed(1) + 'k ' + unit : 'Rest'}`}
                      onClick={() => onDateClick?.(dateStr)}
                    />
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
      
      <div className="flex items-center justify-end gap-1.5 mt-2 text-[10px] font-bold text-muted uppercase tracking-wider pr-2">
        <span>Less</span>
        <div className="w-2.5 h-2.5 rounded-sm bg-content/5 dark:bg-card/40" />
        <div className="w-2.5 h-2.5 rounded-sm bg-primary-500/30" />
        <div className="w-2.5 h-2.5 rounded-sm bg-primary-500/50" />
        <div className="w-2.5 h-2.5 rounded-sm bg-primary-500/80" />
        <div className="w-2.5 h-2.5 rounded-sm bg-primary-500" />
        <span>More</span>
      </div>
    </div>
  );
}

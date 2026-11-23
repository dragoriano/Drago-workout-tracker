import React, { useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAppStore } from '../../store/useAppStore';
import { format } from 'date-fns';
import { ChevronLeft, Share2, Image as ImageIcon, Camera, Trophy, Clock, Dumbbell, Copy, Download, BookmarkPlus, Check, GitCompareArrows } from 'lucide-react';
import { toPng } from 'html-to-image';
import { buildProgramFromFreestyle, FREESTYLE_PROGRAM_ID } from '../../utils/customExercises';
import { compareSessions, findPreviousComparableSession } from '../../utils/sessionComparison';
import { isWarmupSet } from '../../utils/strength';
import { SessionCompareModal } from '../analytics/SessionCompareModal';

export function WorkoutSummaryPage() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const [bgImage, setBgImage] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [savedAsProgram, setSavedAsProgram] = useState(false);
  const [isCompareOpen, setIsCompareOpen] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const sessions = useAppStore(s => s.sessions);
  const programs = useAppStore(s => s.programs);
  const settings = useAppStore(s => s.settings);
  const isHydrated = useAppStore(s => s.isHydrated);

  const session = sessions.find(s => s.id === sessionId);
  const program = session ? programs.find(p => p.id === session.programId) : null;

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result && typeof event.target.result === 'string') {
          setBgImage(event.target.result);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleShare = async () => {
    if (!cardRef.current) return;
    try {
      const dataUrl = await toPng(cardRef.current, { cacheBust: true, pixelRatio: 2 });
      
      const blob = await (await fetch(dataUrl)).blob();
      const file = new File([blob], 'workout-summary.png', { type: 'image/png' });

      if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          title: 'My Workout Summary',
          text: `Just crushed a workout on Dragoriano!`,
          files: [file]
        });
      } else {
        // Fallback to download
        handleDownloadOnly();
      }
    } catch (err) {
      console.error('Failed to generate image', err);
    }
  };

  const handleCopyToClipboard = async () => {
    if (!cardRef.current) return;
    try {
      const dataUrl = await toPng(cardRef.current, { cacheBust: true, pixelRatio: 2 });
      const response = await fetch(dataUrl);
      const blob = await response.blob();
      
      await navigator.clipboard.write([
        new ClipboardItem({
          [blob.type]: blob
        })
      ]);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy image to clipboard', err);
      // Fallback: Copy share text
      try {
        const text = getShareText();
        await navigator.clipboard.writeText(text);
        alert('Workout stats text copied to clipboard! (Unable to copy image directly on this browser)');
      } catch (e) {
        alert('Could not copy automatically. Please take a screenshot or download the card.');
      }
    }
  };

  const handleDownloadOnly = async () => {
    if (!cardRef.current) return;
    try {
      const dataUrl = await toPng(cardRef.current, { cacheBust: true, pixelRatio: 2 });
      const link = document.createElement('a');
      link.download = `workout-summary-${session?.id || 'stats'}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error('Failed to download image', err);
      alert('Could not download image.');
    }
  };

  const getShareText = () => {
    const vol = ((session?.totalVolume || 0) / 1000).toFixed(1);
    const unit = settings?.weightUnit || 'kg';
    const prCount = session?.PRs?.length || 0;
    const durationMins = Math.floor((session?.duration || 0) / 60);
    return `Just crushed a workout on Dragoriano Workout Tracker! 💪\n\n🔥 Duration: ${durationMins} mins\n⚡ Volume: ${vol}k ${unit}\n🏆 PRs: ${prCount}\n\nCheck out the app at: https://lbw-motion.com/dragotracker`;
  };

  const shareToWhatsApp = () => {
    const text = encodeURIComponent(getShareText());
    window.open(`https://api.whatsapp.com/send?text=${text}`, '_blank');
  };

  const shareToX = () => {
    const text = encodeURIComponent(getShareText() + '\n#Dragoriano');
    window.open(`https://twitter.com/intent/tweet?text=${text}`, '_blank');
  };

  const shareToInstagram = () => {
    handleCopyToClipboard();
    alert('Workout card copied to clipboard! Open Instagram to paste it in your Story or feed.');
    window.open('https://www.instagram.com/', '_blank');
  };

  if (!isHydrated) return <div className="p-4 flex justify-center items-center h-full text-muted">Loading...</div>;

  if (!session) {
    return (
      <div className="p-8 flex flex-col items-center justify-center h-[100dvh] bg-page text-content gap-4 text-center">
        <p className="text-lg font-bold text-red-500">Workout session not found.</p>
        <button
          onClick={() => navigate('/')}
          className="rounded-xl bg-primary-500 px-6 py-2 font-bold text-content hover:bg-primary-400"
        >
          Go Back Home
        </button>
      </div>
    );
  }

  const day = program ? program.days.find(d => d.id === session.dayId) : null;
  const isFreestyle = !program || session.programId === FREESTYLE_PROGRAM_ID;
  const workoutTitle = day?.name || session.workoutName || 'Quick Workout';
  const programLabel = program?.name || 'Freestyle Session';
  const unit = settings?.weightUnit || 'kg';
  const previousSession = findPreviousComparableSession(session, sessions);
  const comparison = compareSessions(session, previousSession);

  const handleSaveAsProgram = async () => {
    if (savedAsProgram || !session.exercisesSnapshot?.length) return;
    const hasActiveProgram = programs.some((p) => p.status === 'active');
    const newProgram = buildProgramFromFreestyle(
      workoutTitle,
      session.exercisesSnapshot,
      hasActiveProgram ? 'paused' : 'active',
    );
    await useAppStore.getState().saveProgram(newProgram);
    setSavedAsProgram(true);
  };
  
  return (
    <div className="flex flex-col h-[100dvh] w-full bg-page text-content overflow-y-auto pb-24">
      <header className="sticky top-0 z-40 flex items-center justify-between bg-page/90 px-4 py-4 backdrop-blur-md border-b border-content/5">
        <button onClick={() => navigate('/')} className="p-2 -ml-2 text-content hover:bg-page/10 dark:bg-content/10 rounded-full transition-colors">
          <ChevronLeft size={24}/>
        </button>
        <h1 className="text-lg font-black uppercase tracking-wide text-primary-400">Workout Complete</h1>
        <div className="w-10"></div>
      </header>
      
      <div className="p-4 flex flex-col items-center gap-6">
        
        {/* Actions for Background */}
        <div className="w-full flex justify-center gap-3">
          <button 
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-2 bg-card border border-content/10 px-4 py-2 rounded-xl text-sm font-bold shadow-sm hover:bg-page/5 transition-colors"
          >
            <ImageIcon size={18}className="text-primary-400" />
            Background
          </button>
          <button 
            onClick={() => cameraInputRef.current?.click()}
            className="flex items-center gap-2 bg-card border border-content/10 px-4 py-2 rounded-xl text-sm font-bold shadow-sm hover:bg-page/5 transition-colors"
          >
            <Camera size={18}className="text-primary-400" />
            Take Photo
          </button>
          <input type="file" ref={fileInputRef} accept="image/*" className="hidden" onChange={handleImageUpload} aria-label="Upload background image" />
          <input type="file" ref={cameraInputRef} accept="image/*" capture="environment" className="hidden" onChange={handleImageUpload} aria-label="Take background photo" />
        </div>

        {/* Shareable Card — sharp rectangle for clean social media export */}
        <div className="w-full max-w-sm aspect-[9/16] overflow-hidden shadow-2xl relative flex flex-col bg-black" ref={cardRef}>
          {bgImage ? (
            <img src={bgImage} alt="Background" className="absolute inset-0 w-full h-full object-cover z-0 blur-[3px] brightness-[0.3]" crossOrigin="anonymous" />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-zinc-900 via-zinc-800 to-black z-0" />
          )}
          
          {/* Content overlay */}
          <div className="relative z-10 flex flex-col h-full p-4 sm:p-5">
            
            {/* Top: Workout Title */}
            <div className="text-center pt-2 pb-3 shrink-0">
              <p className="text-primary-400 font-bold text-[9px] tracking-[0.3em] uppercase mb-1">{format(session.date, 'EEEE • MMMM d, yyyy')}</p>
              <h2 className="text-3xl font-black text-white uppercase tracking-wider leading-none mb-1 line-clamp-2">{workoutTitle}</h2>
              <p className="text-primary-300 font-bold text-[10px] tracking-widest uppercase line-clamp-1">{programLabel}</p>
            </div>
            
            {/* Stats Row */}
            <div className="grid grid-cols-3 gap-2 my-2 shrink-0">
              <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-2.5 flex flex-col items-center border border-white/5">
                <Clock size={14}className="text-primary-400 mb-1" />
                <span className="text-sm font-bold text-white">{Math.floor(session.duration / 60)}m {session.duration % 60}s</span>
                <span className="text-[8px] text-white/40 uppercase tracking-widest font-bold">Duration</span>
              </div>
              <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-2.5 flex flex-col items-center border border-white/5">
                <Dumbbell size={14}className="text-primary-400 mb-1" />
                <span className="text-sm font-bold text-white">{(session.totalVolume / 1000).toFixed(1)}k</span>
                <span className="text-[8px] text-white/40 uppercase tracking-widest font-bold">Vol ({unit})</span>
                {comparison && comparison.volumeDeltaPct !== null && (
                  <span
                    className={`mt-0.5 text-[8px] font-bold tabular-nums ${
                      comparison.volumeDeltaPct >= 0 ? 'text-emerald-400' : 'text-red-400'
                    }`}
                  >
                    {comparison.volumeDeltaPct > 0 ? '+' : ''}
                    {comparison.volumeDeltaPct}% vs last
                  </span>
                )}
              </div>
              <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-2.5 flex flex-col items-center border border-white/5">
                <Trophy size={14}className="text-yellow-400 mb-1" />
                <span className="text-sm font-bold text-white">{session.PRs.length}</span>
                <span className="text-[8px] text-white/40 uppercase tracking-widest font-bold">PRs</span>
              </div>
            </div>

            {/* Content box that takes remaining space and prevents overflow */}
            <div className="flex-1 min-h-0 flex flex-col justify-center gap-3 mb-2">
              {/* Exercise Breakdown */}
              {session.exercisesSnapshot && session.exercisesSnapshot.length > 0 && (
                <div className="flex-1 flex flex-col min-h-0 shrink">
                  <p className="text-[9px] text-white/30 uppercase tracking-widest font-bold mb-1.5 px-1 shrink-0">Exercises</p>
                  <div className="space-y-1 flex-1 overflow-hidden">
                    {session.exercisesSnapshot.slice(0, session.PRs.length > 0 ? 5 : 7).map((ex, i) => {
                      const completedSets = ex.sets.filter(s => s.completed);
                      const completedWorking = completedSets.filter(s => !isWarmupSet(s));
                      const displaySets = completedWorking.length > 0 ? completedWorking : completedSets;
                      const maxWeight = displaySets.length > 0 ? Math.max(...displaySets.map(s => s.weight)) : 0;
                      const bestSet = displaySets.find(s => s.weight === maxWeight);
                      return (
                        <div key={i} className="flex items-center justify-between bg-white/5 backdrop-blur-sm rounded-xl px-3 py-1.5 border border-white/10 shrink-0">
                          <div className="flex items-center gap-2 min-w-0 flex-1">
                            <span className="text-[10px] text-primary-400 font-black w-3 shrink-0 opacity-70">{i + 1}</span>
                            <span className="text-[11px] text-white/90 font-bold truncate pr-2">{ex.name}</span>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-[9px] text-white/50 font-bold">{displaySets.length} sets</span>
                            {bestSet && (
                              <span className="text-[10px] text-primary-300 font-bold tabular-nums">
                                {bestSet.weight}×{bestSet.reps}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                    {session.exercisesSnapshot.length > (session.PRs.length > 0 ? 5 : 7) && (
                      <p className="text-[9px] text-white/40 text-center mt-1.5 italic shrink-0">+{session.exercisesSnapshot.length - (session.PRs.length > 0 ? 5 : 7)} more exercises</p>
                    )}
                  </div>
                </div>
              )}

              {/* PRs section */}
              {session.PRs.length > 0 && (
                <div className="shrink-0 bg-yellow-500/10 backdrop-blur-sm rounded-2xl p-3 border border-yellow-500/20 shadow-lg shadow-black/20">
                  <div className="flex items-center justify-center gap-1.5 mb-2">
                    <Trophy size={12}className="text-yellow-400" />
                    <span className="font-bold text-[9px] uppercase tracking-widest text-yellow-500">New Records</span>
                  </div>
                  <div className="space-y-1">
                    {session.PRs.slice(0, 3).map((pr, i) => (
                      <div key={i} className="flex justify-between items-center text-[11px] bg-black/10 px-2 py-1 rounded">
                        <span className="text-white/80 truncate max-w-[150px] font-medium">{pr.exerciseName}</span>
                        <span className="text-yellow-400 font-bold tabular-nums">{pr.value} {pr.type === '1rm' ? `${settings?.weightUnit || 'kg'} e1RM` : pr.type === 'weight' ? (settings?.weightUnit || 'kg') : pr.type === 'reps' ? 'reps' : 'vol'}</span>
                      </div>
                    ))}
                    {session.PRs.length > 3 && (
                      <p className="text-[9px] text-yellow-500/60 text-center mt-1 italic">+{session.PRs.length - 3} more records</p>
                    )}
                  </div>
                </div>
              )}
            </div>
            
            {/* Footer branding */}
            <div className="shrink-0 pt-2 flex items-center justify-center">
              <div className="bg-primary-500/20 text-primary-300 px-4 py-1.5 rounded-full text-[8px] font-black tracking-widest uppercase border border-primary-500/30">
                Dragoriano Workout Tracker
              </div>
            </div>
          </div>
        </div>
        
        {/* Share Section */}
        <div className="w-full max-w-sm flex flex-col gap-4 mt-2">
          {comparison && (
            <div className="rounded-2xl bg-card border border-content/10 p-4 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted">
                  vs {format(comparison.previousDate, 'MMM d')}
                </p>
                <p className="text-sm font-bold text-content mt-0.5 tabular-nums">
                  <span className={comparison.volumeDelta >= 0 ? 'text-emerald-400' : 'text-red-400'}>
                    {comparison.volumeDelta > 0 ? '+' : ''}
                    {comparison.volumeDelta.toLocaleString()} {unit}
                  </span>
                  <span className="text-xs text-muted font-medium ml-1.5">
                    · {comparison.improvedCount} improved
                  </span>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsCompareOpen(true)}
                className="shrink-0 flex items-center gap-1.5 rounded-xl bg-sky-500/15 border border-sky-500/30 px-3 py-2 text-xs font-bold text-sky-400 hover:bg-sky-500/25 active:scale-95 transition-all"
              >
                <GitCompareArrows size={14} /> Full Diff
              </button>
            </div>
          )}

          {isFreestyle && session.exercisesSnapshot?.length > 0 && (
            <button
              type="button"
              disabled={savedAsProgram}
              onClick={handleSaveAsProgram}
              className={`w-full flex items-center justify-center gap-2 rounded-2xl border py-3 text-sm font-bold transition-all ${
                savedAsProgram
                  ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400'
                  : 'bg-sky-500/15 border-sky-500/30 text-sky-400 hover:bg-sky-500/25 active:scale-95'
              }`}
            >
              {savedAsProgram ? <Check size={16} /> : <BookmarkPlus size={16} />}
              {savedAsProgram ? 'Saved to Programs' : 'Save Workout as Program'}
            </button>
          )}
          {/* Main Action Group */}
          <div className="grid grid-cols-3 gap-2">
            <button 
              onClick={handleShare}
              className="flex flex-col items-center justify-center bg-card border border-content/5 hover:border-primary-500/30 rounded-2xl py-3 px-2 text-center transition-all hover:bg-page/5 active:scale-95 group"
            >
              <div className="h-10 w-10 rounded-xl bg-primary-500/10 text-primary-400 flex items-center justify-center mb-1.5 group-hover:scale-110 transition-transform">
                <Share2 size={18} />
              </div>
              <span className="text-[10px] font-bold text-muted uppercase tracking-wider">Share OS</span>
            </button>

            <button 
              onClick={handleCopyToClipboard}
              className="flex flex-col items-center justify-center bg-card border border-content/5 hover:border-primary-500/30 rounded-2xl py-3 px-2 text-center transition-all hover:bg-page/5 active:scale-95 group"
            >
              <div className="h-10 w-10 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center mb-1.5 group-hover:scale-110 transition-transform">
                <Copy size={18} />
              </div>
              <span className="text-[10px] font-bold text-muted uppercase tracking-wider">{copied ? 'Copied!' : 'Copy Card'}</span>
            </button>

            <button 
              onClick={handleDownloadOnly}
              className="flex flex-col items-center justify-center bg-card border border-content/5 hover:border-primary-500/30 rounded-2xl py-3 px-2 text-center transition-all hover:bg-page/5 active:scale-95 group"
            >
              <div className="h-10 w-10 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center mb-1.5 group-hover:scale-110 transition-transform">
                <Download size={18} />
              </div>
              <span className="text-[10px] font-bold text-muted uppercase tracking-wider">Save Image</span>
            </button>
          </div>

          {/* Social Share Group */}
          <div className="bg-card/40 border border-content/5 rounded-3xl p-4">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted mb-3 text-center">Quick Share Link & Text</p>
            <div className="flex justify-center gap-4">
              {/* WhatsApp */}
              <button 
                onClick={shareToWhatsApp}
                className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#25D366]/10 text-[#25D366] hover:bg-[#25D366]/20 transition-all active:scale-95 hover:scale-105"
                title="Share to WhatsApp"
              >
                <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
                  <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.057 5.432 5.497.008 12.185.008c3.242.003 6.29 1.268 8.583 3.565 2.293 2.296 3.555 5.346 3.552 8.587-.006 6.745-5.448 12.169-12.138 12.169-2.001-.002-3.978-.492-5.748-1.425L0 24zm6.59-4.846c1.6.95 3.188 1.449 4.725 1.451 5.516 0 10.007-4.433 10.01-9.885.003-2.64-1.025-5.122-2.898-6.999-1.874-1.876-4.363-2.909-7.009-2.912-5.523 0-10.017 4.435-10.02 9.888-.001 1.713.447 3.39 1.298 4.887L1.137 22.86l4.288-1.117s.005-.002.005-.003.002 0 .005-.001.002-.001.005-.001zm12.355-6.666c-.33-.164-1.954-.954-2.256-1.064-.301-.109-.521-.164-.74.164-.219.329-.85 1.064-1.04 1.283-.19.22-.38.247-.71.082-.33-.165-1.393-.507-2.654-1.619-.981-.864-1.643-1.932-1.836-2.261-.19-.33-.02-.508.145-.672.15-.148.33-.384.495-.577.165-.19.219-.329.33-.548.11-.22.055-.412-.028-.577-.082-.164-.74-1.758-1.013-2.417-.266-.641-.531-.555-.729-.565-.19-.01-.409-.011-.628-.011-.22 0-.576.082-.878.411-.3.33-1.152 1.112-1.152 2.709 0 1.597 1.178 3.136 1.342 3.356.164.22 2.319 3.504 5.617 4.903.784.33 1.397.527 1.874.676.787.247 1.503.212 2.07.127.632-.095 1.954-.79 2.229-1.558.275-.768.275-1.428.193-1.558-.082-.13-.301-.22-.631-.384z"/>
                </svg>
              </button>

              {/* X / Twitter */}
              <button 
                onClick={shareToX}
                className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 text-white hover:bg-white/20 transition-all active:scale-95 hover:scale-105"
                title="Share on X"
              >
                <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                </svg>
              </button>

              {/* Instagram */}
              <button 
                onClick={shareToInstagram}
                className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#E1306C]/10 text-[#E1306C] hover:bg-[#E1306C]/20 transition-all active:scale-95 hover:scale-105"
                title="Share to Instagram"
              >
                <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                  <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.051.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/>
                </svg>
              </button>
            </div>
          </div>
        </div>

      </div>

      <SessionCompareModal
        isOpen={isCompareOpen}
        session={session}
        initialBaseline={previousSession}
        allSessions={sessions}
        unit={unit}
        onClose={() => setIsCompareOpen(false)}
      />
    </div>
  );
}

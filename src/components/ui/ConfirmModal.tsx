import React from 'react';
import { X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface ConfirmModalProps {
 isOpen: boolean;
 title: string;
 message: string;
 confirmText?: string;
 cancelText?: string;
 onConfirm: () => void;
 onCancel: () => void;
 isDestructive?: boolean;
}

export function ConfirmModal({ 
 isOpen, 
 title, 
 message, 
 confirmText = 'Confirm', 
 cancelText = 'Cancel', 
 onConfirm, 
 onCancel,
 isDestructive = false
}: ConfirmModalProps) {
 return (
 <AnimatePresence>
 {isOpen && (
 <div className="fixed inset-0 z-[100] flex items-center justify-center bg-page/80 px-4 py-12 backdrop-blur-sm">
 <motion.div
 initial={{ opacity: 0, scale: 0.95 }}
 animate={{ opacity: 1, scale: 1 }}
 exit={{ opacity: 0, scale: 0.95 }}
 className="w-full max-w-sm overflow-hidden rounded-3xl bg-card shadow-2xl ring-1 ring-content/10"
 >
 <div className="flex items-center justify-between border-b border-content/5 px-6 py-4">
 <h3 className="font-bold text-content text-lg">{title}</h3>
 <button
 type="button"
 onClick={onCancel}
 className="rounded-full bg-page/5 dark:bg-content/5 p-2 text-muted hover:bg-page/10 dark:bg-content/10 hover:text-content transition-colors"
 >
 <X size={18} />
 </button>
 </div>
 <div className="px-6 py-6">
 <p className="text-muted text-sm leading-relaxed">{message}</p>
 </div>
 <div className="flex items-center gap-3 bg-page/5 dark:bg-content/5 px-6 py-4">
 <button
 type="button"
 onClick={onCancel}
 className="flex-1 rounded-xl bg-page/5 dark:bg-content/5 px-4 py-3 font-semibold text-content hover:bg-page/10 dark:bg-content/10 transition-colors"
 >
 {cancelText}
 </button>
 <button
 type="button"
 onClick={onConfirm}
 className={`flex-1 rounded-xl px-4 py-3 font-semibold text-content transition-colors ${
 isDestructive 
 ? 'bg-red-500 hover:bg-red-600' 
 : 'bg-primary-500 hover:bg-primary-600'
 }`}
 >
 {confirmText}
 </button>
 </div>
 </motion.div>
 </div>
 )}
 </AnimatePresence>
 );
}

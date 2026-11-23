import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface PromptModalProps {
 isOpen: boolean;
 title: string;
 initialValue?: string;
 placeholder?: string;
 onConfirm: (value: string) => void;
 onCancel: () => void;
}

export function PromptModal({ isOpen, title, initialValue = '', placeholder = '', onConfirm, onCancel }: PromptModalProps) {
 const [value, setValue] = useState(initialValue);

 useEffect(() => {
 if (isOpen) {
 setValue(initialValue);
 }
 }, [isOpen, initialValue]);

 const handleSubmit = (e: React.FormEvent) => {
 e.preventDefault();
 if (value.trim()) {
 onConfirm(value.trim());
 }
 };

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
 <form onSubmit={handleSubmit}>
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
 <input
 autoFocus
 type="text"
 value={value}
 onChange={(e) => setValue(e.target.value)}
 placeholder={placeholder}
 className="w-full rounded-xl bg-page/50 border border-black/10 dark:border-content/10 px-4 py-3 text-lg text-content appearance-none outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500 transition-shadow"
 />
 </div>
 <div className="flex items-center gap-3 bg-page/5 dark:bg-content/5 px-6 py-4">
 <button
 type="button"
 onClick={onCancel}
 className="flex-1 rounded-xl bg-page/5 dark:bg-content/5 px-4 py-3 font-semibold text-content hover:bg-page/10 dark:bg-content/10 transition-colors"
 >
 Cancel
 </button>
 <button
 type="submit"
 disabled={!value.trim()}
 className="flex-1 rounded-xl bg-primary-500 px-4 py-3 font-semibold text-content disabled:opacity-50 disabled:cursor-not-allowed hover:bg-primary-600 transition-colors"
 >
 Save
 </button>
 </div>
 </form>
 </motion.div>
 </div>
 )}
 </AnimatePresence>
 );
}

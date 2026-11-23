import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { X, Camera } from 'lucide-react';

interface QRCodeScannerProps {
 isOpen: boolean;
 onClose: () => void;
 onScanSuccess: (decodedText: string) => void;
}

export function QRCodeScanner({ isOpen, onClose, onScanSuccess }: QRCodeScannerProps) {
 const scannerRef = useRef<Html5Qrcode | null>(null);
 const [error, setError] = useState<string | null>(null);

 useEffect(() => {
 if (!isOpen) return;

 const scanner = new Html5Qrcode('qr-reader');
 scannerRef.current = scanner;

 scanner
 .start(
 { facingMode: 'environment' },
 {
 fps: 10,
 qrbox: { width: 250, height: 250 },
 },
 (decodedText) => {
 // Stop scanner on success
 scanner.stop().then(() => {
 scannerRef.current = null;
 onScanSuccess(decodedText);
 }).catch(console.error);
 },
 () => {
 // Ignore error on each scan attempt (expected when no QR found yet)
 }
 )
 .catch((err: any) => {
 console.error('QR Scanner error:', err);
 setError('Could not access camera. Please allow camera permissions and try again.');
 });

 return () => {
 if (scannerRef.current?.isScanning) {
 scannerRef.current.stop().catch(console.error);
 scannerRef.current = null;
 }
 };
 }, [isOpen]);

 if (!isOpen) return null;

 return (
 <div className="fixed inset-0 z-[70] flex items-center justify-center bg-page/90 backdrop-blur-sm">
 <div className="relative w-full max-w-md mx-4">
 {/* Header */}
 <div className="flex items-center justify-between mb-4">
 <div className="flex items-center gap-2 text-content ">
 <Camera size={20}/>
 <h3 className="text-lg font-bold">Scan QR Code</h3>
 </div>
 <button
 onClick={onClose}
 className="rounded-full bg-page/10 dark:bg-content/10 p-2 text-content hover:bg-page/20 dark:bg-content/20 transition-colors"
 >
 <X size={20} />
 </button>
 </div>

 {/* Scanner */}
 <div className="rounded-2xl overflow-hidden bg-page">
 <div id="qr-reader" className="w-full" />
 </div>

 {/* Error */}
 {error && (
 <div className="mt-4 rounded-xl bg-red-500/20 p-4 text-sm text-red-300 text-center">
 {error}
 </div>
 )}

 <p className="mt-4 text-center text-sm text-muted">
 Point your camera at a Dragoriano QR code to import workout programs.
 </p>
 </div>
 </div>
 );
}

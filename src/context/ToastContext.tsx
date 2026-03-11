import React, { createContext, useContext, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { CheckCircle, AlertCircle, Info, X } from 'lucide-react';
import { cn } from '../lib/utils';

type ToastType = 'success' | 'error' | 'info';

interface Toast {
    id: string;
    message: string;
    type: ToastType;
}

interface ToastContextType {
    addToast: (message: string, type?: ToastType) => void;
    success: (message: string) => void;
    error: (message: string) => void;
    info: (message: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function useToast() {
    const context = useContext(ToastContext);
    if (!context) {
        throw new Error('useToast must be used within a ToastProvider');
    }
    return context;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
    const [toasts, setToasts] = useState<Toast[]>([]);

    const removeToast = useCallback((id: string) => {
        setToasts(prev => prev.filter(toast => toast.id !== id));
    }, []);

    const addToast = useCallback((message: string, type: ToastType = 'info') => {
        const id = Math.random().toString(36).substring(2, 9);
        setToasts(prev => [...prev, { id, message, type }]);

        // Auto remove after 3 seconds
        setTimeout(() => {
            removeToast(id);
        }, 3000);
    }, [removeToast]);

    const success = useCallback((message: string) => addToast(message, 'success'), [addToast]);
    const error = useCallback((message: string) => addToast(message, 'error'), [addToast]);
    const info = useCallback((message: string) => addToast(message, 'info'), [addToast]);

    return (
        <ToastContext.Provider value={{ addToast, success, error, info }}>
            {children}
            {createPortal(
                <div className="fixed top-24 right-8 z-50 flex flex-col gap-3 pointer-events-none">
                    {toasts.map(toast => (
                        <div
                            key={toast.id}
                            className={cn(
                                "pointer-events-auto flex items-center gap-3 px-5 py-4 rounded-2xl shadow-2xl transition-all duration-300 animate-in slide-in-from-right-full fade-in",
                                "bg-white/90 backdrop-blur-md border",
                                toast.type === 'success' && "border-emerald-200 text-emerald-900",
                                toast.type === 'error' && "border-rose-200 text-rose-900",
                                toast.type === 'info' && "border-slate-200 text-slate-800"
                            )}
                        >
                            <div className={cn(
                                "p-1.5 rounded-full",
                                toast.type === 'success' && "bg-emerald-100 text-emerald-600",
                                toast.type === 'error' && "bg-rose-100 text-rose-600",
                                toast.type === 'info' && "bg-slate-100 text-slate-500"
                            )}>
                                {toast.type === 'success' && <CheckCircle className="w-5 h-5" />}
                                {toast.type === 'error' && <AlertCircle className="w-5 h-5" />}
                                {toast.type === 'info' && <Info className="w-5 h-5" />}
                            </div>
                            <span className="text-sm font-black tracking-tight">{toast.message}</span>
                            <button
                                onClick={() => removeToast(toast.id)}
                                className="ml-2 p-1 hover:bg-black/5 rounded-full text-slate-400 hover:text-slate-600 transition-colors"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                    ))}
                </div>,
                document.body
            )}
        </ToastContext.Provider>
    );
}

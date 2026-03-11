import React, { useState } from 'react';
import { cn } from '../lib/utils';

export const Button = React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'destructive' | 'ghost' }>(
    ({ className, variant = 'primary', ...props }, ref) => {
        const variants = {
            primary: "bg-blue-600 text-white hover:bg-blue-700",
            secondary: "bg-gray-100 text-gray-900 hover:bg-gray-200",
            destructive: "bg-red-600 text-white hover:bg-red-700",
            ghost: "hover:bg-gray-100 text-gray-700",
        };
        return (
            <button
                ref={ref}
                className={cn("px-4 py-2 rounded-md font-medium transition-colors disabled:opacity-50", variants[variant], className)}
                {...props}
            />
        );
    }
);
Button.displayName = "Button";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
    ({ className, ...props }, ref) => {
        return (
            <input
                ref={ref}
                className={cn(
                    "flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50",
                    className
                )}
                {...props}
            />
        );
    }
);
Input.displayName = "Input";

export const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
    ({ className, ...props }, ref) => {
        return (
            <select
                ref={ref}
                className={cn(
                    "flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50",
                    className
                )}
                {...props}
            />
        );
    }
);
Select.displayName = "Select";

export const Label = ({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) => (
    <label className={cn("text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70", className)} {...props} />
);

export const Card = ({ className, children }: { className?: string, children: React.ReactNode }) => (
    <div className={cn("rounded-lg border bg-card text-card-foreground shadow-sm bg-white", className)}>
        {children}
    </div>
);

export const CardHeader = ({ className, children }: { className?: string, children: React.ReactNode }) => (
    <div className={cn("flex flex-col space-y-1.5 p-6", className)}>{children}</div>
);

export const CardTitle = ({ className, children }: { className?: string, children: React.ReactNode }) => (
    <h3 className={cn("text-2xl font-semibold leading-none tracking-tight", className)}>{children}</h3>
);

export const CardContent = ({ className, children }: { className?: string, children: React.ReactNode }) => (
    <div className={cn("p-6 pt-0", className)}>{children}</div>
);

export const Tooltip = ({ content, children, className }: { content: React.ReactNode, children: React.ReactNode, className?: string }) => {
    const [show, setShow] = useState(false);
    return (
        <div
            className={cn("relative inline-flex items-center", className)}
            onMouseEnter={() => setShow(true)}
            onMouseLeave={() => setShow(false)}
        >
            {children}
            {show && content && (
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-slate-800/95 backdrop-blur-sm text-white text-[10px] rounded-lg shadow-xl whitespace-pre text-center z-[100] border border-slate-700 min-w-[80px]">
                    {content}
                    <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-800/95" />
                </div>
            )}
        </div>
    );
};

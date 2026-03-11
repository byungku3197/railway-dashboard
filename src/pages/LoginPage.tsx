import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Button, Input } from '../components/ui-components';
import { useAuth } from '../context/AuthContext';

export default function LoginPage() {
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const navigate = useNavigate();
    const location = useLocation();
    const from = location.state?.from?.pathname || '/';

    const { globalLogin } = useAuth();

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (globalLogin(password)) {
            navigate(from, { replace: true });
        } else {
            // Keep API fallback if needed for production, but for now use context
            // actually, let's try the API too if context fails? No, user said local.
            // But wait, the existing code uses an API. The global password 'railway2026' is hardcoded in my context plan.
            // I will strictly use the context function as requested for the new auth flow.
            // If the user *wants* to verify against server, they can, but for now I am implementing the new logic.
            // Let's assume globalLogin handles it.
            setError('Invalid Password');
        }
    };

    return (
        <div className="min-h-screen w-full flex items-center justify-center bg-[#0f172a] relative overflow-hidden">
            {/* Background Effects */}
            <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] bg-teal-500/20 rounded-full blur-[120px] animate-pulse"></div>
            <div className="absolute bottom-[-20%] right-[-10%] w-[600px] h-[600px] bg-blue-600/20 rounded-full blur-[120px] animate-pulse delay-1000"></div>

            {/* Glass Card */}
            <div className="relative z-10 w-full max-w-md p-8 rounded-3xl bg-white/5 backdrop-blur-xl border border-white/10 shadow-2xl mx-4">
                <div className="text-center mb-10">
                    <div className="inline-block p-4 rounded-2xl bg-gradient-to-br from-teal-400 to-blue-600 mb-6 shadow-lg shadow-teal-500/30">
                        <span className="text-4xl">🚄</span>
                    </div>
                    <h1 className="text-3xl font-black text-white tracking-tight mb-2">Railway Division 2</h1>
                    <p className="text-slate-400 font-medium tracking-wide text-sm uppercase">Performance Management Suite</p>
                </div>

                <form onSubmit={handleLogin} className="space-y-6">
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-1">Access Code</label>
                        <Input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="Enter password..."
                            autoFocus
                            className="bg-black/20 border-white/10 text-white placeholder:text-slate-600 focus:border-teal-500 focus:ring-teal-500/50 h-12 text-center text-lg tracking-widest"
                        />
                    </div>

                    {error && (
                        <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm font-bold text-center animate-shake">
                            ⚠️ {error}
                        </div>
                    )}

                    <Button
                        type="submit"
                        className="w-full h-12 bg-gradient-to-r from-teal-500 to-blue-600 hover:from-teal-400 hover:to-blue-500 text-white font-black tracking-wide text-lg shadow-lg shadow-blue-900/50 transition-all transform hover:scale-[1.02] active:scale-[0.98]"
                    >
                        ENTER DASHBOARD
                    </Button>
                </form>

                <div className="mt-8 text-center">
                    <p className="text-[10px] text-slate-600 font-mono">AUTHORIZED PERSONNEL ONLY</p>
                </div>
            </div>
        </div>
    );
}

import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Button, Input } from './ui-components';
import { X, Lock, UserPlus } from 'lucide-react';
import type { UserRole } from '../types';

interface AdminLoginModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export default function AdminLoginModal({ isOpen, onClose }: AdminLoginModalProps) {
    const { adminLogin, register } = useAuth();
    const [mode, setMode] = useState<'LOGIN' | 'REGISTER'>('LOGIN');

    // Login State
    const [id, setId] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');

    // Register State
    const [regId, setRegId] = useState('');
    const [regPw, setRegPw] = useState('');
    const [regConfirmPw, setRegConfirmPw] = useState('');
    const [regName, setRegName] = useState('');
    const [regRole, setRegRole] = useState<UserRole>('LEADER');
    const [regTeam, setRegTeam] = useState('TEAM_1');

    if (!isOpen) return null;

    const handleLogin = (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        const result = adminLogin(id, password);
        if (result === true) {
            onClose();
            // Reset state
            setId('');
            setPassword('');
        } else {
            setError(result as string);
        }
    };

    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (!regId || !regPw || !regName) return setError('All fields required');
        if (regPw !== regConfirmPw) return setError('Passwords do not match');
        if (regPw.length < 4) return setError('Password too short');

        const success = await register({
            id: regId,
            password: regPw,
            description: regName,
            role: regRole,
            teamId: regRole === 'LEADER' ? regTeam : undefined,
            status: 'PENDING'
        });

        if (success) {
            alert('Registration Successful! Please wait for Admin approval.');
            setMode('LOGIN');
            // Reset fields
            setRegId('');
            setRegPw('');
            setRegConfirmPw('');
            setRegName('');
        } else {
            setError('ID already exists');
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl animate-in fade-in zoom-in duration-200">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-black text-[#004442] flex items-center gap-2">
                        {mode === 'LOGIN' ? <Lock className="h-5 w-5" /> : <UserPlus className="h-5 w-5" />}
                        {mode === 'LOGIN' ? 'Administrator' : 'Request Access'}
                    </h3>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
                        <X className="h-5 w-5" />
                    </button>
                </div>

                {mode === 'LOGIN' ? (
                    <form onSubmit={handleLogin} className="space-y-4">
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-500 uppercase">Admin ID</label>
                            <Input
                                value={id}
                                onChange={e => setId(e.target.value)}
                                placeholder="e.g. T01_LEADER"
                                className="bg-slate-50 border-slate-200 focus:border-[#004442] focus:ring-[#004442]/20"
                                autoFocus
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-500 uppercase">Password</label>
                            <Input
                                type="password"
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                                placeholder="••••••••"
                                className="bg-slate-50 border-slate-200 focus:border-[#004442] focus:ring-[#004442]/20"
                            />
                        </div>

                        {error && (
                            <div className="text-rose-500 text-xs font-bold text-center bg-rose-50 p-2 rounded">
                                {error}
                            </div>
                        )}

                        <Button type="submit" className="w-full bg-[#004442] hover:bg-[#003332] text-white font-bold h-11">
                            Login
                        </Button>

                        <div className="text-center pt-2">
                            <button
                                type="button"
                                onClick={() => { setError(''); setMode('REGISTER'); }}
                                className="text-xs font-bold text-slate-400 hover:text-[#004442] underline"
                            >
                                Request New Account
                            </button>
                        </div>
                    </form>
                ) : (
                    <form onSubmit={handleRegister} className="space-y-3">
                        <div className="grid grid-cols-2 gap-2">
                            <div className="space-y-1">
                                <label className="text-[10px] font-bold text-slate-500 uppercase">Desired ID</label>
                                <Input
                                    value={regId}
                                    onChange={e => setRegId(e.target.value)}
                                    placeholder="ID"
                                    className="h-8 text-sm"
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] font-bold text-slate-500 uppercase">Display Name</label>
                                <Input
                                    value={regName}
                                    onChange={e => setRegName(e.target.value)}
                                    placeholder="Name/Pos"
                                    className="h-8 text-sm"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                            <div className="space-y-1">
                                <label className="text-[10px] font-bold text-slate-500 uppercase">Password</label>
                                <Input
                                    type="password"
                                    value={regPw}
                                    onChange={e => setRegPw(e.target.value)}
                                    className="h-8 text-sm"
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] font-bold text-slate-500 uppercase">Confirm</label>
                                <Input
                                    type="password"
                                    value={regConfirmPw}
                                    onChange={e => setRegConfirmPw(e.target.value)}
                                    className="h-8 text-sm"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                            <div className="space-y-1">
                                <label className="text-[10px] font-bold text-slate-500 uppercase">Role</label>
                                <select
                                    value={regRole}
                                    onChange={e => setRegRole(e.target.value as UserRole)}
                                    className="w-full h-8 text-sm bg-slate-50 border border-slate-200 rounded-md px-2 focus:ring-[#004442]/20 focus:border-[#004442]"
                                >
                                    <option value="HEAD">Department Head</option>
                                    <option value="LEADER">Team Leader</option>
                                    <option value="ADMIN">Admin</option>
                                </select>
                            </div>
                            {regRole === 'LEADER' && (
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-slate-500 uppercase">Team</label>
                                    <select
                                        value={regTeam}
                                        onChange={e => setRegTeam(e.target.value)}
                                        className="w-full h-8 text-sm bg-slate-50 border border-slate-200 rounded-md px-2 focus:ring-[#004442]/20 focus:border-[#004442]"
                                    >
                                        <option value="TEAM_1">Team 1</option>
                                        <option value="TEAM_2">Team 2</option>
                                        <option value="TEAM_3">Team 3</option>
                                        <option value="TEAM_4">Team 4</option>
                                        <option value="TEAM_5">Team 5</option>
                                    </select>
                                </div>
                            )}
                        </div>

                        {error && (
                            <div className="text-rose-500 text-xs font-bold text-center bg-rose-50 p-1 rounded">
                                {error}
                            </div>
                        )}

                        <Button type="submit" className="w-full bg-[#004442] hover:bg-[#003332] text-white font-bold h-10 mt-2">
                            Submit Request
                        </Button>

                        <div className="text-center pt-1">
                            <button
                                type="button"
                                onClick={() => { setError(''); setMode('LOGIN'); }}
                                className="text-xs font-bold text-slate-400 hover:text-[#004442] underline"
                            >
                                Back to Login
                            </button>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
}

import { useState } from 'react';
import { useData } from '../context/DataContext';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { Button, Card, CardHeader, CardTitle, CardContent, Input } from '../components/ui-components';

export default function SettingsPage() {
    const { updateUser, resetData, users, globalPassword, updateGlobalPassword } = useData();
    const { currentUser } = useAuth();
    const { t } = useLanguage();

    const [editingUserId, setEditingUserId] = useState<string | null>(null);
    const [editRole, setEditRole] = useState<string>('LEADER');
    const [editTeam, setEditTeam] = useState<string>('TEAM_1');

    // Global Password State
    const [globalCurrentPw, setGlobalCurrentPw] = useState('');
    const [globalNewPw, setGlobalNewPw] = useState('');
    const [globalConfirmPw, setGlobalConfirmPw] = useState('');

    const handleChangeGlobalPassword = () => {
        const actualGlobal = globalPassword || 'railway2026';
        if (globalCurrentPw !== actualGlobal) return alert('Current global password incorrect');
        if (globalNewPw !== globalConfirmPw) return alert('New passwords do not match');
        if (globalNewPw.length < 4) return alert('Too short');

        updateGlobalPassword(globalNewPw);
        alert('Global access password updated.');
        setGlobalCurrentPw('');
        setGlobalNewPw('');
        setGlobalConfirmPw('');
    };



    // ... (rest of edit user logic)

    const handleEditUser = (user: typeof users[0]) => {
        setEditingUserId(user.id);
        setEditRole(user.role);
        setEditTeam(user.teamId || 'TEAM_1');
    };

    const handleSaveUser = () => {
        if (!editingUserId) return;
        const user = users.find(u => u.id === editingUserId);
        if (!user) return;

        updateUser({
            ...user,
            role: editRole as any,
            teamId: editRole === 'LEADER' ? editTeam : undefined,
        });
        setEditingUserId(null);
    };

    // ... (rest of component, inserting logic below)
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');

    const handleChangePassword = () => {
        if (!currentUser) return alert('No admin logged in.');
        if (!currentPassword || !newPassword || !confirmPassword) return alert('Please fill in all fields.');

        // Check current password (using the one in currentUser derived from auth/data)
        // Note: currentUser might be stale if we don't refresh it, but it should be fine here.
        // Better to check against the actual value if we had it, but for client-side:
        const actualInternalPassword = currentUser.password || 'admin1234'; // Default fallback
        if (currentPassword !== actualInternalPassword) {
            return alert('Incorrect current password.');
        }

        if (newPassword !== confirmPassword) {
            return alert('New passwords do not match.');
        }

        if (newPassword.length < 4) {
            return alert('Password too short (min 4 chars).');
        }

        // Update
        updateUser({
            ...currentUser,
            password: newPassword
        });

        alert('Password updated successfully. Please re-login with the new password.');
        // Optional: Logout or clear form
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
    };

    const handleExport = () => {
        const data = localStorage.getItem('railway_dashboard_data');
        if (!data) return alert(t.msgNoDataExport);

        const blob = new Blob([data], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `railway_dashboard_backup_${new Date().toISOString().split('T')[0]}.json`;
        a.click();
    };

    const handleImport = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        if (!confirm(t.msgConfirmRestore)) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const json = e.target?.result as string;
                JSON.parse(json); // Validate JSON
                localStorage.setItem('railway_dashboard_data', json);
                alert(t.msgRestoreSuccess);
                window.location.reload();
            } catch (err) {
                alert(t.msgInvalidJSON);
            }
        };
        reader.readAsText(file);
    };

    const handleReset = () => {
        if (confirm(t.msgConfirmReset)) {
            resetData();
        }
    };

    return (
        <div className="space-y-6 max-w-2xl">
            <Card>
                <CardHeader>
                    <CardTitle>{t.titleSettings}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                    {/* User Management (Admin Only) */}
                    {currentUser?.role === 'ADMIN' && (
                        <div className="p-4 bg-indigo-50 rounded border border-indigo-100">
                            <h4 className="font-bold text-indigo-800 mb-4 flex items-center gap-2">
                                User Management
                                <span className="bg-indigo-200 text-indigo-800 px-2 py-0.5 rounded text-[10px] ml-auto">
                                    Total: {users.length}
                                </span>
                            </h4>

                            {/* Pending Requests */}
                            {users.some(u => u.status === 'PENDING') && (
                                <div className="mb-6 bg-white rounded-lg p-3 border border-indigo-200 shadow-sm">
                                    <h5 className="text-xs font-bold text-indigo-500 uppercase mb-3">Pending Requests</h5>
                                    <div className="space-y-2">
                                        {users.filter(u => u.status === 'PENDING').map(u => (
                                            <div key={u.id} className="flex items-center justify-between p-2 bg-indigo-50/50 rounded border border-indigo-100">
                                                <div>
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-bold text-slate-700">{u.description}</span>
                                                        <span className="text-xs text-slate-400">({u.id})</span>
                                                    </div>
                                                    <div className="text-xs text-slate-500 flex gap-2">
                                                        <span>{u.role}</span>
                                                        {u.teamId && <span>• {u.teamId}</span>}
                                                        <span className="text-indigo-400">• {new Date(u.createdAt || '').toLocaleDateString()}</span>
                                                    </div>
                                                </div>
                                                <div className="flex gap-2">
                                                    <Button
                                                        onClick={() => updateUser({ ...u, status: 'ACTIVE' })}
                                                        className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700 px-2 py-0"
                                                    >
                                                        Approve
                                                    </Button>
                                                    <Button
                                                        onClick={() => {
                                                            if (confirm('Dismiss request?')) updateUser({ ...u, status: 'REJECTED' });
                                                        }}
                                                        variant="ghost"
                                                        className="h-7 text-xs text-rose-500 hover:text-rose-700 hover:bg-rose-50 px-2 py-0"
                                                    >
                                                        Reject
                                                    </Button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Active Users List */}
                            <div className="space-y-2">
                                <h5 className="text-xs font-bold text-slate-400 uppercase mb-2">Active Users</h5>
                                <div className="grid gap-2 max-h-[300px] overflow-y-auto pr-1">
                                    {users.filter(u => u.status === 'ACTIVE').map(u => (
                                        <div key={u.id} className="flex items-center justify-between p-2 bg-white rounded border border-slate-200 text-sm">
                                            {editingUserId === u.id ? (
                                                <div className="flex-1 flex gap-2 items-center">
                                                    <div className="flex flex-col gap-1 w-full relative">
                                                        <div className="flex items-center justify-between">
                                                            <span className="font-semibold text-slate-700 text-xs">{u.description} ({u.id})</span>
                                                        </div>
                                                        <div className="flex gap-2">
                                                            <select
                                                                value={editRole}
                                                                onChange={e => setEditRole(e.target.value)}
                                                                className="h-7 text-xs border rounded bg-slate-50 px-1"
                                                            >
                                                                <option value="HEAD">HEAD</option>
                                                                <option value="LEADER">LEADER</option>
                                                                <option value="ADMIN">ADMIN</option>
                                                                <option value="SUB_ADMIN">SUB_ADMIN</option>
                                                            </select>
                                                            {editRole === 'LEADER' && (
                                                                <select
                                                                    value={editTeam}
                                                                    onChange={e => setEditTeam(e.target.value)}
                                                                    className="h-7 text-xs border rounded bg-slate-50 px-1"
                                                                >
                                                                    <option value="TEAM_1">Team 1</option>
                                                                    <option value="TEAM_2">Team 2</option>
                                                                    <option value="TEAM_3">Team 3</option>
                                                                    <option value="TEAM_4">Team 4</option>
                                                                    <option value="TEAM_5">Team 5</option>
                                                                </select>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <div className="flex gap-1 ml-2">
                                                        <Button onClick={handleSaveUser} className="h-7 text-xs bg-indigo-600 px-2 py-0">Save</Button>
                                                        <Button onClick={() => setEditingUserId(null)} variant="ghost" className="h-7 text-xs px-2 py-0">Cancel</Button>
                                                    </div>
                                                </div>
                                            ) : (
                                                <>
                                                    <div className="flex items-center gap-2">
                                                        <div className={`w-2 h-2 rounded-full ${u.role === 'ADMIN' ? 'bg-indigo-500' : 'bg-emerald-500'}`} />
                                                        <span className="font-semibold text-slate-700">{u.description}</span>
                                                        <span className="text-slate-400 text-xs">({u.id})</span>
                                                        <span className="text-xs bg-slate-100 px-1.5 py-0.5 rounded text-slate-500 ml-1">
                                                            {u.role}
                                                            {u.teamId && ` / ${u.teamId}`}
                                                        </span>
                                                    </div>
                                                    <div className="flex gap-1">
                                                        <button
                                                            onClick={() => handleEditUser(u)}
                                                            className="text-xs text-indigo-400 hover:text-indigo-600 px-2"
                                                        >
                                                            Edit
                                                        </button>
                                                        <button
                                                            onClick={() => {
                                                                if (u.id === currentUser.id) return alert("Cannot delete yourself");
                                                                if (u.role === 'ADMIN' && currentUser.role !== 'ADMIN') return alert("Cannot manage other admins");
                                                                if (confirm(`Remove access for ${u.description}?`)) {
                                                                    updateUser({ ...u, status: 'REJECTED' });
                                                                }
                                                            }}
                                                            className="text-xs text-slate-300 hover:text-rose-500 px-2"
                                                        >
                                                            Revoke
                                                        </button>
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Global Access Password (Admin Only) */}
                    {currentUser?.role === 'ADMIN' && (
                        <div className="p-4 bg-orange-50 rounded border border-orange-100 mb-6">
                            <h4 className="font-bold text-orange-800 mb-4 flex items-center gap-2">
                                🔐 Global Access Password
                            </h4>
                            <div className="space-y-4">
                                <div>
                                    <label className="text-sm font-medium mb-1 block">Current Global Password</label>
                                    <Input type="password" value={globalCurrentPw} onChange={e => setGlobalCurrentPw(e.target.value)} className="bg-white" />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-sm font-medium mb-1 block">New Global Password</label>
                                        <Input type="password" value={globalNewPw} onChange={e => setGlobalNewPw(e.target.value)} className="bg-white" />
                                    </div>
                                    <div>
                                        <label className="text-sm font-medium mb-1 block">Confirm Global Password</label>
                                        <Input type="password" value={globalConfirmPw} onChange={e => setGlobalConfirmPw(e.target.value)} className="bg-white" />
                                    </div>
                                </div>
                                <Button onClick={handleChangeGlobalPassword} className="w-full bg-orange-600 hover:bg-orange-700 font-bold">
                                    Update Global Access Password
                                </Button>
                            </div>
                        </div>
                    )}

                    {/* Admin Password Change - Only visible if logged in */}
                    {currentUser ? (
                        <div className="p-4 bg-blue-50 rounded border border-blue-100">
                            <h4 className="font-bold text-blue-800 mb-4 flex items-center gap-2">
                                <span className="bg-blue-200 text-blue-800 px-2 py-0.5 rounded text-xs">{currentUser.role}</span>
                                Password Change ({currentUser.description})
                            </h4>
                            <div className="space-y-4">
                                <div>
                                    <label className="text-sm font-medium mb-1 block">Current Password</label>
                                    <Input
                                        type="password"
                                        value={currentPassword}
                                        onChange={e => setCurrentPassword(e.target.value)}
                                        className="bg-white"
                                        placeholder="Enter current password"
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-sm font-medium mb-1 block">New Password</label>
                                        <Input
                                            type="password"
                                            value={newPassword}
                                            onChange={e => setNewPassword(e.target.value)}
                                            className="bg-white"
                                            placeholder="Min 4 chars"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-sm font-medium mb-1 block">Confirm Password</label>
                                        <Input
                                            type="password"
                                            value={confirmPassword}
                                            onChange={e => setConfirmPassword(e.target.value)}
                                            className="bg-white"
                                            placeholder="Re-enter new password"
                                        />
                                    </div>
                                </div>
                                <Button onClick={handleChangePassword} className="w-full bg-blue-600 hover:bg-blue-700 font-bold">
                                    Update Password provided for {currentUser.id}
                                </Button>
                            </div>
                        </div>
                    ) : (
                        <div className="p-4 bg-slate-100 rounded border border-slate-200 text-slate-500 text-sm text-center">
                            Please login as Administrator to change password.
                        </div>
                    )}

                    <div className="p-4 bg-gray-50 rounded border">
                        <h4 className="font-semibold mb-2">{t.titleBackup}</h4>
                        <p className="text-sm text-gray-500 mb-3">{t.descBackup}</p>
                        <Button onClick={handleExport} variant="secondary">{t.btnDownload}</Button>
                    </div>

                    <div className="p-4 bg-gray-50 rounded border">
                        <h4 className="font-semibold mb-2">{t.titleRestore}</h4>
                        <p className="text-sm text-gray-500 mb-3">{t.descRestore}</p>
                        <input
                            type="file"
                            accept=".json"
                            onChange={handleImport}
                            className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                        />
                    </div>

                    <div className="p-4 border border-red-200 bg-red-50 rounded">
                        <h4 className="font-semibold text-red-700 mb-2">{t.titleReset}</h4>
                        <Button onClick={handleReset} variant="destructive">{t.btnReset}</Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}

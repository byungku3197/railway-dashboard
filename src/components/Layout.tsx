import { useState, useEffect } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Users, Database, Settings, CreditCard, Calendar, Home, LogOut, Menu, X, Target } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '../lib/utils';
import { useData } from '../context/DataContext';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import AdminLoginModal from './AdminLoginModal';
import dohwaLogo from '../assets/dohwa_logo.png';

interface NavItemProps {
    to: string;
    icon: LucideIcon;
    label: string;
    active: boolean;
    onClick?: () => void;
    variant?: 'default' | 'danger';
}

const NavItem = ({ to, icon: Icon, label, active, onClick, variant = 'default' }: NavItemProps) => {
    return (
        <Link
            to={to}
            onClick={onClick}
            className={cn(
                "group flex items-center gap-3 px-4 py-2 rounded-xl transition-all duration-300 relative overflow-hidden",
                active
                    ? "bg-[#004442] text-white shadow-lg shadow-black/20"
                    : variant === 'danger'
                        ? "text-rose-300 hover:text-rose-100 hover:bg-rose-950/30"
                        : "text-emerald-100/70 hover:text-white hover:bg-white/10"
            )}
        >
            {active && <div className="absolute left-0 top-1/4 bottom-1/4 w-1 bg-[#c4d600] rounded-r-full" />}
            <Icon className={cn("h-5 w-5 transition-transform group-hover:scale-110", active ? "text-[#c4d600]" : "text-emerald-100/70 group-hover:text-white")} />
            <span className={cn("text-sm font-bold tracking-tight", active ? "text-white" : "text-emerald-100/70 group-hover:text-white")}>{label}</span>
        </Link>
    );
};

export default function Layout() {
    const location = useLocation();
    const { teams } = useData();
    const { t, language, setLanguage } = useLanguage();
    const { currentUser, logout } = useAuth();
    const navigate = useNavigate();
    const [currentTime, setCurrentTime] = useState(new Date());
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);

    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    // Close mobile menu when route changes
    useEffect(() => {
        setIsMobileMenuOpen(false);
    }, [location.pathname]);

    const isActive = (path: string) => location.pathname === path;

    const currentInputPath = teams.find(team => isActive(`/input/${team.TeamID}`));

    return (
        <div className="flex h-screen bg-gray-50 text-gray-900 font-sans overflow-hidden">
            {/* Mobile Sidebar Overlay */}
            {isMobileMenuOpen && (
                <div
                    className="fixed inset-0 bg-black/50 z-40 md:hidden"
                    onClick={() => setIsMobileMenuOpen(false)}
                />
            )}

            {/* Sidebar */}
            <aside className={cn(
                "fixed inset-y-0 left-0 w-64 bg-[#051c1b] text-white flex flex-col shadow-2xl z-50 transition-transform duration-300 md:translate-x-0 md:static",
                isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"
            )}>
                {/* Header / Logo Section */}
                <div className="pt-10 pb-8 px-8 border-b border-white/5 mb-2 relative">
                    <button
                        className="absolute top-4 right-4 md:hidden text-white/70 hover:text-white"
                        onClick={() => setIsMobileMenuOpen(false)}
                    >
                        <X className="h-6 w-6" />
                    </button>
                    <Link to="/" className="flex flex-col group">
                        <div className="flex items-center gap-2 mb-4">
                            <img
                                src={dohwaLogo}
                                alt="DOHWA"
                                className="h-10 object-contain brightness-0 invert opacity-90 group-hover:opacity-100 transition-all"
                            />
                        </div>
                        <div className="pl-1 leading-tight">
                            <p className="text-sm font-bold text-emerald-400 tracking-tight mb-0.5">{t.deptName || "철도 2부"}</p>
                            <p className="text-[11px] text-slate-400 font-medium tracking-tight opacity-80">Collection/Expense Hub</p>
                        </div>
                    </Link>
                </div>

                {/* Navigation Links */}
                <div className="flex-1 overflow-y-auto py-4 px-3 pb-40 space-y-4 sidebar-scrollbar">
                    <ul className="space-y-0.5">
                        <NavItem
                            to="/"
                            icon={Home}
                            label={t.navDashboard}
                            active={isActive('/')}
                        />
                    </ul>

                    <div className="space-y-2">
                        <div className="px-4 text-xs font-bold text-slate-500 uppercase tracking-widest">{t.sectionInput}</div>
                        <ul className="space-y-1">
                            {teams.filter(team => team.TeamID.startsWith('TEAM_') && !['TEAM_OTHER', 'TEAM_COMMON'].includes(team.TeamID)).map((team) => (
                                <NavItem
                                    key={team.TeamID}
                                    to={`/input/${team.TeamID}`}
                                    icon={Users}
                                    label={team.TeamName.split('(')[0]}
                                    active={isActive(`/input/${team.TeamID}`)}
                                />
                            ))}
                        </ul>
                    </div>

                    <div className="space-y-2">
                        <div className="px-4 text-xs font-bold text-slate-500 uppercase tracking-widest">{t.sectionMaster}</div>
                        <ul className="space-y-1">
                            <NavItem
                                to="/projects"
                                icon={Database}
                                label={t.menuProjects}
                                active={isActive('/projects')}
                            />
                            <NavItem
                                to="/rates"
                                icon={CreditCard}
                                label={t.menuRates}
                                active={isActive('/rates')}
                            />
                            <NavItem
                                to="/goals"
                                icon={Target}
                                label="연간 목표 관리"
                                active={isActive('/goals')}
                            />
                            <NavItem
                                to="/calendar"
                                icon={Calendar}
                                label={t.menuClosing}
                                active={isActive('/calendar')}
                            />
                        </ul>
                    </div>
                </div>

                {/* Footer Section */}
                <div className="p-4 border-t border-white/5 flex flex-col gap-1 bg-[#031413]">
                    <NavItem
                        to="/settings"
                        icon={Settings}
                        label={t.menuSettings}
                        active={isActive('/settings')}
                    />

                    {currentUser && (
                        <button
                            onClick={() => {
                                logout();
                                navigate('/');
                            }}
                            className="flex items-center gap-3 px-5 py-2.5 rounded-xl text-sm font-black text-rose-300 hover:text-rose-100 hover:bg-rose-950/30 transition-all w-full text-left"
                        >
                            <LogOut className="h-4.5 w-4.5" />
                            <span>Logout</span>
                        </button>
                    )}
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 w-full overflow-hidden flex flex-col relative">
                <header className="h-16 bg-white border-b flex items-center justify-between px-4 md:px-8 shadow-sm sticky top-0 z-30 flex-shrink-0">
                    <div className="flex items-center gap-3">
                        {/* Hamburger Button */}
                        <button
                            className="md:hidden p-2 -ml-2 text-gray-600 hover:bg-gray-100 rounded-lg"
                            onClick={() => setIsMobileMenuOpen(true)}
                        >
                            <Menu className="h-6 w-6" />
                        </button>

                        <h2 className="text-base md:text-lg font-black tracking-tight text-[#004442] truncate max-w-[150px] md:max-w-none">
                            {isActive('/') && (
                                <div className="flex flex-col md:flex-row md:items-end gap-1 md:gap-3">
                                    <span className="text-xl md:text-2xl font-black text-[#004442] leading-none">R2-MAP</span>
                                    <span className="text-[10px] md:text-xs font-bold text-slate-500 uppercase tracking-wide leading-none pb-0.5 opacity-80">Rail 2 Management Analysis Platform</span>
                                </div>
                            )}
                            {isActive('/projects') && t.pageProjectMaster}
                            {isActive('/rates') && t.pageRates}
                            {isActive('/goals') && "연간 목표 관리"}
                            {isActive('/calendar') && t.pageClosing}
                            {currentInputPath && `${t.pageInputPrefix || 'Input: '}${currentInputPath.TeamName.split('(')[0]}`}
                            {isActive('/settings') && t.pageSettings}
                        </h2>
                    </div>

                    <div className="flex-1" />

                    <div className="flex items-center gap-2 md:gap-4">
                        {/* Dual Language Buttons */}
                        <div className="flex bg-gray-100 rounded-xl p-1">
                            <button
                                onClick={() => setLanguage('KO')}
                                className={cn(
                                    "px-2 md:px-4 py-1.5 rounded-lg text-[10px] md:text-[11px] font-black transition-all",
                                    language === 'KO' ? "bg-white text-[#004442] shadow-sm" : "text-slate-400 hover:text-[#004442]"
                                )}
                            >
                                한글
                            </button>
                            <button
                                onClick={() => setLanguage('EN')}
                                className={cn(
                                    "px-2 md:px-4 py-1.5 rounded-lg text-[10px] md:text-[11px] font-black transition-all",
                                    language === 'EN' ? "bg-white text-[#004442] shadow-sm" : "text-slate-400 hover:text-[#004442]"
                                )}
                            >
                                ENG
                            </button>
                        </div>

                        <div className="hidden md:block text-sm text-right border-l border-slate-100 pl-4 ml-2">
                            {currentUser ? (
                                <>
                                    <div className="font-black text-[#004442] text-xs mb-0.5">{currentUser.description}</div>
                                    <div className="text-[9px] text-slate-400 font-black uppercase tracking-[0.1em]">{currentUser.id}</div>
                                </>
                            ) : (
                                <button
                                    onClick={() => setIsLoginModalOpen(true)}
                                    className="text-xs font-bold text-slate-400 hover:text-[#004442] uppercase tracking-wider transition-colors"
                                >
                                    Admin Login
                                </button>
                            )}
                        </div>
                        <div className={cn(
                            "h-8 w-8 md:h-10 md:w-10 rounded-xl md:rounded-2xl flex items-center justify-center font-black border shadow-lg transition-all",
                            currentUser
                                ? "bg-[#004442] text-white border-emerald-900 shadow-emerald-900/10"
                                : "bg-white text-slate-300 border-slate-200"
                        )}>
                            {currentUser ? currentUser.role[0] : <Users className="h-4 w-4 md:h-5 md:w-5" />}
                        </div>
                    </div>
                </header>

                <AdminLoginModal isOpen={isLoginModalOpen} onClose={() => setIsLoginModalOpen(false)} />

                <div className="flex-1 overflow-auto flex flex-col w-full bg-gray-50">
                    <div className="flex-1 p-4 md:p-8 pb-10">
                        <Outlet />
                    </div>

                    <footer className="py-6 text-center bg-gray-50 border-t border-slate-200/60 mt-auto">
                        <p className="text-[10px] text-slate-400 font-mono font-medium uppercase tracking-[0.2em] flex items-center justify-center gap-3">
                            <span className="hidden md:inline">Designed & Engineered by <span className="font-black text-[#004442]">hykim</span></span>
                            <span className="md:hidden">DHO <span className="font-black text-[#004442]">V beta1.0.0</span></span>

                            <span className="hidden md:inline w-1 h-1 rounded-full bg-slate-300"></span>
                            <span className="hidden md:inline">V beta1.0.0</span>

                            <span className="hidden md:inline w-1 h-1 rounded-full bg-slate-300"></span>
                            <span className="font-bold text-slate-500 hidden md:inline">{currentTime.getFullYear()}.{String(currentTime.getMonth() + 1).padStart(2, '0')}.{String(currentTime.getDate()).padStart(2, '0')} {String(currentTime.getHours()).padStart(2, '0')}:{String(currentTime.getMinutes()).padStart(2, '0')}:{String(currentTime.getSeconds()).padStart(2, '0')}</span>
                        </p>
                    </footer>
                </div>
            </main>
        </div>
    );
}

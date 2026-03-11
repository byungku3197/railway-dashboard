import React, { createContext, useContext, useState } from 'react';
import { useData } from './DataContext';
import type { User } from '../types';

// Initial Accounts for Seeding (Only Admins are pre-seeded)
// Initial Accounts for Seeding (Only Admins are pre-seeded)
const INITIAL_USERS: User[] = [
    { id: 'A01_ADMIN', role: 'ADMIN', description: '관리자', password: 'admin1234', status: 'ACTIVE' },
    { id: 'A02_SUB', role: 'SUB_ADMIN', description: '부관리자', password: 'admin1234', status: 'ACTIVE' },
];

interface AuthContextType {
    isGlobalAuthenticated: boolean; // Level 1 (First Password)
    currentUser: User | null;       // Level 2 (Admin Login)
    globalLogin: (password: string) => boolean;
    adminLogin: (id: string, password: string) => string | true; // Return string error or true
    logout: () => void;
    register: (user: User) => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { users, updateUser, globalPassword } = useData();
    const [isGlobalAuthenticated, setIsGlobalAuthenticated] = useState(() => {
        return sessionStorage.getItem('globalAuth') === 'true';
    });
    const [currentUser, setCurrentUser] = useState<User | null>(() => {
        const saved = sessionStorage.getItem('user');
        return saved ? JSON.parse(saved) : null;
    });

    // ... (useEffect for initial seeding remains, or simplified)

    const globalLogin = (pw: string) => {
        // Fallback to 'railway2026' if not yet loaded
        const currentGlobal = globalPassword || 'railway2026';
        if (pw === currentGlobal) {
            setIsGlobalAuthenticated(true);
            sessionStorage.setItem('globalAuth', 'true');
            return true;
        }
        return false;
    };

    const adminLogin = (id: string, pw: string) => {
        // 1. Check in DataContext
        let user = users.find(u => u.id === id);

        // 2. If not found, check Initial (Only for Fixed Admins)
        if (!user) {
            const initial = INITIAL_USERS.find(u => u.id === id);
            if (initial && pw === initial.password) {
                updateUser(initial);
                user = initial;
            }
        }

        if (user) {
            if (user.password !== pw && (user.password || 'admin1234') !== pw) { // Handle migration defaults
                return 'Invalid Password';
            }
            if (user.status === 'PENDING') return 'Account Pending Approval';
            if (user.status === 'REJECTED') return 'Account Rejected';

            setCurrentUser(user);
            sessionStorage.setItem('user', JSON.stringify(user));
            return true;
        }
        return 'User Not Found';
    };

    const register = async (newUser: User) => {
        // Helper to check duplicates
        if (users.some(u => u.id === newUser.id)) return false;

        // Add as PENDING
        updateUser({ ...newUser, status: 'PENDING', createdAt: new Date().toISOString() });
        return true;
    };

    const logout = () => {
        setCurrentUser(null);
        sessionStorage.removeItem('user');
    };

    return (
        <AuthContext.Provider value={{ isGlobalAuthenticated, currentUser, globalLogin, adminLogin, logout, register }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};

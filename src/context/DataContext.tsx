import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import type {
    AppState, ProjectMaster, InternalRate,
    ArCollection, CostExpense, MmAllocation, MonthCloseControl, RateSettings, AnnualGoal, User
} from '../types';
import { INITIAL_TEAMS, generateCalendar } from '../lib/initialData';
import { normalizeTeamId } from '../lib/utils';

interface DataContextType extends AppState {
    addProject: (project: ProjectMaster) => void;
    bulkAddProjects: (projects: ProjectMaster[]) => void;
    updateProject: (project: ProjectMaster) => void;
    deleteProject: (projectId: string) => void;
    updateRateSettings: (settings: RateSettings) => void;
    addCollection: (item: ArCollection) => void;
    deleteCollection: (id: string) => void;
    addCostExpense: (item: CostExpense) => void;
    deleteCostExpense: (id: string) => void;
    addMmAllocation: (item: MmAllocation) => void;
    bulkAddMmAllocations: (items: MmAllocation[]) => void;
    bulkUpdateMmAllocations: (toAdd: MmAllocation[], toDeleteIds: string[]) => void;
    deleteMmAllocation: (id: string) => void;
    setInternalRate: (rate: InternalRate) => void;
    setMonthClose: (control: MonthCloseControl) => void;
    updateGoal: (goal: AnnualGoal) => void;
    updateUser: (user: User) => void;
    updateGlobalPassword: (newPassword: string) => void;
    resetData: () => void;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

export const DataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [state, setState] = useState<AppState>({
        teams: INITIAL_TEAMS,
        projects: [],
        calendar: generateCalendar(),
        internalRates: [],
        rateSettings: {
            BaseRates: [],
            Surcharges: []
        },
        arCollections: [],
        costExpenses: [],
        mmAllocations: [],
        monthCloseControls: [],
        goals: [],
        users: [],
    });

    const activeSaves = useRef(0);

    const saveToServer = async (newState: AppState) => {
        // activeSaves is already incremented in setAndSaveState
        try {
            await fetch('/api/data', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newState)
            });
        } catch (error) {
            console.error("Failed to save data", error);
        } finally {
            // Buffer to ensure server generic read catches up
            // Increased to 5s for Google Sheets stability
            setTimeout(() => {
                activeSaves.current = Math.max(0, activeSaves.current - 1);
            }, 5000);
        }
    };

    const setAndSaveState = (updater: (prev: AppState) => AppState) => {
        activeSaves.current++; // Synchronously block polling!

        setState(prev => {
            const newState = updater(prev);
            // Normalize all TeamIDs in the new state before saving
            const normalizedState = {
                ...newState,
                projects: newState.projects.map(p => ({ ...p, LeadSalesTeamID: normalizeTeamId(p.LeadSalesTeamID) })),
                mmAllocations: newState.mmAllocations.map(m => ({ ...m, TeamID: normalizeTeamId(m.TeamID) })),
                costExpenses: newState.costExpenses.map(e => ({ ...e, TeamID: normalizeTeamId(e.TeamID) })),
                monthCloseControls: newState.monthCloseControls.map(c => ({ ...c, TeamID: normalizeTeamId(c.TeamID) }))
            };

            // Schedule save side-effect outside the pure updater function
            setTimeout(() => saveToServer(normalizedState), 0);

            return normalizedState;
        });
    };

    // Load and Poll Data
    useEffect(() => {
        const loadData = async () => {
            if (activeSaves.current > 0) return; // Skip polling if any save is in progress

            try {
                const res = await fetch('/api/data');
                if (res.ok) {
                    const data = await res.json();
                    if (data && activeSaves.current === 0) {
                        let teams = (data.teams && data.teams.length > 0) ? data.teams : INITIAL_TEAMS;

                        const requiredTeams = ['TEAM_OTHER', 'TEAM_COMMON'];
                        requiredTeams.forEach(reqId => {
                            if (!teams.find((t: any) => t.TeamID === reqId)) {
                                const initTeam = INITIAL_TEAMS.find(t => t.TeamID === reqId);
                                if (initTeam) teams.push(initTeam);
                            }
                        });

                        teams = teams.map((t: any) => {
                            const normalizedId = normalizeTeamId(t.TeamID);
                            if (normalizedId.startsWith('TEAM_')) {
                                return { ...t, TeamID: normalizedId, TeamType: 'SALES' };
                            }
                            return { ...t, TeamID: normalizedId };
                        });

                        setState(prev => ({
                            ...prev,
                            ...data,
                            teams: teams,
                            users: data.users || []
                        }));
                    }
                }
            } catch (error) {
                console.error("Failed to load data", error);
            }
        };

        loadData();
        const interval = setInterval(loadData, 3000); // Increased interval slightly for safety
        return () => clearInterval(interval);
    }, []);

    const addProject = (project: ProjectMaster) => {
        setAndSaveState(prev => ({ ...prev, projects: [...prev.projects, project] }));
    };

    const bulkAddProjects = (newProjects: ProjectMaster[]) => {
        setAndSaveState(prev => {
            const existingIds = new Set(prev.projects.map(p => p.ProjectID));
            const uniqueNew = newProjects.filter(p => !existingIds.has(p.ProjectID));
            return { ...prev, projects: [...prev.projects, ...uniqueNew] };
        });
    };

    const updateProject = (project: ProjectMaster) => {
        setAndSaveState(prev => ({
            ...prev,
            projects: prev.projects.map(p => p.ProjectID === project.ProjectID ? project : p)
        }));
    };

    const deleteProject = (projectId: string) => {
        setAndSaveState(prev => ({
            ...prev,
            projects: prev.projects.filter(p => p.ProjectID !== projectId),
            arCollections: prev.arCollections.filter(c => c.ProjectID !== projectId),
            costExpenses: prev.costExpenses.filter(e => e.ProjectID !== projectId),
            mmAllocations: prev.mmAllocations.filter(m => m.ProjectID !== projectId)
        }));
    };

    const addCollection = (item: ArCollection) => {
        setAndSaveState(prev => ({ ...prev, arCollections: [...prev.arCollections, item] }));
    };

    const deleteCollection = (id: string) => {
        setAndSaveState(prev => ({ ...prev, arCollections: prev.arCollections.filter(i => i.id !== id) }));
    };

    const addCostExpense = (item: CostExpense) => {
        const normalizedItem = { ...item, TeamID: normalizeTeamId(item.TeamID) };
        setAndSaveState(prev => ({ ...prev, costExpenses: [...prev.costExpenses, normalizedItem] }));
    };

    const deleteCostExpense = (id: string) => {
        setAndSaveState(prev => ({ ...prev, costExpenses: prev.costExpenses.filter(i => i.id !== id) }));
    };

    const addMmAllocation = (item: MmAllocation) => {
        const normalizedItem = { ...item, TeamID: normalizeTeamId(item.TeamID) };
        setAndSaveState(prev => ({ ...prev, mmAllocations: [...prev.mmAllocations, normalizedItem] }));
    };

    const bulkAddMmAllocations = (newAllocations: MmAllocation[]) => {
        const normalizedAllocations = newAllocations.map(a => ({ ...a, TeamID: normalizeTeamId(a.TeamID) }));
        setAndSaveState(prev => {
            const newIds = new Set(normalizedAllocations.map(a => a.id));
            const filtered = prev.mmAllocations.filter(a => !newIds.has(a.id));
            return { ...prev, mmAllocations: [...filtered, ...normalizedAllocations] };
        });
    };

    const bulkUpdateMmAllocations = (toAdd: MmAllocation[], toDeleteIds: string[]) => {
        const normalizedToAdd = toAdd.map(a => ({ ...a, TeamID: normalizeTeamId(a.TeamID) }));
        setAndSaveState(prev => {
            const deleteSet = new Set(toDeleteIds);
            const addIds = new Set(normalizedToAdd.map(a => a.id));
            const filtered = prev.mmAllocations.filter(a => !deleteSet.has(a.id) && !addIds.has(a.id));
            return { ...prev, mmAllocations: [...filtered, ...normalizedToAdd] };
        });
    };

    const deleteMmAllocation = (id: string) => {
        setAndSaveState(prev => ({ ...prev, mmAllocations: prev.mmAllocations.filter(i => i.id !== id) }));
    };

    const updateRateSettings = (settings: RateSettings) => {
        setAndSaveState(prev => ({ ...prev, rateSettings: settings }));
    };

    const setInternalRate = (rate: InternalRate) => {
        setAndSaveState(prev => {
            const exists = prev.internalRates.find(r => r.id === rate.id);
            if (exists) {
                return { ...prev, internalRates: prev.internalRates.map(r => r.id === rate.id ? rate : r) };
            }
            return { ...prev, internalRates: [...prev.internalRates, rate] };
        });
    };

    const setMonthClose = (control: MonthCloseControl) => {
        const normalized = { ...control, TeamID: normalizeTeamId(control.TeamID) };
        setAndSaveState(prev => {
            const exists = prev.monthCloseControls.find(c => c.id === normalized.id);
            if (exists) {
                return { ...prev, monthCloseControls: prev.monthCloseControls.map(c => c.id === normalized.id ? normalized : c) };
            }
            return { ...prev, monthCloseControls: [...prev.monthCloseControls, normalized] };
        });
    };

    const updateGoal = (goal: AnnualGoal) => {
        setAndSaveState(prev => {
            const exists = prev.goals.some(g => g.Year === goal.Year);
            if (exists) {
                return { ...prev, goals: prev.goals.map(g => g.Year === goal.Year ? goal : g) };
            }
            return { ...prev, goals: [...prev.goals, goal] };
        });
    };

    const updateUser = (user: User) => {
        setAndSaveState(prev => {
            const exists = prev.users.some(u => u.id === user.id);
            if (exists) {
                return { ...prev, users: prev.users.map(u => u.id === user.id ? user : u) };
            }
            return { ...prev, users: [...prev.users, user] };
        });
    };

    const updateGlobalPassword = (newPassword: string) => {
        setAndSaveState(prev => ({
            ...prev,
            globalPassword: newPassword
        }));
    };

    const resetData = () => {
        if (confirm("Reset Server Data? This affects all users.")) {
            setAndSaveState(() => ({
                teams: INITIAL_TEAMS,
                projects: [],
                calendar: generateCalendar(),
                internalRates: [],
                rateSettings: { BaseRates: [], Surcharges: [] },
                arCollections: [],
                costExpenses: [],
                mmAllocations: [],
                monthCloseControls: [],
                goals: [],
                users: [],
                globalPassword: 'railway2026'
            }));
            window.location.reload();
        }
    };

    return (
        <DataContext.Provider value={{
            ...state,
            addProject, bulkAddProjects, updateProject, deleteProject,
            updateRateSettings,
            addCollection, deleteCollection,
            addCostExpense, deleteCostExpense,
            addMmAllocation, bulkAddMmAllocations, bulkUpdateMmAllocations, deleteMmAllocation,
            setInternalRate, setMonthClose,
            updateGoal, updateUser, updateGlobalPassword, resetData
        }}>
            {children}
        </DataContext.Provider>
    );
};

export const useData = () => {
    const context = useContext(DataContext);
    if (context === undefined) {
        throw new Error('useData must be used within a DataProvider');
    }
    return context;
};

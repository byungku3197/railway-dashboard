import { useMemo, useState, useEffect } from 'react';
import { useData } from '../context/DataContext';
import { useLanguage } from '../context/LanguageContext';
import { Card, CardHeader, CardTitle, CardContent, Button } from '../components/ui-components';
import {
    ComposedChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Line, BarChart, Cell, Area
} from 'recharts';
import { cn, downloadCSV, normalizeTeamId } from '../lib/utils';
import { ArrowUp, ArrowDown } from 'lucide-react';
import type { GradeKey, MmAllocation } from '../types';

const CustomTooltip = ({ active, payload, label, formatter }: any) => {
    if (active && payload && payload.length) {
        return (
            <div className="bg-white/80 backdrop-blur-md border border-white/30 rounded-2xl shadow-[0_8px_32px_0_rgba(31,38,135,0.37)] p-4">
                <p className="text-sm font-black text-slate-800 uppercase tracking-widest mb-2 border-b border-slate-200 pb-1">{label}</p>
                {payload.map((entry: any, index: number) => (
                    <div key={index} className="flex items-center gap-2 mb-1 last:mb-0">
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
                        <span className="text-xs font-bold text-slate-600 uppercase flex-1">{entry.name}</span>
                        <span className="text-xs font-black text-slate-800">
                            {formatter ? formatter(entry.value) : entry.value}
                        </span>
                    </div>
                ))}
            </div>
        );
    }
    return null;
};

import { useAuth } from '../context/AuthContext';
import { useLocation } from 'react-router-dom';

export default function DashboardHomePageV2() {
    const location = useLocation();
    const { currentUser } = useAuth();
    const {
        arCollections, costExpenses, calendar, projects, mmAllocations, rateSettings, teams, goals, updateGoal
    } = useData();
    const { t } = useLanguage();

    const [activeTab, setActiveTab] = useState('TOTAL');
    const [startMonth, setStartMonth] = useState('2026-01');
    const [endMonth, setEndMonth] = useState('2026-12');
    const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' } | null>({ key: 'revenue', direction: 'desc' });
    const [hoveredKPI, setHoveredKPI] = useState<'contract' | 'collection' | null>(null);

    // Sidebar Logo / Navigation Reset Logic
    useEffect(() => {
        // Reset to TOTAL view whenever navigation occurs (key changes)
        // This ensures logo click or re-navigation forced by Link resets the state
        setActiveTab('TOTAL');
        setStartMonth('2026-01');
        setEndMonth('2026-12');
    }, [location.key]);

    // Goal Edit State
    const [isGoalModalOpen, setIsGoalModalOpen] = useState(false);
    const [editContractGoal, setEditContractGoal] = useState(0);
    const [editCollectionGoal, setEditCollectionGoal] = useState(0);

    // Annual Goal Logic
    const targetYear = parseInt(startMonth.split('-')[0]);
    const annualGoal = goals.find(g => g.Year === targetYear) || { Year: targetYear, ContractGoal: 0, CollectionGoal: 0 };

    // Sync state when modal opens (can be optimized but simple effect is fine or just set on click)
    useMemo(() => {
        if (isGoalModalOpen) {
            setEditContractGoal(annualGoal.ContractGoal);
            setEditCollectionGoal(annualGoal.CollectionGoal);
        }
    }, [isGoalModalOpen, annualGoal.ContractGoal, annualGoal.CollectionGoal]);

    const handleSaveGoal = () => {
        updateGoal({
            Year: targetYear,
            ContractGoal: editContractGoal,
            CollectionGoal: editCollectionGoal
        });
        setIsGoalModalOpen(false);
    };

    // The KPI Calculation block that was here has been moved below, after currentChartData is defined.

    const handleSort = (key: string) => {
        setSortConfig(current => {
            if (current?.key === key) {
                return { key, direction: current.direction === 'asc' ? 'desc' : 'asc' };
            }
            return { key, direction: 'desc' };
        });
    };

    const tabs = useMemo(() => [
        { id: 'TOTAL', name: '철도2부 (Total)' },
        ...teams.filter(team => team.TeamID.startsWith('TEAM_') && !['TEAM_OTHER', 'TEAM_COMMON'].includes(team.TeamID)).map(team => ({ id: team.TeamID, name: team.TeamName }))
    ], [teams]);

    const handleExportProfitability = () => {
        // We use projectData from useMemo
        const headers = ['id', 'name', 'revenue', 'expense', 'profit', 'margin', 'status'];
        downloadCSV(projectData, headers, `project_profitability_${new Date().toISOString().split('T')[0]}.csv`);
    };

    // Helper: Is the team RESPONSIBLE for the project expense? (Consolidated view for Lead)
    const isExpenseProject = (p: any, teamId: string) => {
        const leadId = normalizeTeamId(p.LeadSalesTeamID);
        const tid = normalizeTeamId(teamId);
        return leadId === tid && tid !== ''; // Strict match: if you lead it, it's your expense.
    };

    // Helper: Is the team the LEAD (Managed)? 
    const isManagedProject = (p: any, teamId: string) => {
        return isExpenseProject(p, teamId);
    };

    // Helper: Calculate Value of MM based on Project/Category rates
    const calculateMmValue = (m: any, isCost: boolean = false) => {
        const project = projects.find(p => p.ProjectID === m.ProjectID);
        const leadId = normalizeTeamId(project?.LeadSalesTeamID);

        let factor = 1.0;
        if (!isCost && (leadId === 'TEAM_OTHER' || leadId?.startsWith('DEPT_'))) {
            factor = rateSettings?.Surcharges?.find(s => s.Category === 'CROSS_DEPT')?.Factor || 1.3;
        }

        let total = 0;
        const grades: Array<{ key: GradeKey, field: keyof MmAllocation }> = [
            { key: 'EXECUTIVE', field: 'MM_EXECUTIVE' },
            { key: 'DIRECTOR', field: 'MM_DIRECTOR' },
            { key: 'MANAGER', field: 'MM_MANAGER' },
            { key: 'DEPUTY', field: 'MM_DEPUTY' },
            { key: 'ASST', field: 'MM_ASST' },
            { key: 'ASSOCIATE', field: 'MM_ASSOCIATE' },
            { key: 'JUNIOR', field: 'MM_JUNIOR' }
        ];

        grades.forEach(g => {
            const baseRate = rateSettings?.BaseRates?.find(r => r.Grade === g.key)?.BaseRateKRW || 0;
            const mmValue = Number(m[g.field] || 0);
            if (!isNaN(mmValue)) {
                total += mmValue * baseRate * factor;
            }
        });

        return total;
    };

    // Calculate Data Series
    const allMonthlyData = useMemo(() => {
        const start = new Date(startMonth);
        const end = new Date(endMonth);
        const activeMonths = calendar.filter(c => {
            const current = new Date(c.MonthKey);
            return current >= start && current <= end;
        });

        const generateMonthData = (targetTeamId: string) => {
            let cumulativeProfit = 0;
            let cumulativeCollection = 0;
            let cumulativeTotalExpense = 0;
            let cumulativeContract = 0;

            const allMonthlyData = activeMonths.map(mon => {
                const monthName = `${mon.Month}월`;
                const monthKey = mon.MonthKey;

                // Revenue: Collections from projects I'm responsible for
                const ownProjects = projects.filter(p => isExpenseProject(p, targetTeamId));

                // For Contract Sum (Cumulative) - Only count properly assigned projects
                const newContracts = ownProjects.filter(p => p.StartMonth === monthKey);
                const monthlyContract = newContracts.reduce((sum, p) => sum + (p.ContractAmountKRW || 0), 0);
                cumulativeContract += monthlyContract;

                // Collection (Cash Revenue)
                const monthlyCollection = arCollections
                    .filter(c => c.MonthKey === monthKey)
                    .filter(c => {
                        const p = projects.find(op => op.ProjectID === c.ProjectID);
                        if (!p) return false;
                        return isExpenseProject(p, targetTeamId);
                    })
                    .reduce((sum, c) => {
                        const amt = Number(String(c.AmountKRW || 0).replace(/,/g, '')) || 0;
                        const tax = Number(String(c.TaxAmountKRW || 0).replace(/,/g, '')) || 0;
                        return sum + amt + tax;
                    }, 0);

                const relevantMM = mmAllocations.filter(m => m.MonthKey === monthKey);

                // 1. Total Resource (Gross MM Value)
                const teamResourceCost = relevantMM
                    .filter(m => normalizeTeamId(m.TeamID) === normalizeTeamId(targetTeamId))
                    .reduce((sum, m) => sum + calculateMmValue(m, true), 0);

                // 2. Support Revenue (Earning by working for others)
                const supportRevenue = relevantMM
                    .filter(m => normalizeTeamId(m.TeamID) === normalizeTeamId(targetTeamId))
                    .filter(m => {
                        const p = projects.find(proj => proj.ProjectID === m.ProjectID);
                        const leadId = normalizeTeamId(p?.LeadSalesTeamID);
                        const isDivision2Common = leadId === 'TEAM_COMMON' || (p?.ProjectName?.includes('철도2부') && p?.ProjectName?.includes('공통'));
                        return p && !isExpenseProject(p, targetTeamId) && !isDivision2Common;
                    })
                    .reduce((sum, m) => sum + calculateMmValue(m, false), 0);

                // 3. Outbound Labor (Paying for others' work on my projects)
                const outboundLabor = relevantMM
                    .filter(m => normalizeTeamId(m.TeamID) !== normalizeTeamId(targetTeamId))
                    .filter(m => {
                        const p = projects.find(proj => proj.ProjectID === m.ProjectID);
                        return p && isManagedProject(p, targetTeamId);
                    })
                    .reduce((sum, m) => sum + calculateMmValue(m, true), 0);

                // Manual expenses for my projects
                const teamExpenses = costExpenses
                    .filter(e => e.MonthKey === monthKey)
                    .filter(e => {
                        const p = projects.find(proj => proj.ProjectID === e.ProjectID);
                        return p && isManagedProject(p, targetTeamId);
                    });

                const outsource = teamExpenses.reduce((sum, e) => sum + (Number(String(e.OutsourceCostKRW || 0).replace(/,/g, '')) || 0), 0);
                const other = teamExpenses.reduce((sum, e) => sum + (Number(String(e.ExpenseCostKRW || 0).replace(/,/g, '')) || 0), 0);

                // DETAILED REGROUPING (NET LABOR + FULL RESTORE): 
                // Revenue Grouping: Total Revenue for the card's header now only reflects Cash Collection
                // to avoid double-counting Support Revenue which is already a deduction in 'ownLabor'.
                const monthlyRevenue = monthlyCollection;

                // ownLabor = (Gross Labor + Outbound Labor) - Support Revenue
                // Use MM-based cost (teamResourceCost) for all teams to match Resource Tab logic.
                const baseInternalLabor = teamResourceCost;
                const ownLabor = baseInternalLabor + outboundLabor - supportRevenue;

                // Expense Components
                const totalOutsource = outsource;
                const totalOther = other;

                // TOTAL CALCULATION (Management View):
                // Profit = Cash In - Cash Out
                // Total Expense = Net Labor (incl. Support Received) + Outsource + Other
                const monthlyTotalExpense = ownLabor + totalOutsource + totalOther;
                const monthlyProfit = monthlyCollection - monthlyTotalExpense;

                cumulativeProfit += monthlyProfit;
                cumulativeCollection += monthlyCollection;
                cumulativeTotalExpense += monthlyTotalExpense;

                return {
                    name: monthName,
                    monthlyCollection,
                    monthlySupportRevenue: supportRevenue,
                    monthlyRevenue,
                    ownLabor,
                    totalOutsource,
                    outboundLabor,
                    outsource,
                    other: totalOther,
                    monthlyTotalExpense,
                    monthlyProfit,
                    grossRevenue: monthlyCollection + supportRevenue,
                    cumulativeProfit,
                    cumulativeCollection,
                    cumulativeTotalExpense,
                    contract: monthlyContract,
                    cumulativeContract
                };
            });

            return allMonthlyData;
        };

        const result: Record<string, any[]> = {};
        const teamIds = teams.filter(t => t.TeamID.startsWith('TEAM_') && !['TEAM_OTHER', 'TEAM_COMMON'].includes(t.TeamID)).map(t => t.TeamID);

        // Generate for each team
        teamIds.forEach(tid => {
            result[tid] = generateMonthData(tid);
        });

        // Generate TOTAL by Aggregation
        let totalCumulativeProfit = 0;
        let totalCumulativeCollection = 0;
        let totalCumulativeExpense = 0;
        let totalCumulativeContract = 0;

        result['TOTAL'] = activeMonths.map((mon, idx) => {
            const monthName = `${mon.Month}월`;
            // Contract for Total (Global Projects)
            const monthKey = mon.MonthKey;
            const newContracts = projects.filter(p => p.StartMonth === monthKey);
            const monthlyContract = newContracts.reduce((sum, p) => sum + (p.ContractAmountKRW || 0), 0);
            totalCumulativeContract += monthlyContract;

            // Sum from Teams
            let monthlyRevenue = 0;
            let monthlyTotalExpense = 0;
            let monthlyCollection = 0;
            let monthlyProfit = 0;

            // Revenue = Sum of ALL Collections (strictly matching user request for "Collection only")
            const monthlyCollections = arCollections.filter(c => c.MonthKey === monthKey);
            const collectionRevenue = monthlyCollections.reduce((sum, c) => {
                const amt = Number(String(c.AmountKRW || 0).replace(/,/g, '')) || 0;
                const tax = Number(String(c.TaxAmountKRW || 0).replace(/,/g, '')) || 0;
                return sum + amt + tax;
            }, 0);

            monthlyRevenue = collectionRevenue;
            monthlyCollection = collectionRevenue;

            teamIds.forEach(tid => {
                const tData = result[tid][idx];
                monthlyTotalExpense += tData.monthlyTotalExpense;
            });

            monthlyProfit = monthlyRevenue - monthlyTotalExpense;

            totalCumulativeProfit += monthlyProfit;
            totalCumulativeCollection += monthlyCollection;
            totalCumulativeExpense += monthlyTotalExpense;

            return {
                name: monthName,
                monthlyCollection,
                monthlyRevenue,
                monthlyTotalExpense,
                monthlyProfit,
                cumulativeProfit: totalCumulativeProfit,
                cumulativeCollection: totalCumulativeProfit + totalCumulativeExpense, // Consistent Logic: Profit + Expense = Revenue 
                cumulativeTotalExpense: totalCumulativeExpense,
                cumulativeContract: totalCumulativeContract
            };
        });


        // Final consistency check for Total Chart
        result['TOTAL'] = result['TOTAL'].map(d => ({
            ...d,
            cumulativeCollection: d.cumulativeProfit + d.cumulativeTotalExpense
        }));

        return result;
    }, [calendar, arCollections, costExpenses, projects, mmAllocations, rateSettings, teams, startMonth, endMonth]);

    const currentChartData = allMonthlyData[activeTab] || allMonthlyData['TOTAL'];

    // KPI Calculation
    // For KPI, we want "Year-to-Date" or "Total for Selected Period"? 
    // Usually "Annual Goal" compares to "Annual Total". 
    // If the chart shows Jan-Dec, the last point is Annual Total.
    const lastDataPoint = currentChartData[currentChartData.length - 1] || {};
    const currentContractSum = lastDataPoint.cumulativeContract || 0;
    const currentCollectionSum = lastDataPoint.cumulativeCollection || 0; // Note: For Total this is (Profit + Expense) ~ Revenue

    // Percentages
    const contractPct = annualGoal.ContractGoal > 0 ? (currentContractSum / annualGoal.ContractGoal) * 100 : 0;
    const collectionPct = annualGoal.CollectionGoal > 0 ? (currentCollectionSum / annualGoal.CollectionGoal) * 100 : 0;

    const projectData = useMemo(() => {
        const list = projects.map(p => {
            // Revenue for Projects: Should match Total Summary Logic (Net + VAT) for Sales Teams
            let collections = arCollections.filter(c => c.ProjectID === p.ProjectID && c.MonthKey >= startMonth && c.MonthKey <= endMonth).reduce((sum, c) => sum + Number(c.AmountKRW) + Number(c.TaxAmountKRW || 0), 0);

            // HARD FIX: Force D101 (Dept Common) Revenue to 0 per User Request
            if (p.ProjectID === 'D101') collections = 0;

            const revenue = collections;

            const manualCosts = costExpenses
                .filter(e => e.ProjectID === p.ProjectID && e.MonthKey >= startMonth && e.MonthKey <= endMonth)
                .reduce((sum, e) => {
                    const labor = Number(String(e.LaborCostKRW || 0).replace(/,/g, '')) || 0;
                    const outsource = Number(String(e.OutsourceCostKRW || 0).replace(/,/g, '')) || 0;
                    const other = Number(String(e.ExpenseCostKRW || 0).replace(/,/g, '')) || 0;
                    return sum + labor + outsource + other;
                }, 0);

            // 2. MM Allocations (Labor) - REMOVED PER USER REQUEST
            // "Tech team expenses should only be what I input!"
            // To maintain consistency, internal MM-based cost calculation is disabled for project profit view.
            const mmCost = 0;

            const expense = manualCosts + mmCost;
            const profit = revenue - expense;
            const margin = revenue > 0 ? (profit / revenue) * 100 : 0;
            const leadTeamName = teams.find(team => team.TeamID === p.LeadSalesTeamID)?.TeamName || p.LeadSalesTeamID;

            return { id: p.ProjectID, name: p.ProjectName, revenue, expense, profit, margin, status: p.Status, leadTeam: leadTeamName };
        });

        if (sortConfig) {
            list.sort((a: any, b: any) => {
                if (a[sortConfig.key] < b[sortConfig.key]) return sortConfig.direction === 'asc' ? -1 : 1;
                if (a[sortConfig.key] > b[sortConfig.key]) return sortConfig.direction === 'asc' ? 1 : -1;
                return 0;
            });
        }

        return list;
    }, [projects, arCollections, costExpenses, teams, startMonth, endMonth, sortConfig]);

    const teamSummaryData = useMemo(() => {
        return teams.filter(theTeam => theTeam.TeamID.startsWith('TEAM_') && !['TEAM_OTHER', 'TEAM_COMMON'].includes(theTeam.TeamID)).map(team => {
            // 1. Collection (Revenue) - Only for projects led by this team
            const collection = arCollections
                .filter(c => c.MonthKey >= startMonth && c.MonthKey <= endMonth)
                .filter(c => {
                    const p = projects.find(op => op.ProjectID === c.ProjectID);
                    return p && isExpenseProject(p, team.TeamID);
                })
                .reduce((sum, c) => {
                    const amt = Number(String(c.AmountKRW || 0).replace(/,/g, '')) || 0;
                    const tax = Number(String(c.TaxAmountKRW || 0).replace(/,/g, '')) || 0;
                    return sum + amt + tax;
                }, 0);

            // 2. Resource & Support Logic (Matches Input Page Footer)
            const relevantMM = mmAllocations.filter(m => m.MonthKey >= startMonth && m.MonthKey <= endMonth);
            const tid = normalizeTeamId(team.TeamID);

            // Total Resource Cost: Cost of ALL my team members on ANY project
            const teamResourceCost = relevantMM
                .filter(m => normalizeTeamId(m.TeamID) === tid)
                .reduce((sum, m) => sum + calculateMmValue(m, true), 0);
            // Support Revenue: Revenue from my team working on other teams' projects
            const teamSupportRevenue = relevantMM
                .filter(m => normalizeTeamId(m.TeamID) === tid)
                .filter(m => {
                    const p = projects.find(proj => proj.ProjectID === m.ProjectID);
                    const leadId = normalizeTeamId(p?.LeadSalesTeamID);
                    const isDivision2Common = leadId === 'TEAM_COMMON' || (p?.ProjectName?.includes('철도2부') && p?.ProjectName?.includes('공통'));
                    return p && !isExpenseProject(p, team.TeamID) && !isDivision2Common;
                })
                .reduce((sum, m) => sum + calculateMmValue(m, false), 0);

            // Outbound Labor: Cost of OTHER teams working on MY projects
            const outboundLabor = relevantMM
                .filter(m => normalizeTeamId(m.TeamID) !== tid)
                .filter(m => {
                    const p = projects.find(proj => proj.ProjectID === m.ProjectID);
                    return p && isManagedProject(p, team.TeamID);
                })
                .reduce((sum, m) => sum + calculateMmValue(m, true), 0);

            // Manual Expenses (Labor, Outsource, Other) for Managed Projects
            const relevantExpenses = costExpenses.filter(e => e.MonthKey >= startMonth && e.MonthKey <= endMonth);

            const outsource = relevantExpenses
                .filter(e => {
                    const p = projects.find(proj => proj.ProjectID === e.ProjectID);
                    return p && isManagedProject(p, team.TeamID);
                })
                .reduce((sum, e) => sum + (Number(String(e.OutsourceCostKRW || 0).replace(/,/g, '')) || 0), 0);

            const other = relevantExpenses
                .filter(e => {
                    const p = projects.find(proj => proj.ProjectID === e.ProjectID);
                    return p && isManagedProject(p, team.TeamID);
                })
                .reduce((sum, e) => sum + (Number(String(e.ExpenseCostKRW || 0).replace(/,/g, '')) || 0), 0);

            // DETAILED REGROUPING (NET LABOR + FULL RESTORE):
            // totalRevenue = External Collections only (Support is accounted for in ownLabor)
            const totalRevenue = collection;

            // ownLabor = (Gross Labor + Outbound Labor) - Support Revenue
            // Use MM-based cost (teamResourceCost) for all teams to match Resource Tab logic.
            const ownLabor = teamResourceCost + outboundLabor - teamSupportRevenue;

            // Total Expense = Net Own Labor + External Outsource/Other
            const cardExpense = ownLabor + outsource + other;
            const cardProfit = collection - cardExpense;

            return {
                id: team.TeamID,
                name: team.TeamName,
                collection,
                supportRevenue: teamSupportRevenue,
                totalRevenue,
                ownLabor,
                outboundLabor,
                outsource,
                other,
                expense: cardExpense,
                profit: cardProfit,
                revenue: totalRevenue,
                grossRevenue: collection + teamSupportRevenue
            };
        });
    }, [teams, projects, arCollections, mmAllocations, costExpenses, startMonth, endMonth, isExpenseProject, isManagedProject, normalizeTeamId, calculateMmValue]);

    const divisionTotal = useMemo(() => {
        // Division Total Logic: Focus on External Cash Result
        // Revenue: Sum of Collections from ALL Teams
        const revenue = teamSummaryData.reduce((sum, t) => sum + t.collection, 0);

        const commonProjectExpenses = costExpenses.filter(e => {
            const p = projects.find(proj => proj.ProjectID === e.ProjectID);
            const leadId = normalizeTeamId(p?.LeadSalesTeamID);
            return (leadId === 'TEAM_COMMON' || (p?.ProjectName?.includes('철도2부') && p?.ProjectName?.includes('공통'))) &&
                e.MonthKey >= startMonth && e.MonthKey <= endMonth;
        }).reduce((sum, e) => {
            const labor = Number(String(e.LaborCostKRW || 0).replace(/,/g, '')) || 0;
            const outsource = Number(String(e.OutsourceCostKRW || 0).replace(/,/g, '')) || 0;
            const other = Number(String(e.ExpenseCostKRW || 0).replace(/,/g, '')) || 0;
            return sum + labor + outsource + other;
        }, 0);

        const teamExpenseSum = teamSummaryData.reduce((sum, team) => {
            // Net Divisional Expense = Sum of each team's actual payroll + external costs
            // Internal support (supportRevenue vs outboundLabor) offsets to zero across the division.
            return sum + team.ownLabor + team.outsource + team.other;
        }, 0);

        const totalExpense = teamExpenseSum + commonProjectExpenses;

        return {
            name: '철도2부 공통', revenue, expense: totalExpense, profit: revenue - totalExpense
        };
    }, [teamSummaryData, projects, costExpenses, startMonth, endMonth, isManagedProject]);

    return (
        <div className="space-y-6">
            {/* Header / Export */}
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end mb-6 gap-6">
                {/* Left Side: Title & Period Selector */}
                <div className="flex flex-col md:flex-row items-start md:items-center space-y-4 md:space-y-0 md:space-x-6 w-full lg:w-auto">
                    <div>
                        <div className="flex items-center gap-3">
                            <h1 className="text-xl md:text-2xl font-black tracking-tighter text-[#004442] border-l-[6px] md:border-l-[8px] border-[#004442] pl-3 md:pl-4 leading-none">
                                {t.navDashboard}
                            </h1>
                            <span className="bg-emerald-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full animate-pulse">V2 (NEW)</span>
                        </div>
                        <p className="text-[10px] text-slate-400 mt-1 font-black uppercase tracking-[0.2em] pl-3 md:pl-4">Railway Division 2 | V2.0.1 (Released)</p>
                    </div>

                    {/* Period Selector */}
                    <div className="bg-white border-2 border-slate-100 rounded-3xl p-1.5 flex items-center shadow-sm gap-2 w-full md:w-auto overflow-x-auto">
                        <span className="text-[10px] md:text-[11px] font-black text-slate-400 uppercase tracking-widest px-2 md:px-4 border-r border-slate-100 whitespace-nowrap">Period</span>
                        <div className="flex items-center bg-slate-50 rounded-2xl px-2 flex-1 md:flex-initial">
                            <select
                                value={startMonth}
                                onChange={(e) => {
                                    const val = e.target.value;
                                    setStartMonth(val);
                                    if (val > endMonth) setEndMonth(val);
                                }}
                                className="bg-transparent border-none text-xs md:text-sm font-black text-[#004442] focus:ring-0 cursor-pointer py-1 md:py-2"
                            >
                                {[...calendar].filter(m => m.Year === 2026).sort((a, b) => a.MonthKey.localeCompare(b.MonthKey)).map(m => (
                                    <option key={m.MonthKey} value={m.MonthKey}>
                                        '26-{m.Month.toString().padStart(2, '0')}
                                    </option>
                                ))}
                            </select>
                            <span className="text-slate-300 font-bold px-1">~</span>
                            <select
                                value={endMonth}
                                onChange={(e) => {
                                    const val = e.target.value;
                                    setEndMonth(val);
                                    if (val < startMonth) setStartMonth(val);
                                }}
                                className="bg-transparent border-none text-xs md:text-sm font-black text-[#004442] focus:ring-0 cursor-pointer py-1 md:py-2"
                            >
                                {[...calendar].filter(m => m.Year === 2026).sort((a, b) => a.MonthKey.localeCompare(b.MonthKey)).map(m => (
                                    <option key={m.MonthKey} value={m.MonthKey}>
                                        '26-{m.Month.toString().padStart(2, '0')}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>
                </div>

            </div>

            {/* Tabs and KPI Box Container - Single Row */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6">
                {/* Tab Navigation */}
                <div className="flex space-x-1 bg-slate-100 p-1.5 rounded-2xl w-full lg:w-fit shadow-inner ring-1 ring-slate-200 overflow-x-auto h-[60px] items-center">
                    {tabs.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={cn(
                                "flex-1 md:flex-none px-4 md:px-10 py-2.5 md:py-3.5 text-xs md:text-sm font-black rounded-xl transition-all duration-300 transform active:scale-95 whitespace-nowrap h-full flex items-center justify-center",
                                activeTab === tab.id
                                    ? "bg-[#004442] text-white shadow-xl shadow-black/10"
                                    : "text-slate-400 hover:text-[#004442] hover:bg-white/70"
                            )}
                        >
                            {tab.name}
                        </button>
                    ))}
                </div>

                {/* KPI Status Box (Annual Goals) - Stays on the same row, fills right side */}
                {activeTab === 'TOTAL' && (
                    <div className="bg-white border-2 border-slate-100 rounded-2xl p-4 md:p-3 shadow-sm flex items-center justify-end gap-6 h-auto min-h-[60px] lg:flex-1 lg:ml-6 relative">
                        {/* Contract Goal KPI */}
                        <div
                            className="flex items-center gap-4 border-r border-slate-100 pr-6 h-auto cursor-pointer relative group py-1"
                            onMouseEnter={() => setHoveredKPI('contract')}
                            onMouseLeave={() => setHoveredKPI(null)}
                        >
                            <div className="text-right flex flex-col justify-center h-full">
                                <p className="text-xs text-slate-400 font-extrabold uppercase tracking-widest leading-tight mb-1 group-hover:text-slate-600 transition-colors">Annual Contract</p>
                                <div className="flex flex-col items-end justify-center leading-tight">
                                    <span className="text-2xl font-black text-slate-800 tracking-tight leading-none mb-1">{(currentContractSum / 100000000).toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}억</span>
                                    <span className="text-xs font-bold text-slate-400 leading-none">Goal {(annualGoal.ContractGoal / 100000000).toLocaleString()}억</span>
                                </div>
                            </div>
                            <div className={cn("px-2 py-1 rounded-md font-black text-xs border min-w-[3rem] text-center", contractPct >= 100 ? "bg-emerald-50 text-emerald-600 border-emerald-100" : "bg-slate-50 text-slate-500 border-slate-100")}>
                                {contractPct.toFixed(0)}%
                            </div>

                            {/* Hover Overlay for Contract */}
                            {hoveredKPI === 'contract' && (
                                <div className="absolute top-full right-0 mt-4 bg-white/90 backdrop-blur-md border border-slate-100 p-4 rounded-2xl shadow-2xl z-50 w-[240px] animate-in fade-in zoom-in-95 duration-200">
                                    <p className="text-xs font-black text-slate-500 uppercase tracking-widest mb-3 text-center border-b border-slate-100 pb-2">Contract Progress</p>
                                    <div className="h-[120px] w-full">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <BarChart data={[
                                                { name: 'Goal', value: annualGoal.ContractGoal, fill: '#cbd5e1' },
                                                { name: 'Result', value: currentContractSum, fill: '#1e293b' }
                                            ]}>
                                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 900, fill: '#94a3b8' }} />
                                                <Tooltip
                                                    cursor={{ fill: 'transparent' }}
                                                    content={({ active, payload }) => {
                                                        if (active && payload && payload.length) {
                                                            return (
                                                                <div className="bg-slate-900 text-white text-[10px] font-bold px-2 py-1 rounded-lg shadow-xl">
                                                                    {Number(payload[0].value).toLocaleString()}
                                                                </div>
                                                            );
                                                        }
                                                        return null;
                                                    }}
                                                />
                                                <Bar dataKey="value" radius={[4, 4, 0, 0]} barSize={30}>
                                                    {
                                                        [{ name: 'Goal', value: annualGoal.ContractGoal, fill: '#cbd5e1' }, { name: 'Result', value: currentContractSum, fill: '#1e293b' }].map((entry, index) => (
                                                            <Cell key={`cell-${index}`} fill={entry.fill} />
                                                        ))
                                                    }
                                                </Bar>
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </div>
                                    <div className="flex justify-between items-center mt-2 text-[10px] font-bold text-slate-400 px-1">
                                        <span>Target: {(annualGoal.ContractGoal / 100000000).toLocaleString(undefined, { maximumFractionDigits: 0 })}억</span>
                                        <span className="text-slate-800">Current: {(currentContractSum / 100000000).toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}억</span>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Collection Goal KPI */}
                        <div
                            className="flex items-center gap-4 cursor-pointer relative group py-1"
                            onMouseEnter={() => setHoveredKPI('collection')}
                            onMouseLeave={() => setHoveredKPI(null)}
                        >
                            <div className="text-right flex flex-col justify-center h-full">
                                <p className="text-xs text-slate-400 font-extrabold uppercase tracking-widest leading-tight mb-1 group-hover:text-[#004442] transition-colors">Annual Collection</p>
                                <div className="flex flex-col items-end justify-center leading-tight">
                                    <span className="text-2xl font-black text-[#004442] tracking-tight leading-none mb-1">{(currentCollectionSum / 100000000).toFixed(1)}억</span>
                                    <span className="text-xs font-bold text-slate-400 leading-none">Goal {(annualGoal.CollectionGoal / 100000000).toFixed(0)}억</span>
                                </div>
                            </div>
                            <div className={cn("px-2 py-1 rounded-md font-black text-xs border min-w-[3rem] text-center", collectionPct >= 100 ? "bg-emerald-50 text-emerald-600 border-emerald-100" : "bg-slate-50 text-slate-500 border-slate-100")}>
                                {collectionPct.toFixed(0)}%
                            </div>

                            {/* Hover Overlay for Collection */}
                            {hoveredKPI === 'collection' && (
                                <div className="absolute top-full right-0 mt-4 bg-white/90 backdrop-blur-md border border-slate-100 p-4 rounded-2xl shadow-2xl z-50 w-[240px] animate-in fade-in zoom-in-95 duration-200">
                                    <p className="text-xs font-black text-slate-500 uppercase tracking-widest mb-3 text-center border-b border-slate-100 pb-2">Collection Progress</p>
                                    <div className="h-[120px] w-full">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <BarChart data={[
                                                { name: 'Goal', value: annualGoal.CollectionGoal, fill: '#cbd5e1' },
                                                { name: 'Result', value: currentCollectionSum, fill: '#004442' }
                                            ]}>
                                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 900, fill: '#94a3b8' }} />
                                                <Tooltip
                                                    cursor={{ fill: 'transparent' }}
                                                    content={({ active, payload }) => {
                                                        if (active && payload && payload.length) {
                                                            return (
                                                                <div className="bg-slate-900 text-white text-[10px] font-bold px-2 py-1 rounded-lg shadow-xl">
                                                                    {Number(payload[0].value).toLocaleString()}
                                                                </div>
                                                            );
                                                        }
                                                        return null;
                                                    }}
                                                />
                                                <Bar dataKey="value" radius={[4, 4, 0, 0]} barSize={30}>
                                                    {
                                                        [{ name: 'Goal', value: annualGoal.CollectionGoal, fill: '#cbd5e1' }, { name: 'Result', value: currentCollectionSum, fill: '#004442' }].map((entry, index) => (
                                                            <Cell key={`cell-${index}`} fill={entry.fill} />
                                                        ))
                                                    }
                                                </Bar>
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </div>
                                    <div className="flex justify-between items-center mt-2 text-[10px] font-bold text-slate-400 px-1">
                                        <span>Target: {(annualGoal.CollectionGoal / 100000000).toLocaleString(undefined, { maximumFractionDigits: 0 })}억</span>
                                        <span className="text-[#004442]">Current: {(currentCollectionSum / 100000000).toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}억</span>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* EDIT GOAL BUTTON - Only for Admins/Leaders */}
                        {['ADMIN', 'SUB_ADMIN', 'LEADER'].includes(currentUser?.role || '') && (
                            <button
                                onClick={() => setIsGoalModalOpen(true)}
                                className="ml-4 p-2 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
                                title="Edit Annual Goals"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path>
                                </svg>
                            </button>
                        )}
                    </div>
                )}
            </div>

            {/* Goal Edit Modal */}
            {isGoalModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                            <h3 className="text-sm font-black text-slate-800 uppercase tracking-wide">Edit Annual Goals ({targetYear})</h3>
                            <button onClick={() => setIsGoalModalOpen(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                            </button>
                        </div>

                        <div className="p-6 space-y-6">
                            <div className="space-y-2">
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest">
                                    Contract Goal (Total)
                                </label>
                                <div className="relative">
                                    <input
                                        type="number"
                                        value={editContractGoal}
                                        onChange={(e) => setEditContractGoal(Math.max(0, Number(e.target.value)))}
                                        className="w-full text-right font-bold text-lg p-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-slate-800"
                                    />
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">KRW</span>
                                </div>
                                <p className="text-right text-[10px] font-bold text-slate-400">
                                    {(editContractGoal / 100000000).toFixed(2)} 억
                                </p>
                            </div>

                            <div className="space-y-2">
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest">
                                    Collection Goal (Total)
                                </label>
                                <div className="relative">
                                    <input
                                        type="number"
                                        value={editCollectionGoal}
                                        onChange={(e) => setEditCollectionGoal(Math.max(0, Number(e.target.value)))}
                                        className="w-full text-right font-bold text-lg p-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#004442]/20 focus:border-[#004442] transition-all text-[#004442]"
                                    />
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">KRW</span>
                                </div>
                                <p className="text-right text-[10px] font-bold text-slate-400">
                                    {(editCollectionGoal / 100000000).toFixed(2)} 억
                                </p>
                            </div>
                        </div>

                        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-2">
                            <button
                                onClick={() => setIsGoalModalOpen(false)}
                                className="px-4 py-2 text-xs font-bold text-slate-500 hover:bg-white hover:text-slate-700 bg-transparent rounded-lg transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSaveGoal}
                                className="px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-lg shadow-indigo-200 transition-all hover:scale-105 active:scale-95"
                            >
                                Save Changes
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Main Content Area (Tabs) */}
            <div className="min-h-[500px]">
                {activeTab === 'TOTAL' ? (
                    /* DIVISION VIEW: Trend Chart + 3x2 Grid */
                    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        {/* Top Row: Trend Chart (Left) + Total Sum Card (Right) */}
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[450px]">
                            {/* 1. Cumulative Trend Chart */}
                            <Card className="col-span-1 lg:col-span-2 h-full border-slate-200 shadow-xl shadow-slate-100 flex flex-col">
                                <CardHeader className="pb-2 border-b border-slate-50 flex-none">
                                    <CardTitle className="text-2xl md:text-3xl font-black text-slate-800 flex items-center gap-3">
                                        <span className="w-2 md:w-3 h-8 md:h-10 bg-[#004442] rounded-full"></span>
                                        {t.titleCollectionTrend || 'Collection Trend'}
                                    </CardTitle>
                                    <p className="text-xs md:text-sm text-slate-400 font-black uppercase tracking-widest mt-2 px-3 md:px-5">누적 계약 대비 실제 수금액과 지출액의 흐름</p>
                                </CardHeader>
                                <CardContent className="pt-4 md:pt-6 px-2 md:px-6 flex-1 min-h-0">
                                    <div className="h-full w-full">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <ComposedChart data={currentChartData} margin={{ top: 20, right: 10, left: 20, bottom: 5 }}>
                                                <defs>
                                                    <linearGradient id="colorProfit" x1="0" y1="0" x2="0" y2="1">
                                                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.2} />
                                                        <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                                                    </linearGradient>
                                                </defs>
                                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                                <XAxis dataKey="name" fontSize={14} tickLine={false} axisLine={false} tick={{ fill: '#475569', fontWeight: '900' }} interval={0} angle={-30} textAnchor="end" height={60} />
                                                <YAxis
                                                    domain={['auto', 'auto']}
                                                    fontSize={13}
                                                    tickLine={false}
                                                    axisLine={false}
                                                    tickFormatter={(v) => `${Number((v / 1000000).toFixed(0)).toLocaleString()} `}
                                                    tick={{ fill: '#475569', fontWeight: '900' }}
                                                />
                                                <Tooltip content={<CustomTooltip />} formatter={(val: any) => `₩${Number(val).toLocaleString()}`} />
                                                <Legend verticalAlign="top" align="right" height={60} iconType="circle" wrapperStyle={{ fontSize: '10px', fontWeight: '900', textTransform: 'uppercase', paddingBottom: '10px' }} />

                                                <Line type="monotone" dataKey="cumulativeCollection" name="누적 수금" stroke="#004442" strokeWidth={3} dot={{ r: 3, fill: '#004442' }} activeDot={{ r: 5 }} />
                                                <Line type="monotone" dataKey="cumulativeTotalExpense" name={t.totalExpense} stroke="#ef4444" strokeWidth={3} dot={{ r: 3, fill: '#ef4444' }} activeDot={{ r: 5 }} />
                                                <Area type="monotone" dataKey="cumulativeProfit" name={t.netProfit} stroke="#c4d600" fillOpacity={1} fill="url(#colorProfit)" strokeWidth={4} />
                                                <Line type="monotone" dataKey="cumulativeContract" name={t.legendContract} stroke="#94a3b8" strokeWidth={3} dot={{ r: 3, fill: '#94a3b8' }} activeDot={{ r: 5 }} />
                                            </ComposedChart>
                                        </ResponsiveContainer>
                                    </div>
                                </CardContent>
                            </Card>

                            {/* 2. Total Sum Card */}
                            <Card className="col-span-1 bg-[#004442] text-white shadow-2xl shadow-black/20 border-none ring-[12px] ring-white transform hover:-translate-y-1 transition-transform duration-300 h-full flex flex-col justify-between">
                                <div>
                                    <CardHeader className="p-6 pb-2">
                                        <CardTitle className="text-xs md:text-sm font-black text-emerald-300 uppercase tracking-[0.2em]">{t.appTitle} Total SUM</CardTitle>
                                    </CardHeader>
                                    <CardContent className="p-4 md:p-5 pt-1">
                                        <div className="space-y-4">
                                            <div className="flex flex-col space-y-4">
                                                <div>
                                                    <p className="text-xs md:text-base text-indigo-200 font-bold opacity-80 mb-2 uppercase">{t.totalRevenue}</p>
                                                    <p className="text-4xl md:text-6xl font-black break-words">₩{(divisionTotal.revenue / 1000000).toLocaleString(undefined, { maximumFractionDigits: 0 })}<span className="text-xl ml-1">M</span></p>
                                                </div>
                                                <div className="text-right">
                                                    <p className="text-xs md:text-base text-indigo-200 font-bold opacity-80 mb-2 uppercase">{t.totalExpense}</p>
                                                    <p className="text-2xl md:text-4xl font-bold text-indigo-100">₩{(divisionTotal.expense / 1000000).toLocaleString(undefined, { maximumFractionDigits: 0 })}M</p>
                                                </div>
                                            </div>

                                            {/* Restored Net Profit for Total */}
                                            <div className="flex justify-between items-center border-t border-white/10 pt-6 mt-4">
                                                <p className="text-sm md:text-lg text-indigo-100 font-black uppercase">{t.netProfit}</p>
                                                <p className="text-3xl md:text-5xl font-black text-white">₩{(divisionTotal.profit / 1000000).toLocaleString(undefined, { maximumFractionDigits: 0 })}M</p>
                                            </div>
                                        </div>
                                    </CardContent>
                                </div>
                            </Card>
                        </div>


                        {/* 3. Team Summary Grid (Bottom Row) */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                            {teamSummaryData.map((team, idx) => {
                                return (
                                    <Card key={idx} className="hover:shadow-2xl hover:border-[#004442]/30 transition-all duration-300 group cursor-default h-full border-slate-100 flex flex-col justify-between">
                                        <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between space-y-0 relative overflow-hidden">
                                            <div className="absolute top-0 left-0 w-1 h-full bg-[#004442]"></div>
                                            <CardTitle className="text-xl md:text-2xl font-black text-slate-700 uppercase tracking-tighter group-hover:text-[#004442] transition-colors leading-none pl-2">
                                                {team.name}
                                            </CardTitle>
                                        </CardHeader>
                                        <CardContent className="p-4 pt-2">
                                            <div className="space-y-4">
                                                {/* Detailed Breakdown */}
                                                <div className="space-y-3">

                                                    {/* REVENUE SECTION (Compact Grid) */}
                                                    <div className="border-2 border-slate-100 rounded-2xl overflow-hidden mb-4">
                                                        <div className="bg-slate-50 px-3 py-2.5 text-center border-b-2 border-slate-100">
                                                            <span className="text-lg font-black text-slate-700 uppercase tracking-widest leading-none block">수금</span>
                                                        </div>
                                                        <div className="bg-white px-3 py-6 flex justify-center items-center transition-colors">
                                                            <span className="text-4xl font-black text-[#004442] tracking-tight">
                                                                ₩{(team.collection / 1000000).toLocaleString(undefined, { maximumFractionDigits: 0 })}M
                                                            </span>
                                                        </div>

                                                    </div>

                                                    {/* EXPENSE SECTION (Compact Grid) */}
                                                    <div className="border-2 border-slate-100 rounded-2xl overflow-hidden">
                                                        <div className="bg-slate-50 px-3 py-2.5 text-center border-b-2 border-slate-100">
                                                            <span className="text-lg font-black text-slate-700 uppercase tracking-widest leading-none block">지출</span>
                                                        </div>
                                                        <div className="flex flex-col divide-y-2 divide-slate-100 bg-white">
                                                            <div className="px-4 py-2 flex justify-between items-center hover:bg-slate-50 transition-colors">
                                                                <span className="text-sm text-slate-600 font-bold">인건비</span>
                                                                <span className="text-base font-black text-slate-700">
                                                                    ₩{(team.ownLabor / 1000000).toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}M
                                                                </span>
                                                            </div>
                                                            <div className="px-4 py-2 flex justify-between items-center hover:bg-slate-50 transition-colors">
                                                                <span className="text-sm text-slate-600 font-bold">외주/지원</span>
                                                                <span className="text-base font-bold text-slate-500">
                                                                    ₩{(team.outsource / 1000000).toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}M
                                                                </span>
                                                            </div>
                                                            <div className="px-4 py-2 flex justify-between items-center hover:bg-slate-50 transition-colors">
                                                                <span className="text-sm text-slate-600 font-bold">기타</span>
                                                                <span className="text-base font-bold text-slate-500">
                                                                    ₩{(team.other / 1000000).toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}M
                                                                </span>
                                                            </div>
                                                        </div>
                                                        <div className="bg-rose-50/30 px-4 py-3 border-t-2 border-slate-100 flex justify-between items-center">
                                                            <span className="text-base font-bold text-rose-700 uppercase tracking-wider">Total</span>
                                                            <span className="text-2xl font-black text-rose-600">
                                                                ₩{(team.expense / 1000000).toLocaleString(undefined, { maximumFractionDigits: 0 })}M
                                                            </span>
                                                        </div>
                                                    </div>

                                                    {/* PROFIT SECTION */}
                                                    <div className="flex flex-col items-end pt-2 border-t border-slate-100/50">
                                                        <span className="text-slate-500 font-bold text-base uppercase tracking-wider mb-1">결산액</span>
                                                        <span className={cn("font-black text-2xl md:text-4xl whitespace-nowrap leading-none", team.profit >= 0 ? "text-emerald-600" : "text-rose-600")}>
                                                            ₩{(team.profit / 1000000).toLocaleString(undefined, { maximumFractionDigits: 0 })}M
                                                        </span>
                                                    </div>
                                                </div>

                                                <div className="flex justify-end mt-2">
                                                    <div className={cn(
                                                        "px-3 py-1 rounded-lg text-sm font-black",
                                                        team.grossRevenue > 0 && (team.profit / team.grossRevenue) >= 0.2 ? "bg-emerald-50 text-emerald-700" : "bg-slate-50 text-slate-500"
                                                    )}>
                                                        이익률 {team.grossRevenue > 0 ? ((team.profit / team.grossRevenue) * 100).toFixed(0) : 0}%
                                                    </div>
                                                </div>
                                            </div>
                                        </CardContent>
                                    </Card>
                                )
                            })}
                        </div>
                    </div>
                ) : (
                    /* TEAM VIEW: Detailed Analytics for Selected Team */
                    <div className="animate-in fade-in slide-in-from-right-4 duration-500">
                        <Card className="border-slate-200 shadow-xl shadow-slate-100 overflow-hidden">
                            <CardHeader className="bg-slate-50/50 border-b border-slate-100 flex flex-row items-center justify-between p-10">
                                <div>
                                    <CardTitle className="text-4xl font-black text-slate-800">팀 {tabs.find(t => t.id === activeTab)?.name} Analytics</CardTitle>
                                    <p className="text-sm text-slate-400 mt-2 font-black uppercase tracking-widest">{t.chartTitle}</p>
                                </div>
                                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 text-center min-w-[180px]">
                                    <p className="text-xs text-slate-400 font-black uppercase tracking-widest mb-1.5">YTD Profit Margin</p>
                                    {(() => {
                                        const team = teamSummaryData.find(ts => ts.id === activeTab);
                                        const margin = team?.grossRevenue ? (team.profit / team.grossRevenue) * 100 : 0;
                                        return (
                                            <p className={cn("text-4xl font-black", margin >= 20 ? "text-emerald-600" : "text-amber-600")}>
                                                {margin.toFixed(1)}%
                                            </p>
                                        );
                                    })()}
                                </div>
                            </CardHeader>
                            <CardContent className="p-10 space-y-12">
                                <div className="h-[450px] w-full">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <ComposedChart data={currentChartData} margin={{ top: 20, right: 30, left: 40, bottom: 5 }}>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                            <XAxis dataKey="name" fontSize={18} tickLine={false} axisLine={false} tick={{ fill: '#475569', fontWeight: '900' }} />
                                            <YAxis fontSize={15} tickLine={false} axisLine={false} tickFormatter={(v) => `${Number((v / 1000000).toFixed(0)).toLocaleString()} M`} tick={{ fill: '#475569', fontWeight: '900' }} />
                                            <Tooltip content={<CustomTooltip />} formatter={(v: any) => `₩${Number(v).toLocaleString()}`} />
                                            <Legend verticalAlign="top" align="right" height={60} wrapperStyle={{ fontSize: '13px', fontWeight: '900', textTransform: 'uppercase' }} />

                                            <Bar stackId="team_rev" dataKey="monthlyCollection" name="수금 (COLLECTION)" fill="#004442" radius={[6, 6, 0, 0]} maxBarSize={65} />
                                            {/* monthlySupportRevenue removed from chart per user request to show only collection */}
                                            <Bar stackId="team_exp" dataKey="ownLabor" name="인건비 (LABOR)" fill="#fca5a5" maxBarSize={65} />
                                            <Bar stackId="team_exp" dataKey="outsource" name={t.legendOutsource} fill="#fdba74" maxBarSize={65} />
                                            <Bar stackId="team_exp" dataKey="other" name={t.legendExpense} fill="#fde047" radius={[6, 6, 0, 0]} maxBarSize={65} />
                                        </ComposedChart>
                                    </ResponsiveContainer>
                                </div>

                                <div className="overflow-x-auto border-2 border-slate-100 rounded-3xl shadow-sm">
                                    <table className="w-full text-base text-left border-collapse table-fixed">
                                        <thead className="bg-slate-50 text-slate-500 font-black uppercase tracking-widest text-sm md:text-base">
                                            <tr className="border-b-2 border-slate-200">
                                                <th rowSpan={2} className="w-[10%] px-2 py-5 border-r-2 border-slate-100 bg-slate-50 text-center">{t.tableMonth || "Month"}</th>

                                                <th rowSpan={2} className="w-[16%] px-2 py-5 border-r-2 border-slate-100 bg-[#e0f2f1] text-[#004442] border-b-2 border-slate-200 text-center">
                                                    수금
                                                </th>

                                                {/* EXPENSE GROUP */}
                                                <th colSpan={4} className="px-4 py-4 text-center border-r-2 border-slate-100 bg-slate-100 text-slate-600 border-b-2 border-slate-200">
                                                    지출
                                                </th>

                                                <th rowSpan={2} className="w-[18%] px-4 py-5 text-center bg-slate-50">결산액</th>
                                            </tr>
                                            <tr className="border-b-2 border-slate-200">
                                                {/* Expense Sub-headers */}
                                                <th className="w-[14%] px-2 py-4 text-center border-r-2 border-slate-100 text-slate-600 font-bold whitespace-nowrap transition-colors">인건비</th>
                                                <th className="w-[14%] px-2 py-4 text-center border-r-2 border-slate-100 text-slate-500 whitespace-nowrap transition-colors">외주/지원</th>
                                                <th className="w-[14%] px-2 py-4 text-center border-r-2 border-slate-100 text-slate-500 whitespace-nowrap transition-colors">기타</th>
                                                <th className="w-[14%] px-2 py-4 text-center border-r-2 border-slate-100 bg-slate-50 text-slate-600 font-bold whitespace-nowrap transition-colors">합계 (Total)</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {currentChartData.map((m, idx) => {
                                                const totalExpense = m.ownLabor + m.outsource + m.other;
                                                const profit = m.monthlyCollection - totalExpense;
                                                return (
                                                    <tr key={idx} className="border-b-2 border-slate-50 hover:bg-slate-50/80 transition-colors group">
                                                        <td className="px-2 py-6 text-center font-black text-slate-700 text-lg">{m.name}</td>
                                                        <td className="px-4 py-6 text-right font-black text-[#004442] text-xl border-r-2 border-slate-100">₩{m.monthlyCollection.toLocaleString()}</td>
                                                        <td className="px-4 py-6 text-right font-bold text-slate-700 bg-rose-50/10 text-lg">₩{m.ownLabor.toLocaleString()}</td>
                                                        <td className="px-4 py-6 text-right font-bold text-slate-700 border-l-2 border-slate-100 text-lg transition-colors">₩{m.outsource.toLocaleString()}</td>
                                                        <td className="px-4 py-6 text-right font-bold text-slate-700 text-lg transition-colors">₩{m.other.toLocaleString()}</td>
                                                        <td className="px-4 py-6 text-right bg-slate-50 font-black text-rose-600 border-l-2 border-slate-100 text-xl transition-colors">
                                                            ₩{totalExpense.toLocaleString()}
                                                        </td>
                                                        <td className={cn(
                                                            "px-4 py-6 text-right font-black border-l-2 border-slate-100 text-2xl",
                                                            profit >= 0 ? "text-emerald-700" : "text-rose-700"
                                                        )}>
                                                            ₩{profit.toLocaleString()}
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                )}
            </div>

            {/* Persistent Bottom Section: Project Profitability Analysis */}
            <Card className="border-slate-200 shadow-xl shadow-slate-100 mt-8 mb-12">
                <CardHeader className="p-10 pb-6 border-b border-slate-50 flex flex-row items-center justify-between">
                    <div>
                        <CardTitle className="text-3xl font-black text-slate-800">
                            <span className="md:hidden">전체 프로젝트 수익 분석</span>
                            <span className="hidden md:inline">팀 {t.titleTeamProfitability}</span>
                        </CardTitle>
                        <p className="text-sm text-slate-400 mt-2 font-black uppercase tracking-widest">Bottom-up project logic spanning all division teams</p>
                    </div>
                    <Button variant="secondary" onClick={handleExportProfitability} className="hidden md:inline-flex shadow-sm border border-[#004442]/20 font-black bg-white hover:bg-emerald-50 text-[#004442]">
                        팀 {t.btnExport || 'Export'} (CSV)
                    </Button>
                </CardHeader>
                <CardContent className="p-0"> {/* Removed padding for scroll area */}
                    <div className="overflow-y-auto max-h-[460px] custom-scrollbar"> {/* Fixed height for ~5-6 rows */}
                        <table className="w-full text-sm text-left border-collapse sticky-header">
                            <thead className="sticky top-0 z-10 bg-slate-50 shadow-sm">
                                <tr className="text-slate-500 text-xs md:text-sm font-black uppercase tracking-widest border-b-2">
                                    <th className="px-2 md:px-8 py-6 w-20 md:w-44 cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => handleSort('id')}>
                                        <div className="flex items-center gap-1">CODE {sortConfig?.key === 'id' && (sortConfig.direction === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />)}</div>
                                    </th>
                                    <th className="px-2 md:px-8 py-6 min-w-[120px] md:min-w-[320px] cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => handleSort('name')}>
                                        <div className="flex items-center gap-1">{t.tableName} {sortConfig?.key === 'name' && (sortConfig.direction === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />)}</div>
                                    </th>
                                    <th className="hidden md:table-cell px-2 md:px-8 py-6 min-w-[100px] cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => handleSort('leadTeam')}>
                                        <div className="flex items-center gap-1">LEAD TEAM {sortConfig?.key === 'leadTeam' && (sortConfig.direction === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />)}</div>
                                    </th>
                                    <th className="hidden md:table-cell px-2 md:px-8 py-6 text-right whitespace-nowrap cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => handleSort('revenue')}>
                                        <div className="flex items-center justify-end gap-1">{t.totalRevenue} {sortConfig?.key === 'revenue' && (sortConfig.direction === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />)}</div>
                                    </th>
                                    <th className="hidden md:table-cell px-2 md:px-8 py-6 text-right whitespace-nowrap cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => handleSort('expense')}>
                                        <div className="flex items-center justify-end gap-1">{t.totalExpense} {sortConfig?.key === 'expense' && (sortConfig.direction === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />)}</div>
                                    </th>
                                    <th className="px-2 md:px-8 py-6 text-right whitespace-nowrap cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => handleSort('profit')}>
                                        <div className="flex items-center justify-end gap-1">{t.netProfit} {sortConfig?.key === 'profit' && (sortConfig.direction === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />)}</div>
                                    </th>
                                    <th className="px-2 md:px-8 py-6 text-center whitespace-nowrap cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => handleSort('margin')}>
                                        <div className="flex items-center justify-center gap-1">Margin % {sortConfig?.key === 'margin' && (sortConfig.direction === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />)}</div>
                                    </th>
                                    <th className="hidden md:table-cell px-2 md:px-8 py-6 text-center whitespace-nowrap cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => handleSort('status')}>
                                        <div className="flex items-center justify-center gap-1">Status {sortConfig?.key === 'status' && (sortConfig.direction === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />)}</div>
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {projectData.map((p, idx) => (
                                    <tr key={idx} className="border-b border-slate-50 hover:bg-slate-50/80 transition-colors group">
                                        <td className="px-2 md:px-8 py-5 font-black text-slate-400 text-xs md:text-sm whitespace-nowrap">{p.id}</td>
                                        <td className="px-2 md:px-8 py-5 font-bold text-slate-800 group-hover:text-[#004442] transition-colors leading-relaxed max-w-[120px] md:max-w-none truncate text-sm md:text-lg">{p.name}</td>
                                        <td className="hidden md:table-cell px-2 md:px-8 py-5 text-slate-500 font-bold whitespace-nowrap text-sm">{p.leadTeam}</td>
                                        <td className="hidden md:table-cell px-2 md:px-8 py-5 text-right font-medium text-[#004442] whitespace-nowrap text-base">₩{p.revenue.toLocaleString()}</td>
                                        <td className="hidden md:table-cell px-2 md:px-8 py-5 text-right font-medium text-rose-400 whitespace-nowrap text-base">₩{p.expense.toLocaleString()}</td>
                                        <td className={cn("px-2 md:px-8 py-5 text-right font-black whitespace-nowrap text-base md:text-2xl", p.profit >= 0 ? "text-emerald-600" : "text-rose-600")}>
                                            ₩{p.profit.toLocaleString()}
                                        </td>
                                        <td className="px-2 md:px-8 py-5 text-center">
                                            <span className={cn(
                                                "px-2 md:px-4 py-2 rounded-full text-xs md:text-sm font-black shadow-sm",
                                                p.margin < 15 ? "bg-red-100 text-red-700" : p.margin < 25 ? "bg-amber-100 text-amber-700" : "bg-green-100 text-green-700"
                                            )}>
                                                {p.margin.toFixed(1)}%
                                            </span>
                                        </td>
                                        <td className="px-8 py-5 text-center">
                                            <span className={cn(
                                                "px-3 py-1.5 rounded-lg text-xs font-black tracking-tighter uppercase",
                                                p.status === 'COMPLETED' ? "bg-slate-200 text-slate-700" : "bg-blue-100 text-blue-700"
                                            )}>
                                                {p.status}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}

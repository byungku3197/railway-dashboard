import { useMemo, useState } from 'react';
import { useData } from '../context/DataContext';
import { useLanguage } from '../context/LanguageContext';
import { Card, CardHeader, CardTitle, CardContent, Button } from '../components/ui-components';
import {
    ComposedChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Line, BarChart, Cell, Area, AreaChart
} from 'recharts';
import { cn, downloadCSV } from '../lib/utils';
import { ArrowUp, ArrowDown } from 'lucide-react';

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



export default function DashboardHomePage() {
    // const navigate = useNavigate(); // Removed for V1 Purity
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
        ...teams.filter(t => t.TeamID.startsWith('TEAM_') && !['TEAM_OTHER', 'TEAM_COMMON'].includes(t.TeamID)).map(t => ({ id: t.TeamID, name: t.TeamName }))
    ], [teams]);

    const handleExportProfitability = () => {
        // We use projectData from useMemo
        const headers = ['id', 'name', 'revenue', 'expense', 'profit', 'margin', 'status'];
        downloadCSV(projectData, headers, `project_profitability_${new Date().toISOString().split('T')[0]}.csv`);
    };

    // Helper: Calculate Value of MM based on Project/Category rates
    const calculateMmValue = (m: any, isCost: boolean = false) => {
        const project = projects.find(p => p.ProjectID === m.ProjectID);
        const category = m.Category || project?.Category || 'INTERNAL';
        // If isCost is true, ignore surcharge (Factor = 1). Otherwise use settings.
        const factor = isCost ? 1 : (rateSettings.Surcharges.find(s => s.Category === category)?.Factor || 1);
        let total = 0;
        const grades: Array<'MM_EXECUTIVE' | 'MM_DIRECTOR' | 'MM_MANAGER' | 'MM_DEPUTY' | 'MM_ASST' | 'MM_ASSOCIATE' | 'MM_JUNIOR'> = [
            'MM_EXECUTIVE', 'MM_DIRECTOR', 'MM_MANAGER', 'MM_DEPUTY', 'MM_ASST', 'MM_ASSOCIATE', 'MM_JUNIOR'
        ];
        grades.forEach(g => {
            const gradeKey = g.replace('MM_', '') as any;
            const baseRate = rateSettings.BaseRates.find(r => r.Grade === gradeKey)?.BaseRateKRW || 0;
            total += Number(m[g] || 0) * Number(baseRate) * Number(factor);
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

            return activeMonths.map(mon => {
                const monthName = `${mon.Month}월`;
                const monthKey = mon.MonthKey;

                // Filter Contract (Cumulative)
                const newContracts = projects.filter(p => p.StartMonth === monthKey && (targetTeamId === 'TOTAL' || p.LeadSalesTeamID === targetTeamId));
                const monthlyContract = newContracts.reduce((sum, p) => sum + (p.ContractAmountKRW || 0), 0);
                cumulativeContract += monthlyContract;

                let monthlyRevenue = 0;
                let monthlyTotalExpense = 0;
                let monthlyCollection = 0; // For Chart Line

                let labor = 0;
                let outsource = 0;
                let other = 0;

                // TEAM LOGIC ONLY (TOTAL IS HANDLED SEPARATELY)
                // All Teams (1~5) now follow "Sales Team" Logic:
                // Revenue = Cash Collection
                // Expense = Internal MM + Outsource + Other
                // Support MM = Deducted from Expense (Cross-charge logic) or Revenue for Support (if we needed it separately, but User wants Collection logic)

                // Expenses - Updated for Cross-Charge
                const teamExpenses = costExpenses.filter(e => {
                    if (e.MonthKey !== monthKey) return false;
                    // 1. Cross-charged TO this team
                    if (e.Category === targetTeamId) return true;
                    // 2. Input BY this team, unless cross-charged AWAY
                    if (e.TeamID === targetTeamId) {
                        return !(e.Category === 'TEAM_1' || e.Category === 'TEAM_2' || e.Category === 'TEAM_3' || e.Category === 'TEAM_4' || e.Category === 'TEAM_5');
                    }
                    return false;
                });
                labor = teamExpenses.reduce((sum, e) => sum + Number(e.LaborCostKRW || 0), 0);
                outsource = teamExpenses.reduce((sum, e) => sum + Number(e.OutsourceCostKRW || 0), 0);
                other = teamExpenses.reduce((sum, e) => sum + Number(e.ExpenseCostKRW || 0), 0);

                // Cross-Charged M/M Logic:
                // ALL TEAMS: Support MM (Category != INTERNAL) is deducted from Expense (or handled as not own expense)
                // ALL TEAMS: Internal MM (Category == INTERNAL) is ADDED to Expense (Labor)

                // 1. Add Cross-Charged MM (Another team supported THIS team)
                const crossChargedMM = mmAllocations.filter(m => m.MonthKey === monthKey && m.Category === targetTeamId);
                labor += crossChargedMM.reduce((sum, m) => sum + calculateMmValue(m, false), 0); // Add to labor cost

                // 2. Add Own Internal MM (My team working on my projects or internal)
                const ownInternalMM = mmAllocations.filter(m =>
                    m.MonthKey === monthKey &&
                    m.TeamID === targetTeamId &&
                    m.Category === 'INTERNAL'
                );
                labor += ownInternalMM.reduce((sum, m) => sum + calculateMmValue(m, true), 0);

                // 3. Deduct Own Support MM (My team working on OTHERS) - Technically this isn't in 'Expense' list yet, so we don't need to deduct if we didn't add it.
                // However, check logic: Did we add it? 'labor' starts from 0 (from costExpenses).
                // So we just don't add own support MM to labor. (Correct)
                // BUT: In previous Sales logic, we had: "DEDUCT Sales Team Support MM". Why?
                // Because costExpenses used to be pure cash expense. MM is separate.
                // Wait, previous logic: "labor -= supportDeduction".
                // Actually, if we never added it, we shouldn't deduct it.
                // Let's stick to: Expense = (Cash Labor) + (Cross-Charged MM IN) + (Own Internal MM).
                // Support MM OUT is REVENUE for the supporting team? No, user said ALL TEAMS COLLECT.
                // So Support MM OUT is just "Not My Expense". It might be "My Revenue" if I bill for it?
                // User said: "Revenue = Collection". So Support MM is NOT Revenue anymore for anyone.
                // It just reduces my capacity (expense) available for my own projects?
                // No, Expense is Cost.
                // So Expense logic:
                // Labor = (Cash Labor if any) + (Own Internal MM) + (Others Supporting Me MM).
                // Correct.

                monthlyTotalExpense = labor + outsource + other;

                // REVENUE LOGIC: All Teams use Collection-based Revenue
                // REVENUE LOGIC: All Teams use Collection-based Revenue
                const targetTeam = teams.find(t => t.TeamID === targetTeamId);
                const targetTeamName = targetTeam ? targetTeam.TeamName : '';

                const shortTeamName = targetTeamName.replace('철도2부 ', ''); // "5팀"
                const veryShortName = shortTeamName.replace('팀', ''); // "5"

                const teamProjects = projects.filter(p => {
                    if (!p.LeadSalesTeamID) return false;
                    const isMatch = p.LeadSalesTeamID === targetTeamId ||
                        p.LeadSalesTeamID === targetTeamId.replace('TEAM_', 'TEAM_0') ||
                        p.LeadSalesTeamID === targetTeamName ||
                        p.LeadSalesTeamID === shortTeamName ||
                        p.LeadSalesTeamID === `${veryShortName}팀` || // Explicitly "5팀"
                        p.LeadSalesTeamID === veryShortName; // "5"


                    return isMatch;
                });

                // Allow collections for ANY project if I collected it?
                // Or only for projects I LEAD?
                // "1 2 3 4 5 all collect". Usually means they input collections.
                // InputDashboardPage: "addCollection" uses "arCollections".
                // arCollections has "ProjectID".
                // If I collect for a project I don't lead, does it count as MY revenue?
                // Previous Sales logic: "teamCollections = arCollections... teamProjects.some..." -> Only projects I lead.
                // If Team 5 collects for a Team 1 project, who gets the credit?
                // Usually the Team that DID the collection action (Team 5).
                // Let's change filter to: Collection WHERE Project.LeadID == Me OR Collection.enteredBy == Me?
                // Collection data doesn't have "TeamID" field directly. It has ProjectID.
                // BUT: We added UUIDs. We don't track WHO entered it in arCollection structure (only ProjectID).
                // Wait, InputDashboardPage filters collections: `arCollections.filter(c => c.ProjectID === project.ProjectID)`.
                // If Team 5 user goes to Team 1 Project and adds collection, it's a collection for that PROJECT.
                // So Revenue belongs to the PROJECT LEADER (Team 1).
                // UNLESS: The "Revenue" should be attributed to the team that *performed* the project?
                // "Now 1 2 3 4 5 all collect" implies they all have projects they LEAD and collect for.
                // So: Revenue = Collections for Projects Led by Team X.

                const teamCollections = arCollections.filter(col => {
                    if (col.MonthKey !== monthKey) return false;
                    return teamProjects.some(p => p.ProjectID === col.ProjectID);
                });


                monthlyRevenue = teamCollections.reduce((sum, c) => sum + Number(c.AmountKRW) + Number(c.TaxAmountKRW || 0), 0); // Use Gross for Revenue
                monthlyCollection = monthlyRevenue;

                const monthlyProfit = monthlyRevenue - monthlyTotalExpense;

                cumulativeProfit += monthlyProfit;
                cumulativeCollection += monthlyCollection;
                cumulativeTotalExpense += monthlyTotalExpense;

                return {
                    name: monthName,
                    labor,
                    outsource,
                    other,
                    monthlyCollection,
                    monthlyRevenue,
                    monthlyTotalExpense,
                    monthlyProfit,
                    cumulativeProfit,
                    cumulativeCollection,
                    cumulativeTotalExpense,
                    cumulativeContract
                };
            });
        };

        const result: Record<string, any[]> = {};
        const teamIds = teams.filter(t => t.TeamID.startsWith('TEAM_')).map(t => t.TeamID);

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

            // REVISED TOTAL LOGIC:
            // Revenue = Sum of ALL Collections (Gross) + ALL Support MM (Revenue) calculation
            const monthlyCollections = arCollections.filter(c => c.MonthKey === monthKey);
            const collectionRevenue = monthlyCollections.reduce((sum, c) => sum + Number(c.AmountKRW) + Number(c.TaxAmountKRW || 0), 0);

            // Add Support MM Revenue (which is stored in mmAllocations but counts as Revenue)
            const monthlySupportMM = mmAllocations.filter(m => {
                if (m.MonthKey !== monthKey) return false;
                const project = projects.find(p => p.ProjectID === m.ProjectID);
                const category = m.Category || project?.Category || 'INTERNAL';
                return category !== 'INTERNAL';
            });
            const supportRevenue = monthlySupportMM.reduce((sum, m) => sum + calculateMmValue(m), 0);

            monthlyRevenue = collectionRevenue + supportRevenue;
            monthlyCollection = monthlyRevenue;

            teamIds.forEach(tid => {
                const tData = result[tid][idx];
                // Sales Revenue logic removed, using total sum above.

                // Tech Team Revenue is NOT included in Total Revenue per user requirement (Total Revenue = Sales Gross)

                monthlyTotalExpense += tData.monthlyTotalExpense;

                // Profit = Sales Revenue - All Expenses
                // Note: tData.monthlyProfit for Tech Team is (TechRevenue - TechExpense).
                // Total Profit = TotalRevenue - TotalExpense.
                // This matches: (SalesRev - SalesExp) + (0 - TechExp) = SalesRev - (SalesExp + TechExp).
                // Since TechRevenue is excluded from Total Revenue, Tech Profit contribution is effectively negative expense.
                // WAIT: User said Total Revenue = Sum of Team 1 & 2.
                // Total Expense = Sum of All Teams.

                monthlyCollection += tData.monthlyCollection; // Only Sales teams have collection
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
        // ... (Keep existing project logic or update? User focused on Team/Total logic.)
        // Project logic seems unrelated to Team Aggregation logic requests.
        // But wait, "Profit is Collection ..?"
        // I will leave Project Calculation as is for now unless asked, 
        // but User's point 4 "수금/이익 누적추이" refers to the main chart.

        const calculateMmValue = (m: any, isCost: boolean = false) => {
            const project = projects.find(p => p.ProjectID === m.ProjectID);
            const category = m.Category || project?.Category || 'INTERNAL';
            const factor = isCost ? 1 : (rateSettings.Surcharges.find(s => s.Category === category)?.Factor || 1);
            let total = 0;
            const grades: Array<'MM_EXECUTIVE' | 'MM_DIRECTOR' | 'MM_MANAGER' | 'MM_DEPUTY' | 'MM_ASST' | 'MM_ASSOCIATE' | 'MM_JUNIOR'> = [
                'MM_EXECUTIVE', 'MM_DIRECTOR', 'MM_MANAGER', 'MM_DEPUTY', 'MM_ASST', 'MM_ASSOCIATE', 'MM_JUNIOR'
            ];
            grades.forEach(g => {
                const gradeKey = g.replace('MM_', '') as any;
                const baseRate = rateSettings.BaseRates.find(r => r.Grade === gradeKey)?.BaseRateKRW || 0;
                total += (m[g] || 0) * baseRate * factor;
            });
            return total;
        };

        const list = projects.map(p => {
            // Revenue for Projects: Should match Total Summary Logic (Net + VAT) for Sales Teams
            // But usually 'Revenue' is Net. However, User compares it to "Collection" which is Net + VAT.
            // So we will use Net + VAT for Revenue here to align with "Total Cumulative Collection".
            let collections = arCollections.filter(c => c.ProjectID === p.ProjectID && c.MonthKey >= startMonth && c.MonthKey <= endMonth).reduce((sum, c) => sum + Number(c.AmountKRW) + Number(c.TaxAmountKRW || 0), 0);
            // Project Profit Logic (Revised per User Request):
            // Revenue: Total Collection (Net + VAT) for the project.
            // Expense:
            //   1. All Teams' Outsource Cost
            //   2. All Teams' Other Expense
            //   3. ONLY Tech Teams' (Team 3,4,5) Labor Cost (MM + Manual Labor)
            //   * Exclude Sales Teams' (Team 1,2) Labor Cost.

            // Project Profit = Collection - (Direct Cost + Internal MM Cost)
            // This seems standard.

            // HARD FIX: Force D101 (Dept Common) Revenue to 0 per User Request
            if (p.ProjectID === 'D101') collections = 0;


            const revenue = collections;

            // 1. Manual Expenses (CostExpenses table)
            const manualCosts = costExpenses
                .filter(e => e.ProjectID === p.ProjectID && e.MonthKey >= startMonth && e.MonthKey <= endMonth)
                .reduce((sum, e) => {
                    const isTechTeam = ['TEAM_3', 'TEAM_4', 'TEAM_5'].includes(e.TeamID);
                    const labor = isTechTeam ? Number(e.LaborCostKRW || 0) : 0; // Only Tech Labor
                    const outsource = Number(e.OutsourceCostKRW || 0);          // All Outsource
                    const other = Number(e.ExpenseCostKRW || 0);                // All Other
                    return sum + labor + outsource + other;
                }, 0);

            // 2. MM Allocations (Labor)
            // USER REQUEST UPDATE:
            // "Tech team expenses should only be what I input!"
            // This applies to Project Profit Analysis as well.
            // Do NOT auto-calculate labor cost from MM. Only use manually entered LaborCost.
            const mmAllocated = mmAllocations
                .filter(m => m.ProjectID === p.ProjectID && m.MonthKey >= startMonth && m.MonthKey <= endMonth)
                .filter(m => ['TEAM_3', 'TEAM_4', 'TEAM_5'].includes(m.TeamID)) // Only Tech MM
                .filter(m => !m.Note?.includes('[Revenue MM]')); // EXCLUDE Revenue MM

            const mmCost = mmAllocated.reduce((sum, m) => sum + calculateMmValue(m, true), 0);

            const expense = manualCosts + mmCost;
            const profit = revenue - expense;
            const margin = revenue > 0 ? (profit / revenue) * 100 : 0;
            const leadTeamName = teams.find(t => t.TeamID === p.LeadSalesTeamID)?.TeamName || p.LeadSalesTeamID; // Get readable name

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
    }, [projects, arCollections, mmAllocations, costExpenses, rateSettings, startMonth, endMonth, sortConfig]);

    const teamSummaryData = useMemo(() => {
        const calculateMmValue = (m: any, isCost: boolean = false) => {
            const project = projects.find(p => p.ProjectID === m.ProjectID);
            const category = m.Category || project?.Category || 'INTERNAL';

            // If isCost is true, factor is always 1 (Base Cost). 
            // Otherwise, use surcharge factor for Revenue.
            const factor = isCost ? 1 : (rateSettings.Surcharges.find(s => s.Category === category)?.Factor || 1);

            let total = 0;
            const grades: Array<'MM_EXECUTIVE' | 'MM_DIRECTOR' | 'MM_MANAGER' | 'MM_DEPUTY' | 'MM_ASST' | 'MM_ASSOCIATE' | 'MM_JUNIOR'> = [
                'MM_EXECUTIVE', 'MM_DIRECTOR', 'MM_MANAGER', 'MM_DEPUTY', 'MM_ASST', 'MM_ASSOCIATE', 'MM_JUNIOR'
            ];
            grades.forEach(g => {
                const gradeKey = g.replace('MM_', '') as any;
                const baseRate = rateSettings.BaseRates.find(r => r.Grade === gradeKey)?.BaseRateKRW || 0;
                total += Number(m[g] || 0) * Number(baseRate) * Number(factor);
            });
            return total;
        };

        return teams.filter(t => t.TeamID.startsWith('TEAM_') && !['TEAM_OTHER', 'TEAM_COMMON'].includes(t.TeamID)).map(t => {
            const isSalesTeam = ['TEAM_1', 'TEAM_2', 'TEAM_3', 'TEAM_4', 'TEAM_5'].includes(t.TeamID);

            // 1. Revenue
            let revenue = 0;
            let grossRevenue = 0;

            if (isSalesTeam) {
                // Sales Team: Revenue = Collection from Projects led by this team
                // Collection = Supply + VAT
                const teamProjects = projects.filter(p => p.LeadSalesTeamID === t.TeamID);
                const collections = arCollections.filter(c => teamProjects.some(p => p.ProjectID === c.ProjectID) && c.MonthKey >= startMonth && c.MonthKey <= endMonth);
                revenue = collections.reduce((sum, c) => sum + Number(c.AmountKRW), 0); // Net
                grossRevenue = collections.reduce((sum, c) => sum + Number(c.AmountKRW) + Number(c.TaxAmountKRW || 0), 0); // Gross
            } else {
                // Tech Team: Revenue = Labor Revenue (MM Income)
                const teamMM = mmAllocations.filter(m => m.TeamID === t.TeamID && m.MonthKey >= startMonth && m.MonthKey <= endMonth);

                // Exclude INTERNAL from Revenue calculation
                const revenueMM = teamMM.filter(m => {
                    const project = projects.find(p => p.ProjectID === m.ProjectID);
                    const category = m.Category || project?.Category || 'INTERNAL';
                    return category !== 'INTERNAL';
                });

                revenue = revenueMM.reduce((sum, m) => sum + calculateMmValue(m), 0);
                grossRevenue = revenue; // Tax not applicable for MM revenue
            }

            // 2. Expense
            // Direct expenses - Updated for Cross-Charge
            const teamExpenses = costExpenses.filter(e => {
                if (e.MonthKey < startMonth || e.MonthKey > endMonth) return false;
                // 1. Cross-charged TO this team
                if (e.Category === t.TeamID) return true;
                // 2. Input BY this team, unless cross-charged AWAY
                if (e.TeamID === t.TeamID) {
                    return !(e.Category === 'TEAM_1' || e.Category === 'TEAM_2');
                }
                return false;
            });
            let labor = teamExpenses.reduce((sum, e) => sum + Number(e.LaborCostKRW || 0), 0);
            const outsource = teamExpenses.reduce((sum, e) => sum + Number(e.OutsourceCostKRW || 0), 0);
            const other = teamExpenses.reduce((sum, e) => sum + Number(e.ExpenseCostKRW || 0), 0);

            // 1. Cross-Charged M/M to Labor Expense (if this is Team 1/2) - Use Revenue Value (Includes Surcharge)
            if (isSalesTeam) {
                // A. Cross-Charged FROM others (My Expense)
                const crossChargedMM = mmAllocations.filter(m => m.Category === t.TeamID && m.MonthKey >= startMonth && m.MonthKey <= endMonth);
                labor += crossChargedMM.reduce((sum, m) => sum + calculateMmValue(m, false), 0);

                // B. Own Internal MM (My Labor Cost) - ADDED per User Request
                const ownMM = mmAllocations.filter(m =>
                    m.TeamID === t.TeamID &&
                    m.MonthKey >= startMonth &&
                    m.MonthKey <= endMonth &&
                    m.Category === 'INTERNAL' // Explicitly Internal
                );
                labor += ownMM.reduce((sum, m) => sum + calculateMmValue(m, true), 0); // Calculate at Cost Rate (true)

                // C. DEDUCT Support MM (External Work) from Expense [User Request]
                // "Expense = Labor + ... - Support Labor"
                // Re-using logic from Revenue Calculation for consistency (Non-Internal)
                const revenueMM_ForDeduction = mmAllocations
                    .filter(m => m.TeamID === t.TeamID && m.MonthKey >= startMonth && m.MonthKey <= endMonth)
                    .filter(m => {
                        const project = projects.find(p => p.ProjectID === m.ProjectID);
                        const category = m.Category || project?.Category || 'INTERNAL';
                        return category !== 'INTERNAL';
                    });

                const supportDeduction = revenueMM_ForDeduction.reduce((sum, m) => sum + calculateMmValue(m), 0);
                labor -= supportDeduction; // Subtract from Labor Expense

            } else {
                // 2. Tech Team: Add OWN MM as Labor Expense
                // Metric: Only include MM entered via Expense Tab. 
                // Collection Tab MM inputs are tagged with "[Revenue MM]" in the Note.
                const ownMM = mmAllocations.filter(m =>
                    m.TeamID === t.TeamID &&
                    m.MonthKey >= startMonth &&
                    m.MonthKey <= endMonth &&
                    !m.Note?.includes('[Revenue MM]')
                );
                labor += ownMM.reduce((sum, m) => sum + calculateMmValue(m, true), 0);
            }

            // Total Expense
            const expense = labor + outsource + other;

            return { name: t.TeamName, id: t.TeamID, revenue, grossRevenue, expense, profit: grossRevenue - expense, labor, outsource, other };
        });
    }, [teams, projects, arCollections, mmAllocations, costExpenses, rateSettings, startMonth, endMonth]);

    const divisionTotal = useMemo(() => {
        // Division Total Logic (User Request):
        // Revenue = Sum of Gross Collection from ALL Teams
        // Expense = Sum of ALL Teams' Calculated Expense

        // Revenue: Sum of Gross Revenue from ALL teams
        const revenue = teamSummaryData.reduce((sum, t) => sum + t.grossRevenue, 0);

        // Expense: Simply sum the 'expense' field of ALL teams
        const expense = teamSummaryData.reduce((sum, t) => sum + t.expense, 0);

        return { name: '철도2부 계', revenue, expense, profit: revenue - expense };
    }, [teamSummaryData]);

    return (
        <div className="space-y-6">
            {/* Header / Export */}
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end mb-6 gap-6">
                {/* Left Side: Title & Period Selector */}
                <div className="flex flex-col md:flex-row items-start md:items-center space-y-4 md:space-y-0 md:space-x-6 w-full lg:w-auto">
                    <div>
                        <h1 className="text-xl md:text-2xl font-black tracking-tighter text-[#004442] border-l-[6px] md:border-l-[8px] border-[#004442] pl-3 md:pl-4 leading-none">
                            {t.navDashboard} <span className="text-xs text-slate-300 align-top">v1.2</span>
                        </h1>
                        <p className="text-[10px] text-slate-400 mt-1 font-black uppercase tracking-[0.2em] pl-3 md:pl-4">Railway Division 2 Performance Suite</p>
                        {/* Buttons Removed for V1 Purity */}
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
                                <p className="text-[10px] text-slate-400 font-extrabold uppercase tracking-widest leading-tight mb-0.5 group-hover:text-slate-600 transition-colors">Annual Contract</p>
                                <div className="flex flex-col items-end justify-center leading-tight">
                                    <span className="text-xl font-black text-slate-800 tracking-tight leading-none mb-0.5">{(currentContractSum / 100000000).toFixed(1)}억</span>
                                    <span className="text-[10px] font-bold text-slate-400 leading-none">Goal {(annualGoal.ContractGoal / 100000000).toFixed(0)}억</span>
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
                                        <span>Target: {(annualGoal.ContractGoal / 100000000).toFixed(0)}억</span>
                                        <span className="text-slate-800">Current: {(currentContractSum / 100000000).toFixed(1)}억</span>
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
                                <p className="text-[10px] text-slate-400 font-extrabold uppercase tracking-widest leading-tight mb-0.5 group-hover:text-[#004442] transition-colors">Annual Collection</p>
                                <div className="flex flex-col items-end justify-center leading-tight">
                                    <span className="text-xl font-black text-[#004442] tracking-tight leading-none mb-0.5">{(currentCollectionSum / 100000000).toFixed(1)}억</span>
                                    <span className="text-[10px] font-bold text-slate-400 leading-none">Goal {(annualGoal.CollectionGoal / 100000000).toFixed(0)}억</span>
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
                                        <span>Target: {(annualGoal.CollectionGoal / 100000000).toFixed(0)}억</span>
                                        <span className="text-[#004442]">Current: {(currentCollectionSum / 100000000).toFixed(1)}억</span>
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
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        {/* 1. Cumulative Trend Chart */}
                        <Card className="h-full border-slate-200 shadow-xl shadow-slate-100">
                            <CardHeader className="pb-2 border-b border-slate-50">
                                <CardTitle className="text-xl md:text-2xl font-black text-slate-800 flex items-center gap-3">
                                    <span className="w-1.5 md:w-2.5 h-6 md:h-8 bg-[#004442] rounded-full"></span>
                                    {t.titleCollectionTrend || 'Collection Trend'}
                                </CardTitle>
                                <p className="text-[10px] md:text-[11px] text-slate-400 font-black uppercase tracking-widest mt-1.5 px-3 md:px-5">누적 계약 대비 실제 수금액과 지출액의 흐름</p>
                            </CardHeader>
                            <CardContent className="pt-4 md:pt-6 px-2 md:px-6">
                                <div className="h-[300px] md:h-[400px] w-full">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <ComposedChart data={currentChartData} margin={{ top: 20, right: 10, left: -20, bottom: 5 }}>
                                            <defs>
                                                <linearGradient id="colorProfit" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.2} />
                                                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                                                </linearGradient>
                                            </defs>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                            <XAxis dataKey="name" fontSize={11} tickLine={false} axisLine={false} tick={{ fill: '#94a3b8', fontWeight: '900' }} interval={0} angle={-30} textAnchor="end" height={50} />
                                            <YAxis
                                                domain={['auto', 'auto']}
                                                fontSize={11}
                                                tickLine={false}
                                                axisLine={false}
                                                tickFormatter={(v) => `${(v / 1000000).toFixed(0)}`}
                                                tick={{ fill: '#94a3b8', fontWeight: '900' }}
                                            />
                                            <Tooltip content={<CustomTooltip />} formatter={(val: any) => `₩${Number(val).toLocaleString()}`} />
                                            <Legend verticalAlign="top" align="right" height={60} iconType="circle" wrapperStyle={{ fontSize: '10px', fontWeight: '900', textTransform: 'uppercase', paddingBottom: '10px' }} />

                                            <Line type="monotone" dataKey="cumulativeCollection" name={t.legendCollection} stroke="#004442" strokeWidth={3} dot={{ r: 3, fill: '#004442' }} activeDot={{ r: 5 }} />
                                            <Line type="monotone" dataKey="cumulativeTotalExpense" name={t.totalExpense} stroke="#ef4444" strokeWidth={3} dot={{ r: 3, fill: '#ef4444' }} activeDot={{ r: 5 }} />
                                            <Area type="monotone" dataKey="cumulativeProfit" name={t.netProfit} stroke="#c4d600" fillOpacity={1} fill="url(#colorProfit)" strokeWidth={4} />
                                            <Line type="monotone" dataKey="cumulativeContract" name={t.legendContract} stroke="#94a3b8" strokeWidth={3} dot={{ r: 3, fill: '#94a3b8' }} activeDot={{ r: 5 }} />
                                        </ComposedChart>
                                    </ResponsiveContainer>
                                </div>
                            </CardContent>
                        </Card>


                        {/* 2. 3x2 Summary Grid */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                            {teamSummaryData.map((team, idx) => {
                                const displayRevenue = team.grossRevenue;
                                const revLabel = "총 누적 수금";

                                return (
                                    <Card key={idx} className="hover:shadow-2xl hover:border-[#004442]/30 transition-all duration-300 group cursor-default h-full border-slate-100 flex flex-col justify-between">
                                        <div>
                                            <CardHeader className="p-6 pb-2 flex flex-row items-center justify-between space-y-0 text-white">
                                                <CardTitle className="text-sm font-black text-slate-500 uppercase tracking-tighter group-hover:text-[#004442] transition-colors leading-none">
                                                    {team.name}
                                                </CardTitle>
                                                <div className="w-1.5 h-1.5 rounded-full bg-[#004442] animate-pulse"></div>
                                            </CardHeader>
                                            <CardContent className="p-4 md:p-5 pt-1">
                                                <div className="space-y-3 md:space-y-4">
                                                    <div className="flex flex-col space-y-2">
                                                        <div className="flex justify-between items-end">
                                                            <div>
                                                                <p className="text-[10px] text-slate-400 font-black uppercase tracking-tight mb-1">{revLabel}</p>
                                                                <p className="text-xl md:text-2xl font-black text-slate-900 border-l-4 border-[#004442] pl-3 leading-tight">₩{(displayRevenue / 1000000).toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}<span className="text-xs md:text-sm ml-0.5 opacity-40">M</span></p>
                                                            </div>
                                                        </div>
                                                        <div className="flex justify-end items-end">
                                                            <div className="text-right">
                                                                <p className="text-[10px] text-slate-400 font-black uppercase tracking-tight mb-1">{t.totalExpense}</p>
                                                                <p className="text-sm md:text-base font-bold text-slate-500">₩{(team.expense / 1000000).toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}M</p>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {/* Restored Net Profit & Margin */}
                                                    <div className="flex justify-between items-center pt-2 border-t border-slate-50">
                                                        <div>
                                                            <p className="text-[10px] text-slate-400 font-black uppercase mb-1">{t.netProfit}</p>
                                                            <p className={cn("text-lg md:text-xl font-black leading-none", team.profit >= 0 ? "text-emerald-600" : "text-rose-600")}>
                                                                ₩{(team.profit / 1000000).toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}M
                                                            </p>
                                                        </div>
                                                        <div className={cn(
                                                            "px-2 py-1 rounded-lg text-[10px] font-black",
                                                            team.revenue > 0 && (team.profit / team.revenue) >= 0.2 ? "bg-emerald-50 text-emerald-700" : "bg-slate-50 text-slate-500"
                                                        )}>
                                                            {team.revenue > 0 ? ((team.profit / team.revenue) * 100).toFixed(0) : 0}%
                                                        </div>
                                                    </div>
                                                </div>
                                            </CardContent>
                                        </div>
                                        <div className="h-16 w-full mt-2">
                                            <ResponsiveContainer width="100%" height="100%">
                                                <AreaChart data={[{ name: 'Start', cumulativeProfit: 0 }, ...(allMonthlyData[team.id] || [])]}>
                                                    <defs>
                                                        <linearGradient id={`colorProfit-${idx}`} x1="0" y1="0" x2="0" y2="1">
                                                            <stop offset="5%" stopColor={team.profit >= 0 ? "#10b981" : "#f43f5e"} stopOpacity={0.3} />
                                                            <stop offset="95%" stopColor={team.profit >= 0 ? "#10b981" : "#f43f5e"} stopOpacity={0} />
                                                        </linearGradient>
                                                    </defs>
                                                    <Area
                                                        type="monotone"
                                                        dataKey="cumulativeProfit"
                                                        baseValue={0}
                                                        stroke={team.profit >= 0 ? "#10b981" : "#f43f5e"}
                                                        fill={`url(#colorProfit-${idx})`}
                                                        strokeWidth={2}
                                                    />
                                                </AreaChart>
                                            </ResponsiveContainer>
                                        </div>
                                    </Card>
                                )
                            })}
                            {/* Cumulative Sum Card */}
                            <Card className="bg-[#004442] text-white shadow-2xl shadow-black/20 border-none ring-[12px] ring-white transform hover:-translate-y-1 transition-transform duration-300 h-full flex flex-col justify-between">
                                <div>
                                    <CardHeader className="p-6 pb-2">
                                        <CardTitle className="text-[11px] font-black text-emerald-300 uppercase tracking-[0.2em]">{t.appTitle} Total SUM</CardTitle>
                                    </CardHeader>
                                    <CardContent className="p-4 md:p-5 pt-1">
                                        <div className="space-y-4">
                                            <div className="flex flex-col space-y-4">
                                                <div>
                                                    <p className="text-[10px] text-indigo-200 font-bold opacity-80 mb-1.5 uppercase">{t.totalRevenue}</p>
                                                    <p className="text-3xl md:text-4xl font-black break-words">₩{(divisionTotal.revenue / 1000000).toLocaleString(undefined, { maximumFractionDigits: 0 })}<span className="text-lg ml-0.5">M</span></p>
                                                </div>
                                                <div className="text-right">
                                                    <p className="text-[10px] text-indigo-200 font-bold opacity-80 mb-1.5 uppercase">{t.totalExpense}</p>
                                                    <p className="text-lg md:text-xl font-bold text-indigo-100">₩{(divisionTotal.expense / 1000000).toLocaleString(undefined, { maximumFractionDigits: 0 })}M</p>
                                                </div>
                                            </div>

                                            {/* Restored Net Profit for Total */}
                                            <div className="flex justify-between items-center border-t border-white/10 pt-4 mt-2">
                                                <p className="text-[11px] text-indigo-100 font-black uppercase">{t.netProfit}</p>
                                                <p className="text-xl md:text-2xl font-black text-white">₩{(divisionTotal.profit / 1000000).toLocaleString(undefined, { maximumFractionDigits: 0 })}M</p>
                                            </div>
                                        </div>
                                    </CardContent>
                                </div>
                                <div className="h-20 w-full mt-4 px-2">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <AreaChart data={[{ name: 'Start', cumulativeProfit: 0 }, ...currentChartData]}>
                                            <defs>
                                                <linearGradient id="colorTotalProfit" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor="#c4d600" stopOpacity={0.3} />
                                                    <stop offset="95%" stopColor="#c4d600" stopOpacity={0} />
                                                </linearGradient>
                                            </defs>
                                            <Area
                                                type="monotone"
                                                dataKey="cumulativeProfit"
                                                baseValue={0}
                                                stroke="#c4d600"
                                                fill="url(#colorTotalProfit)"
                                                strokeWidth={3}
                                            />
                                        </AreaChart>
                                    </ResponsiveContainer>
                                </div>
                            </Card>
                        </div>
                    </div>
                ) : (
                    /* TEAM VIEW: Detailed Analytics for Selected Team */
                    <div className="animate-in fade-in slide-in-from-right-4 duration-500">
                        <Card className="border-slate-200 shadow-xl shadow-slate-100 overflow-hidden">
                            <CardHeader className="bg-slate-50/50 border-b border-slate-100 flex flex-row items-center justify-between p-8">
                                <div>
                                    <CardTitle className="text-3xl font-black text-slate-800">📊 {tabs.find(t => t.id === activeTab)?.name} Analytics</CardTitle>
                                    <p className="text-[11px] text-slate-400 mt-2 font-black uppercase tracking-widest">{t.chartTitle}</p>
                                </div>
                                <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 text-center min-w-[140px]">
                                    <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mb-1">YTD Profit Margin</p>
                                    {(() => {
                                        const t = teamSummaryData.find(ts => ts.id === activeTab);
                                        const margin = t?.revenue ? (t.profit / t.revenue) * 100 : 0;
                                        return (
                                            <p className={cn("text-3xl font-black", margin >= 20 ? "text-emerald-600" : "text-amber-600")}>
                                                {margin.toFixed(1)}%
                                            </p>
                                        );
                                    })()}
                                </div>
                            </CardHeader>
                            <CardContent className="p-8 space-y-12">
                                <div className="h-[400px] w-full">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <ComposedChart data={currentChartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                            <XAxis dataKey="name" fontSize={14} tickLine={false} axisLine={false} tick={{ fill: '#94a3b8', fontWeight: '900' }} />
                                            <YAxis fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v) => `${(v / 1000000).toFixed(0)}M`} tick={{ fill: '#94a3b8', fontWeight: '900' }} />
                                            <YAxis fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v) => `${(v / 1000000).toFixed(0)}M`} tick={{ fill: '#94a3b8', fontWeight: '900' }} />
                                            <Tooltip content={<CustomTooltip />} formatter={(v: any) => `₩${Number(v).toLocaleString()}`} />
                                            <Legend verticalAlign="top" align="right" height={50} wrapperStyle={{ fontSize: '12px', fontWeight: '900', textTransform: 'uppercase' }} />

                                            <Bar dataKey="monthlyRevenue" name={t.totalRevenue} fill="#004442" radius={[6, 6, 0, 0]} maxBarSize={55} />
                                            <Bar stackId="team_exp" dataKey="labor" name={t.legendLabor} fill="#fca5a5" maxBarSize={55} />
                                            <Bar stackId="team_exp" dataKey="outsource" name={t.legendOutsource} fill="#fdba74" maxBarSize={55} />
                                            <Bar stackId="team_exp" dataKey="other" name={t.legendExpense} fill="#fde047" radius={[6, 6, 0, 0]} maxBarSize={55} />
                                        </ComposedChart>
                                    </ResponsiveContainer>
                                </div>

                                <div className="overflow-x-auto border border-slate-100 rounded-2xl shadow-sm">
                                    <table className="w-full text-sm text-left border-collapse">
                                        <thead>
                                            <tr className="bg-slate-50 text-slate-500 text-base font-black uppercase tracking-widest border-b">
                                                <th className="px-8 py-6">{t.tableMonth || "Month"}</th>
                                                <th className="px-8 py-6 text-right">{t.totalRevenue}</th>
                                                <th className="px-8 py-6 text-right border-l border-slate-100">{t.legendLabor} (Inc. MM)</th>
                                                <th className="px-8 py-6 text-right">{t.legendOutsource}</th>
                                                <th className="px-8 py-6 text-right">{t.legendExpense}</th>
                                                <th className="px-8 py-6 text-right border-l border-slate-100">{t.totalExpense}</th>
                                                <th className="px-8 py-6 text-right border-l border-slate-100">{t.netProfit}</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {currentChartData.map((m, idx) => (
                                                <tr key={idx} className="border-b border-slate-50 hover:bg-slate-50/80 transition-colors group">
                                                    <td className="px-8 py-4 font-black text-slate-700">{m.name}</td>
                                                    <td className="px-8 py-4 text-right font-black text-blue-600 group-hover:scale-105 transition-transform origin-right text-base">₩{m.monthlyRevenue.toLocaleString()}</td>
                                                    <td className="px-8 py-4 text-right text-slate-500 border-l border-slate-100">₩{m.labor.toLocaleString()}</td>
                                                    <td className="px-8 py-4 text-right text-slate-500">₩{m.outsource.toLocaleString()}</td>
                                                    <td className="px-8 py-4 text-right text-slate-500">₩{m.other.toLocaleString()}</td>
                                                    <td className="px-8 py-4 text-right font-bold text-slate-500 border-l border-slate-100">₩{m.monthlyTotalExpense.toLocaleString()}</td>
                                                    <td className={cn(
                                                        "px-8 py-4 text-right font-black border-l border-slate-100 text-base",
                                                        m.monthlyProfit >= 0 ? "text-emerald-600" : "text-rose-600"
                                                    )}>
                                                        ₩{m.monthlyProfit.toLocaleString()}
                                                    </td>
                                                </tr>
                                            ))}
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
                        <CardTitle className="text-2xl font-black text-slate-800">
                            <span className="md:hidden">🏢 프로젝트 손익 분석</span>
                            <span className="hidden md:inline">🏢 {t.titleTeamProfitability}</span>
                        </CardTitle>
                        <p className="text-[11px] text-slate-400 mt-2 font-black uppercase tracking-widest">Bottom-up project logic spanning all division teams</p>
                    </div>
                    <Button variant="secondary" onClick={handleExportProfitability} className="hidden md:inline-flex shadow-sm border border-[#004442]/20 font-black bg-white hover:bg-emerald-50 text-[#004442]">
                        📥 {t.btnExport || 'Export'} (CSV)
                    </Button>
                </CardHeader>
                <CardContent className="p-0"> {/* Removed padding for scroll area */}
                    <div className="overflow-y-auto max-h-[460px] custom-scrollbar"> {/* Fixed height for ~5-6 rows */}
                        <table className="w-full text-sm text-left border-collapse sticky-header">
                            <thead className="sticky top-0 z-10 bg-slate-50 shadow-sm">
                                <tr className="text-slate-500 text-[11px] font-black uppercase tracking-widest border-b">
                                    <th className="px-2 md:px-8 py-5 w-20 md:w-44 cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => handleSort('id')}>
                                        <div className="flex items-center gap-1">CODE {sortConfig?.key === 'id' && (sortConfig.direction === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />)}</div>
                                    </th>
                                    <th className="px-2 md:px-8 py-5 min-w-[120px] md:min-w-[320px] cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => handleSort('name')}>
                                        <div className="flex items-center gap-1">{t.tableName} {sortConfig?.key === 'name' && (sortConfig.direction === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />)}</div>
                                    </th>
                                    <th className="hidden md:table-cell px-2 md:px-8 py-5 min-w-[100px] cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => handleSort('leadTeam')}>
                                        <div className="flex items-center gap-1">LEAD TEAM {sortConfig?.key === 'leadTeam' && (sortConfig.direction === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />)}</div>
                                    </th>
                                    <th className="hidden md:table-cell px-2 md:px-8 py-5 text-right whitespace-nowrap cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => handleSort('revenue')}>
                                        <div className="flex items-center justify-end gap-1">{t.totalRevenue} {sortConfig?.key === 'revenue' && (sortConfig.direction === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />)}</div>
                                    </th>
                                    <th className="hidden md:table-cell px-2 md:px-8 py-5 text-right whitespace-nowrap cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => handleSort('expense')}>
                                        <div className="flex items-center justify-end gap-1">{t.totalExpense} {sortConfig?.key === 'expense' && (sortConfig.direction === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />)}</div>
                                    </th>
                                    <th className="px-2 md:px-8 py-5 text-right whitespace-nowrap cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => handleSort('profit')}>
                                        <div className="flex items-center justify-end gap-1">{t.netProfit} {sortConfig?.key === 'profit' && (sortConfig.direction === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />)}</div>
                                    </th>
                                    <th className="px-2 md:px-8 py-5 text-center whitespace-nowrap cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => handleSort('margin')}>
                                        <div className="flex items-center justify-center gap-1">Margin % {sortConfig?.key === 'margin' && (sortConfig.direction === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />)}</div>
                                    </th>
                                    <th className="hidden md:table-cell px-2 md:px-8 py-5 text-center whitespace-nowrap cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => handleSort('status')}>
                                        <div className="flex items-center justify-center gap-1">Status {sortConfig?.key === 'status' && (sortConfig.direction === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />)}</div>
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {projectData.map((p, idx) => (
                                    <tr key={idx} className="border-b border-slate-50 hover:bg-slate-50/80 transition-colors group">
                                        <td className="px-2 md:px-8 py-4 font-black text-slate-400 text-[10px] md:text-xs whitespace-nowrap">{p.id}</td>
                                        <td className="px-2 md:px-8 py-4 font-bold text-slate-800 group-hover:text-[#004442] transition-colors py-5 leading-relaxed max-w-[120px] md:max-w-none truncate">{p.name}</td>
                                        <td className="hidden md:table-cell px-2 md:px-8 py-4 text-slate-500 font-bold whitespace-nowrap text-xs">{p.leadTeam}</td>
                                        <td className="hidden md:table-cell px-2 md:px-8 py-4 text-right font-medium text-[#004442] whitespace-nowrap">₩{p.revenue.toLocaleString()}</td>
                                        <td className="hidden md:table-cell px-2 md:px-8 py-4 text-right font-medium text-rose-400 whitespace-nowrap">₩{p.expense.toLocaleString()}</td>
                                        <td className={cn("px-2 md:px-8 py-4 text-right font-black whitespace-nowrap text-xs md:text-base", p.profit >= 0 ? "text-emerald-600" : "text-rose-600")}>
                                            ₩{p.profit.toLocaleString()}
                                        </td>
                                        <td className="px-2 md:px-8 py-4 text-center">
                                            <span className={cn(
                                                "px-2 md:px-4 py-1.5 rounded-full text-[10px] md:text-[11px] font-black shadow-sm",
                                                p.margin < 15 ? "bg-red-100 text-red-700" : p.margin < 25 ? "bg-amber-100 text-amber-700" : "bg-green-100 text-green-700"
                                            )}>
                                                {p.margin.toFixed(1)}%
                                            </span>
                                        </td>
                                        <td className="px-8 py-4 text-center">
                                            <span className={cn(
                                                "px-3 py-1 rounded-lg text-[10px] font-black tracking-tighter uppercase",
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

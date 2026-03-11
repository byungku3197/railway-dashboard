import { useState, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { useLanguage } from '../context/LanguageContext';
import { Button, Input, Select, Card, CardHeader, CardTitle, CardContent, Label, Tooltip } from '../components/ui-components';
import { cn, uuidv4 } from '../lib/utils';
import type { ProjectMaster, ProjectCategory, InputType } from '../types';

import { useToast } from '../context/ToastContext';

type TabType = 'CONTRACT' | 'COLLECTION' | 'EXPENSE';

export default function InputDashboardPage() {
    const { teamId } = useParams();
    const { currentUser } = useAuth();
    const {
        teams, projects, calendar,
        addCollection, addCostExpense, addMmAllocation, addProject,
        deleteCollection, deleteCostExpense, deleteMmAllocation,
        arCollections, costExpenses, mmAllocations,
        monthCloseControls, rateSettings
    } = useData();
    const { t, language } = useLanguage();

    const GRADE_LABELS: Record<string, { KO: string, EN: string }> = {
        EXECUTIVE: { KO: '임원', EN: 'Executive' },
        DIRECTOR: { KO: '이사', EN: 'Director' },
        MANAGER: { KO: '부장', EN: 'Manager' },
        DEPUTY: { KO: '차장', EN: 'Deputy General Manager' },
        ASST: { KO: '과장', EN: 'Assistant Manager' },
        ASSOCIATE: { KO: '대리', EN: 'Associate' },
        JUNIOR: { KO: '사원', EN: 'Junior' }
    };
    const toast = useToast();

    const currentTeam = teams.find(t => t.TeamID === teamId);

    const [activeTab, setActiveTab] = useState<TabType>('COLLECTION');
    const [monthKey, setMonthKey] = useState('2026-01');

    // Common State
    const [projectId, setProjectId] = useState('');
    const [inputCategory, setInputCategory] = useState<ProjectCategory>('INTERNAL');
    const [note, setNote] = useState('');

    const handleProjectChange = (id: string) => {
        setProjectId(id);
        const p = projects.find(proj => proj.ProjectID === id);
        if (p) {
            if (p) {
                // Auto-set Category logic:
                // If project belongs to another team, default to "Team X Support"
                // Check if LeadSalesTeamID is valid TEAM_X
                const leadTeamId = p.LeadSalesTeamID;
                if (currentTeam?.TeamID && leadTeamId !== currentTeam.TeamID && ['TEAM_1', 'TEAM_2', 'TEAM_3', 'TEAM_4', 'TEAM_5'].includes(leadTeamId)) {
                    setInputCategory(leadTeamId as ProjectCategory);
                } else {
                    setInputCategory(p.Category);
                }
            }
        }
    };
    const [contractData, setContractData] = useState<Partial<ProjectMaster>>({
        ProjectID: '',
        ProjectName: '',
        Client: '',
        ContractAmountKRW: 0,
        Status: 'ACTIVE',
        StartMonth: '2026-01',
        EndMonthPlan: '2026-12'
    });

    // Collection State
    const [supplyAmount, setSupplyAmount] = useState<number | ''>('');
    const [taxAmount, setTaxAmount] = useState<number | ''>('');

    // Expense State
    const [laborCost, setLaborCost] = useState<number | ''>('');
    const [outsourceCost, setOutsourceCost] = useState<number | ''>('');
    const [expenseCost, setExpenseCost] = useState<number | ''>('');

    const [mmGrades, setMmGrades] = useState<Record<string, number>>({
        EXECUTIVE: 0, DIRECTOR: 0, MANAGER: 0, DEPUTY: 0, ASST: 0, ASSOCIATE: 0, JUNIOR: 0
    });
    const totalMm = Object.values(mmGrades).reduce((a, b) => a + b, 0);



    // Derived Info
    const isClosed = monthCloseControls.find(c => c.MonthKey === monthKey && c.TeamID === teamId)?.IsClosed;

    // PERMISSION CHECK
    const canEdit = useMemo(() => {
        if (isClosed) return false;
        if (!currentUser) return false;

        // Admin Roles can edit any team
        if (['ADMIN', 'SUB_ADMIN'].includes(currentUser.role)) return true;

        // Leader can edit ONLY their own team
        if (currentUser.role === 'LEADER') {
            return currentUser.teamId === currentTeam?.TeamID;
        }

        // Others (USER) cannot edit
        return false;
    }, [isClosed, currentUser, currentTeam]);

    const project = projects.find(p => p.ProjectID === projectId);
    const totalCollection = useMemo(() => {
        if (!project) return 0;
        return arCollections
            .filter(c => c.ProjectID === project.ProjectID)
            .reduce((sum, c) => sum + c.AmountKRW, 0); // Sum of Supply Amounts
    }, [arCollections, project]);

    const isOverContract = project && (totalCollection + (Number(supplyAmount) || 0) > project.ContractAmountKRW);

    // Phase 2: Copy from Last Month
    const getPreviousMonthKey = (currentKey: string) => {
        const [y, m] = currentKey.split('-').map(Number);
        if (m === 1) return `${y - 1}-12`;
        return `${y}-${(m - 1).toString().padStart(2, '0')}`;
    };

    const handleCopyPreviousMonth = () => {
        if (isClosed) return toast.error(t.msgClosedMonth);
        const prevMonth = getPreviousMonthKey(monthKey);

        // Find MM for this team in prev month
        const prevMm = mmAllocations.filter(m => m.MonthKey === prevMonth && m.TeamID === teamId);
        // Find Expenses for this team in prev month
        const prevExpenses = costExpenses.filter(e => e.MonthKey === prevMonth && e.TeamID === teamId);

        if (prevMm.length === 0 && prevExpenses.length === 0) {
            return toast.info(`${prevMonth}에 저장된 데이터가 없습니다.`);
        }

        if (window.confirm(`${prevMonth}의 데이터를 현재 월(${monthKey})로 복사하시겠습니까? (기존 데이터와 합쳐집니다.)`)) {
            prevMm.forEach(m => {
                addMmAllocation({
                    ...m,
                    id: uuidv4(),
                    MonthKey: monthKey,
                    Note: `[Copied from ${prevMonth}] ${m.Note || ''}`
                });
            });
            prevExpenses.forEach(e => {
                addCostExpense({
                    ...e,
                    id: uuidv4(),
                    MonthKey: monthKey,
                    Note: `[Copied from ${prevMonth}] ${e.Note || ''}`
                });
            });
            toast.success("복사가 완료되었습니다.");
        }
    };

    // Delete Handlers
    const handleDeleteCollection = (id: string) => {
        if (isClosed) return toast.error(t.msgClosedMonth);
        if (window.confirm("선택하신 [수금 내역(Cash)]만 삭제하시겠습니까?\n\n(주의: 연결된 인건비/지출 내역은 삭제되지 않습니다.\n인건비 내역도 삭제하려면 별도로 삭제해주세요.)")) {
            deleteCollection(id);
            toast.success("수금 내역이 삭제되었습니다.");
        }
    };

    const handleDeleteMmAllocation = (id: string) => {
        if (isClosed) return toast.error(t.msgClosedMonth);
        if (window.confirm("⚠️ 경고: [MM 인건비 내역]을 삭제하려고 합니다.\n\n이 내역을 삭제하면 타 부서(예: 4팀)의 [지출 내역]에서도 즉시 사라집니다.\n\n정말 삭제하시겠습니까? (신중하게 결정해주세요!)")) {
            deleteMmAllocation(id);
            toast.success("MM 인건비 내역이 삭제되었습니다.");
        }
    };

    const handleDeleteCostExpense = (id: string) => {
        if (isClosed) return toast.error(t.msgClosedMonth);
        if (window.confirm("선택하신 [지출 내역(Expense)]을 삭제시겠습니까?\n(삭제 후 복구할 수 없습니다.)")) {
            deleteCostExpense(id);
            toast.success("지출 내역이 삭제되었습니다.");
        }
    };


    // Handlers
    const handleSaveContract = () => {
        // Validation
        if (!contractData.ProjectID || !contractData.ContractAmountKRW) return toast.error(t.msgRequired);
        if (projects.find(p => p.ProjectID === contractData.ProjectID)) return toast.error(t.msgDuplicateID);

        // Auto-fill missing fields if simplified form
        const newProject: ProjectMaster = {
            ...contractData as ProjectMaster,
            LeadSalesTeamID: currentTeam?.TeamID || '', // Default to current team
            Status: 'ACTIVE',
            Category: 'INTERNAL' // Default category for quick entry
        };

        addProject(newProject);
        setContractData({
            ProjectID: '', ProjectName: '', Client: '', ContractAmountKRW: 0,
            Status: 'ACTIVE', StartMonth: '2026-01', EndMonthPlan: '2026-12'
        });
        toast.success(t.msgProjectSaved);
    };

    const handleSaveCollection = () => {
        if (isClosed) return toast.error(t.msgClosedMonth);
        if (!projectId) return toast.error(t.msgSelectProject);

        const hasAmount = (!supplyAmount || Number(supplyAmount) === 0) && (!taxAmount || Number(taxAmount) === 0);
        const hasMM = totalMm > 0;

        if (hasAmount && !hasMM) {
            return toast.error(t.msgRequired);
        }

        try {
            // 1. Save Collection Amount if present
            if (!hasAmount) {
                addCollection({
                    id: uuidv4(),
                    MonthKey: monthKey,
                    ProjectID: projectId,
                    ReceiptDate: new Date().toISOString().split('T')[0],
                    AmountKRW: Number(supplyAmount) || 0,
                    TaxAmountKRW: Number(taxAmount) || 0,
                    DocType: 'OTHER',
                    Note: note
                });
            }

            // 2. MM Saving Removed from here (Moved to Bulk Grid)

            // 2. Save Revenue M/M if present
            if (totalMm > 0) {
                addMmAllocation({
                    id: uuidv4(),
                    MonthKey: monthKey,
                    TeamID: currentTeam?.TeamID || '',
                    ProjectID: projectId,
                    MM: totalMm,
                    MM_EXECUTIVE: mmGrades.EXECUTIVE,
                    MM_DIRECTOR: mmGrades.DIRECTOR,
                    MM_MANAGER: mmGrades.MANAGER,
                    MM_DEPUTY: mmGrades.DEPUTY,
                    MM_ASST: mmGrades.ASST,
                    MM_ASSOCIATE: mmGrades.ASSOCIATE,
                    MM_JUNIOR: mmGrades.JUNIOR,
                    InputType: 'ACTUAL' as InputType,
                    Category: inputCategory,
                    Note: `[Revenue MM] ${note}`
                });
            }

            setSupplyAmount('');
            setTaxAmount('');
            setSupplyAmount('');
            setTaxAmount('');
            setMmGrades({ EXECUTIVE: 0, DIRECTOR: 0, MANAGER: 0, DEPUTY: 0, ASST: 0, ASSOCIATE: 0, JUNIOR: 0 });
            setNote('');
            toast.success(t.msgInputSaved);
        } catch (error) {
            console.error(error);
            toast.error("Error saving data: " + error);
        }
    };

    const handleSaveExpense = () => {
        if (isClosed) return toast.error(t.msgClosedMonth);
        if (!projectId) return toast.error(t.msgSelectProject);

        let saved = false;

        try {
            // 1. Save MM Allocation if present
            if (totalMm > 0) {
                addMmAllocation({
                    id: uuidv4(),
                    MonthKey: monthKey,
                    TeamID: currentTeam?.TeamID || '',
                    ProjectID: projectId,
                    MM: totalMm,
                    MM_EXECUTIVE: mmGrades.EXECUTIVE,
                    MM_DIRECTOR: mmGrades.DIRECTOR,
                    MM_MANAGER: mmGrades.MANAGER,
                    MM_DEPUTY: mmGrades.DEPUTY,
                    MM_ASST: mmGrades.ASST,
                    MM_ASSOCIATE: mmGrades.ASSOCIATE,
                    MM_JUNIOR: mmGrades.JUNIOR,
                    InputType: 'ACTUAL' as InputType,
                    Category: 'INTERNAL' as ProjectCategory, // Force INTERNAL for Expense Tab
                    Note: note
                });
                saved = true;
            }

            // 2. Save Cost Expense if any cost present
            if (Number(laborCost) > 0 || Number(outsourceCost) > 0 || Number(expenseCost) > 0) {
                addCostExpense({
                    id: uuidv4(),
                    MonthKey: monthKey,
                    TeamID: currentTeam?.TeamID || '',
                    ProjectID: projectId,
                    CostCenter: 'PROJECT',
                    LaborCostKRW: Number(laborCost) || 0,
                    OutsourceCostKRW: Number(outsourceCost) || 0,
                    ExpenseCostKRW: Number(expenseCost) || 0,
                    Category: 'INTERNAL', // User request: Expense doesn't use Category selection, default to INTERNAL
                    Note: note
                });
                saved = true;
            }

            if (saved) {
                setMmGrades({ EXECUTIVE: 0, DIRECTOR: 0, MANAGER: 0, DEPUTY: 0, ASST: 0, ASSOCIATE: 0, JUNIOR: 0 });
                setLaborCost('');
                setOutsourceCost('');
                setExpenseCost('');
                setExpenseCost('');
                setNote('');
                toast.success(t.msgInputSaved);
            } else {
                toast.error(t.msgRequired);
            }
        } catch (error) {
            console.error(error);
            toast.error("Error saving data: " + error);
        }
    };

    if (!currentTeam) return <div>Team not found</div>;

    // Logic extraction for Collection Table
    // Fix: TeamType is 'SALES' | 'SUPPORT'. 'TECH' was incorrect.
    // Using strict ID check or 'SUPPORT' for Tech Teams (3,4,5).

    // 1. Collections (Cash) - Show if project matches Lead Team
    const collections = arCollections
        .filter(c => c.MonthKey === monthKey) // Remove projectId filter to show ALL team collections
        .filter(c => {
            const project = projects.find(p => p.ProjectID === c.ProjectID);
            // Fix: Only show collections for projects led by this team (or if team is Admin/etc - but here filtering for display)
            // If I am Team 5, I only see collections for Team 5 projects.
            if (!project) return true; // Show orphaned collections? No, maybe hide. But for now show to be safe? No, hide if no project found usually. But let's keep true if no project just in case.

            // Strict Filter: Project Lead ID == Current Team ID
            // Handle TEAM_1 vs TEAM_01 mismatch
            const leadId = project.LeadSalesTeamID;
            const myId = currentTeam.TeamID;

            return leadId === myId || leadId === myId.replace('TEAM_', 'TEAM_0') || leadId.replace('TEAM_0', 'TEAM_') === myId;
        })
        .map(c => ({
            id: c.id,
            type: 'COLLECTION',
            projectID: c.ProjectID,
            projectName: projects.find(p => p.ProjectID === c.ProjectID)?.ProjectName || '',
            amount: c.AmountKRW,
            vat: c.TaxAmountKRW || 0,
            gross: Number(c.AmountKRW) + Number(c.TaxAmountKRW || 0),
            note: c.Note,
            mm: 0
        }));

    // 2. Revenue MM (For Tech Teams & Sales Teams Non-Internal MM)
    // Removed `if (isTechTeam)` check to allow Sales Teams to see External MM as Revenue
    const revenueMM = mmAllocations
        .filter(m => m.MonthKey === monthKey && m.TeamID === currentTeam?.TeamID) // All MM for this team/month
        .filter(m => {
            const project = projects.find(p => p.ProjectID === m.ProjectID);
            const category = m.Category || project?.Category || 'INTERNAL';
            return category !== 'INTERNAL'; // Revenue = External/Cross-Charge/Support
        })
        .map(m => {
            const project = projects.find(p => p.ProjectID === m.ProjectID);
            const category = m.Category || project?.Category || 'INTERNAL';
            const factor = rateSettings?.Surcharges?.find(s => s.Category === category)?.Factor || 1;
            let val = 0;
            (['EXECUTIVE', 'DIRECTOR', 'MANAGER', 'DEPUTY', 'ASST', 'ASSOCIATE', 'JUNIOR'] as const).forEach(g => {
                const base = rateSettings?.BaseRates?.find(r => r.Grade === g)?.BaseRateKRW || 0;
                const key = `MM_${g}` as keyof typeof m;
                val += Number(m[key] || 0) * Number(base) * Number(factor);
            });
            const breakdown = (['EXECUTIVE', 'DIRECTOR', 'MANAGER', 'DEPUTY', 'ASST', 'ASSOCIATE', 'JUNIOR'] as const)
                .map(g => {
                    const key = `MM_${g}` as keyof typeof m;
                    const val = Number(m[key] || 0);
                    const label = GRADE_LABELS[g] ? GRADE_LABELS[g][language] : g;
                    return val > 0 ? `${label}: ${val.toFixed(2)}` : null;
                })
                .filter(Boolean)
                .join('\n');

            return {
                id: m.id,
                type: 'SUPPORT_MM', // All teams now unified as Sales logic
                projectID: m.ProjectID,
                amount: 0,
                vat: 0,
                gross: val,
                note: m.Note,
                mm: m.MM,
                valueKRW: val,
                breakdown, // Pass formatted string
                projectName: project?.ProjectName || '',
                category: category // Pass category for UI label
            };
        });

    const filteredCollectionData = [...collections, ...revenueMM];
    filteredCollectionData.sort((a, b) => (a.projectID || '').localeCompare(b.projectID || ''));


    // Logic extraction for Expense Table
    // 1. MM Allocations (INTERNAL ONLY)
    // User Logic: "Internal MM -> Tech Team's Expense"
    const myMM = mmAllocations
        .filter(m => m.MonthKey === monthKey) // Remove projectId filter to show ALL team expenses
        .filter(m => {
            // Case A: My Team's Internal MM
            if (m.TeamID === currentTeam?.TeamID) {
                // Fix: Priority check for explicit INTERNAL category
                if (m.Category === 'INTERNAL') return true;

                const project = projects.find(p => p.ProjectID === m.ProjectID);
                const category = m.Category || project?.Category || 'INTERNAL';
                return category === 'INTERNAL';
            }
            // Case B: Cross-Charged TO Me
            if (m.Category === currentTeam?.TeamID) {
                return true;
            }
            return false;
        })
        .map(m => {
            // Calculate Cost Value for Cross-Charge
            let val = 0;
            const project = projects.find(p => p.ProjectID === m.ProjectID);
            const category = m.Category || project?.Category || 'INTERNAL';
            const isCrossCharge = m.Category === currentTeam?.TeamID;

            const factor = isCrossCharge ? (rateSettings?.Surcharges?.find(s => s.Category === category)?.Factor || 1) : 1;

            (['EXECUTIVE', 'DIRECTOR', 'MANAGER', 'DEPUTY', 'ASST', 'ASSOCIATE', 'JUNIOR'] as const).forEach(g => {
                const base = rateSettings?.BaseRates?.find(r => r.Grade === g)?.BaseRateKRW || 0;
                const key = `MM_${g}` as keyof typeof m;
                val += Number(m[key] || 0) * Number(base) * Number(factor);
            });

            const breakdown = (['EXECUTIVE', 'DIRECTOR', 'MANAGER', 'DEPUTY', 'ASST', 'ASSOCIATE', 'JUNIOR'] as const)
                .map(g => {
                    const key = `MM_${g}` as keyof typeof m;
                    const val = Number(m[key] || 0);
                    const label = GRADE_LABELS[g] ? GRADE_LABELS[g][language] : g;
                    return val > 0 ? `${label}: ${val.toFixed(2)}` : null;
                })
                .filter(Boolean)
                .join('\n');

            return {
                id: m.id,
                type: isCrossCharge ? 'CROSS_MM' : 'MM',
                projectID: m.ProjectID,
                amountLabel: `₩${val.toLocaleString()} (${m.MM.toFixed(2)} M/M)`,
                amountValue: val,
                note: isCrossCharge ? `From ${m.TeamID} (${m.Note || ''})` : m.Note,
                breakdown,
                projectName: project?.ProjectName || ''
            };
        });

    // 2. Cost Expenses (Always Expense)
    const costItems = costExpenses
        .filter(c => c.MonthKey === monthKey && c.TeamID === currentTeam?.TeamID) // Remove projectId filter
        .map(c => ({
            id: c.id,
            type: c.LaborCostKRW > 0 ? 'LABOR' : c.OutsourceCostKRW > 0 ? 'OUTSOURCE' : 'EXPENSE',
            projectID: c.ProjectID,
            projectName: projects.find(p => p.ProjectID === c.ProjectID)?.ProjectName || '',
            amountLabel: `₩${(c.LaborCostKRW + c.OutsourceCostKRW + c.ExpenseCostKRW).toLocaleString()}`,
            amountValue: c.LaborCostKRW + c.OutsourceCostKRW + c.ExpenseCostKRW,
            note: c.Note
        }));

    const filteredExpenseData = [...myMM, ...costItems];
    filteredExpenseData.sort((a, b) => (a.projectID || '').localeCompare(b.projectID || ''));


    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-6 md:mb-8 gap-4 md:gap-0">
                <div>
                    <h2 className="text-xl md:text-3xl font-black tracking-tighter text-[#004442] border-l-[6px] md:border-l-[8px] border-[#004442] pl-4 md:pl-6 leading-none">
                        📝 {t.titleInputForm} <span className="text-sm bg-slate-200 text-slate-600 px-2 py-1 rounded ml-2">V1 (Original)</span>
                    </h2>
                    <p className="text-[10px] md:text-xs text-slate-400 mt-1 md:mt-2 font-black uppercase tracking-[0.2em] pl-4 md:pl-6 italic">{currentTeam.TeamName.split('(')[0]} Management Node</p>
                </div>
                {/* Buttons Removed for V1 Purity */}
                {isClosed && (
                    <div className="bg-rose-50 text-rose-600 px-4 md:px-6 py-2 md:py-2.5 rounded-2xl font-black text-[10px] md:text-xs border border-rose-100 shadow-sm animate-pulse flex items-center gap-2">
                        <div className="w-1.5 h-1.5 md:w-2 md:h-2 rounded-full bg-rose-500"></div>
                        {t.statusClosed} ({monthKey})
                    </div>
                )}
            </div>

            {/* Tabs */}
            <div className="flex gap-1.5 bg-slate-100 p-1.5 rounded-2xl w-full md:w-fit shadow-inner ring-1 ring-slate-200 overflow-x-auto">
                <button
                    onClick={() => setActiveTab('CONTRACT')}
                    className={cn(
                        "flex-1 md:flex-none px-4 md:px-8 py-2.5 md:py-3.5 font-black text-xs md:text-sm rounded-xl transition-all duration-300 whitespace-nowrap",
                        activeTab === 'CONTRACT'
                            ? "bg-[#004442] text-white shadow-lg shadow-black/10"
                            : "text-slate-400 hover:text-slate-600 hover:bg-white/50"
                    )}
                >
                    {t.tabContract}
                </button>
                <button
                    onClick={() => setActiveTab('COLLECTION')}
                    className={cn(
                        "flex-1 md:flex-none px-4 md:px-8 py-2.5 md:py-3.5 font-black text-xs md:text-sm rounded-xl transition-all duration-300 whitespace-nowrap",
                        activeTab === 'COLLECTION'
                            ? "bg-[#004442] text-white shadow-lg shadow-black/10"
                            : "text-slate-400 hover:text-slate-600 hover:bg-white/50"
                    )}
                >
                    {t.tabCollection}
                </button>
                <button
                    onClick={() => setActiveTab('EXPENSE')}
                    className={cn(
                        "flex-1 md:flex-none px-4 md:px-8 py-2.5 md:py-3.5 font-black text-xs md:text-sm rounded-xl transition-all duration-300 whitespace-nowrap",
                        activeTab === 'EXPENSE'
                            ? "bg-[#004442] text-white shadow-lg shadow-black/10"
                            : "text-slate-400 hover:text-slate-600 hover:bg-white/50"
                    )}
                >
                    {t.tabExpense}
                </button>
            </div>

            <div className="bg-white border border-slate-100 rounded-2xl md:rounded-3xl p-4 md:p-10 shadow-2xl shadow-slate-200/50 -mt-1.5 ring-1 ring-white">
                {activeTab !== 'CONTRACT' && (
                    <div className="flex flex-col md:flex-row items-end gap-4 mb-6 md:mb-10 p-4 bg-slate-50/80 rounded-2xl border border-slate-100 backdrop-blur-sm">
                        <div className="w-full md:w-auto">
                            <Label className="text-[10px] md:text-xs font-black text-slate-400 uppercase tracking-widest leading-none mb-2 md:mb-3 block">{t.labelTargetMonth}</Label>
                            <Select value={monthKey} onChange={e => setMonthKey(e.target.value)} className="h-10 md:h-12 rounded-xl font-black text-[#004442] border-slate-200 bg-white min-w-[120px]">
                                {calendar.map(c => (
                                    <option key={c.MonthKey} value={c.MonthKey}>{c.MonthKey}</option>
                                ))}
                            </Select>
                        </div>
                        <div className="w-full md:w-auto">
                            <Label className="text-[10px] md:text-xs font-black text-slate-400 uppercase tracking-widest leading-none mb-2 md:mb-3 block">날짜 (PERIOD)</Label>
                            <Input type="month" value={monthKey} onChange={e => setMonthKey(e.target.value)} className="h-10 md:h-12 rounded-xl font-black text-slate-800 border-slate-200 bg-white min-w-[150px]" />
                        </div>
                        <div className="flex-1 w-full md:w-auto">
                            <Label className="text-[10px] md:text-xs font-black text-slate-400 uppercase tracking-widest leading-none mb-2 md:mb-3 block">{t.labelSelectProject}</Label>
                            <Select value={projectId} onChange={e => handleProjectChange(e.target.value)} className="h-10 md:h-12 rounded-xl font-bold text-slate-800 border-slate-200 bg-white w-full">
                                <option value="">...</option>
                                {projects.map(p => (
                                    <option key={p.ProjectID} value={p.ProjectID}>{p.ProjectName} ({p.ProjectID})</option>
                                ))}
                            </Select>
                        </div>

                        {/* Hide Category for Expense Tab per User Request */}
                        {activeTab !== 'EXPENSE' && (
                            <div className="w-full md:w-auto">
                                <Label className="text-[10px] md:text-xs font-black text-slate-400 uppercase tracking-widest leading-none mb-2 md:mb-3 block">사업 구분 (CATEGORY)</Label>
                                <Select disabled={!canEdit} value={inputCategory} onChange={e => setInputCategory(e.target.value as ProjectCategory)} className="h-10 md:h-12 rounded-xl font-bold text-slate-800 border-slate-200 bg-white min-w-[180px]">
                                    <option value="INTERNAL">부서 자체 수행</option>
                                    <option value="CROSS_DEPT">타부서 지원 수행</option>
                                    <option value="OVERSEAS">해외 과업 수행</option>
                                    <option value="TEAM_1">1팀 지원 (Cross-Charge)</option>
                                    <option value="TEAM_2">2팀 지원 (Cross-Charge)</option>
                                    <option value="TEAM_3">3팀 지원 (Cross-Charge)</option>
                                    <option value="TEAM_4">4팀 지원 (Cross-Charge)</option>
                                    <option value="TEAM_5">5팀 지원 (Cross-Charge)</option>
                                </Select>
                            </div>
                        )}
                        <div>
                            <Button
                                disabled={!canEdit}
                                variant="secondary"
                                className="h-10 md:h-12 w-full md:w-auto px-4 md:px-6 whitespace-nowrap text-xs font-black border-slate-200 text-slate-600 hover:bg-white hover:text-[#004442] rounded-xl transition-all shadow-sm"
                                onClick={handleCopyPreviousMonth}
                            >
                                📋 {t.msgCopyPrevMonth || "COPY LAST"}
                            </Button>
                        </div>
                    </div>
                )}

                {/* 1. CONTRACT TAB */}
                {activeTab === 'CONTRACT' && (
                    <div className="space-y-6 animate-in fade-in slide-in-from-top-4 duration-500">
                        <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-6 opacity-60 border-b border-slate-50 pb-4">{t.descContract}</p>
                        <div className="grid grid-cols-2 gap-8">
                            <div className="space-y-2">
                                <Label className="text-[11px] font-black text-slate-400 uppercase tracking-widest leading-none mb-2 block">{t.labelID}</Label>
                                <Input disabled={!canEdit} value={contractData.ProjectID} onChange={e => setContractData({ ...contractData, ProjectID: e.target.value })} placeholder="Project ID" className="h-12 rounded-xl font-black text-slate-800 border-slate-200" />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-[11px] font-black text-slate-400 uppercase tracking-widest leading-none mb-2 block">{t.labelName}</Label>
                                <Input disabled={!canEdit} value={contractData.ProjectName} onChange={e => setContractData({ ...contractData, ProjectName: e.target.value })} className="h-12 rounded-xl font-bold text-slate-800 border-slate-200" />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-[11px] font-black text-slate-400 uppercase tracking-widest leading-none mb-2 block">{t.labelClient}</Label>
                                <Input disabled={!canEdit} value={contractData.Client} onChange={e => setContractData({ ...contractData, Client: e.target.value })} className="h-12 rounded-xl font-medium text-slate-800 border-slate-200" />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-[11px] font-black text-slate-400 uppercase tracking-widest leading-none mb-2 block">{t.labelAmount} (KRW)</Label>
                                <Input disabled={!canEdit} type="text" value={contractData.ContractAmountKRW ? Number(contractData.ContractAmountKRW).toLocaleString() : ''} onChange={e => {
                                    const val = e.target.value.replace(/,/g, '');
                                    if (!isNaN(Number(val))) setContractData({ ...contractData, ContractAmountKRW: Number(val) });
                                }} className="h-12 rounded-xl font-black text-[#004442] border-slate-200" />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-[11px] font-black text-slate-400 uppercase tracking-widest leading-none mb-2 block">{t.labelStart}</Label>
                                <Input disabled={!canEdit} type="month" value={contractData.StartMonth} onChange={e => setContractData({ ...contractData, StartMonth: e.target.value })} className="h-12 rounded-xl font-bold text-slate-800 border-slate-200" />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-[11px] font-black text-slate-400 uppercase tracking-widest leading-none mb-2 block">{t.labelEnd}</Label>
                                <Input disabled={!canEdit} type="month" value={contractData.EndMonthPlan} onChange={e => setContractData({ ...contractData, EndMonthPlan: e.target.value })} className="h-12 rounded-xl font-bold text-slate-800 border-slate-200" />
                            </div>
                            <div className="col-span-2 mt-8">
                                <Button disabled={!canEdit} onClick={handleSaveContract} className="h-14 w-full bg-[#004442] hover:bg-[#051c1b] text-white font-black rounded-2xl shadow-xl shadow-emerald-900/20 transition-all text-base tracking-widest uppercase">
                                    🚀 {t.btnRegister}
                                </Button>
                            </div>
                        </div>
                    </div>
                )}

                {/* 2. COLLECTION TAB */}
                {activeTab === 'COLLECTION' && (
                    <div className="space-y-8 animate-in fade-in slide-in-from-top-4 duration-500">
                        <p className="text-xs font-black text-slate-400 uppercase tracking-widest opacity-60 border-b border-slate-50 pb-4">Revenue & Collection Data Entry Ledger</p>
                        <div className="grid grid-cols-2 gap-8">
                            <div className="space-y-2">
                                <Label className="text-xs font-black text-slate-400 uppercase tracking-widest leading-none mb-2 block">공급가액 (SUPPLY AMOUNT) (KRW)</Label>
                                <Input
                                    disabled={!canEdit}
                                    type="text"
                                    value={supplyAmount === '' ? '' : Number(supplyAmount).toLocaleString()}
                                    onChange={e => {
                                        const val = e.target.value.replace(/,/g, '');
                                        if (val === '' || !isNaN(Number(val))) setSupplyAmount(val === '' ? '' : Number(val));
                                    }}
                                    placeholder="0"
                                    className={cn("h-12 rounded-xl font-black text-[#004442] border-slate-200", isOverContract && "border-rose-400 bg-rose-50 text-rose-700")}
                                />
                                {isOverContract && <span className="text-[10px] text-rose-600 font-black uppercase tracking-tight">{t.warnOverContract}</span>}
                            </div>
                            <div className="space-y-2">
                                <Label className="text-xs font-black text-slate-400 uppercase tracking-widest leading-none mb-2 block">부가세 (VAT) (KRW)</Label>
                                <Input
                                    disabled={!canEdit}
                                    type="text"
                                    value={taxAmount === '' ? '' : Number(taxAmount).toLocaleString()}
                                    onChange={e => {
                                        const val = e.target.value.replace(/,/g, '');
                                        if (val === '' || !isNaN(Number(val))) setTaxAmount(val === '' ? '' : Number(val));
                                    }}
                                    placeholder="0"
                                    className="h-12 rounded-xl font-black text-slate-600 border-slate-200"
                                />
                            </div>
                            {/* New Bulk Resource Allocation Table */}
                            <div className="col-span-2 p-10 bg-slate-50/50 rounded-[2rem] border border-slate-100 ring-1 ring-white/50 relative overflow-hidden group">
                                <div className="absolute top-0 left-0 w-1.5 h-full bg-[#004442] opacity-20 group-hover:opacity-100 transition-opacity"></div>
                                <Label className="text-[11px] text-[#004442] font-black uppercase tracking-[0.2em] mb-8 block ml-2">Monthly Resource Allocation (M/M)</Label>
                                <div className="grid grid-cols-4 md:grid-cols-7 gap-6">
                                    {[
                                        { key: 'EXECUTIVE', label: '임원' },
                                        { key: 'DIRECTOR', label: '이사' },
                                        { key: 'MANAGER', label: '부장' },
                                        { key: 'DEPUTY', label: '차장' },
                                        { key: 'ASST', label: '과장' },
                                        { key: 'ASSOCIATE', label: '대리' },
                                        { key: 'JUNIOR', label: '사원' }
                                    ].map(g => (
                                        <div key={g.key} className="space-y-3">
                                            <Label className="text-xs text-slate-400 font-black uppercase tracking-widest text-center block leading-none">{g.label}</Label>
                                            <Input
                                                disabled={!canEdit}
                                                type="number"
                                                step="0.01"
                                                value={mmGrades[g.key] || ''}
                                                onChange={e => setMmGrades({ ...mmGrades, [g.key]: Number(e.target.value) })}
                                                className="h-12 text-sm font-black text-center bg-white border-slate-200 text-[#004442] rounded-xl focus:ring-[#004442] focus:border-[#004442] shadow-sm transition-all"
                                                placeholder="0.0"
                                            />
                                        </div>
                                    ))}
                                </div>
                                <div className="mt-8 pt-8 border-t border-slate-100 text-[10px] text-right font-black text-slate-400 tracking-widest uppercase">
                                    AGGREGATE TOTAL: <span className="text-2xl text-[#004442] ml-2 font-black">
                                        ₩{Object.entries(mmGrades).reduce((sum, [key, mm]) => {
                                            const grade = key as keyof typeof mmGrades;
                                            const base = rateSettings?.BaseRates?.find(r => r.Grade === grade)?.BaseRateKRW || 0;
                                            return sum + (mm * base);
                                        }, 0).toLocaleString()}
                                    </span> <span className="text-slate-300">KRW (Est.)</span>
                                </div>
                            </div>

                            <div className="col-span-2 space-y-2">
                                <Label className="text-[11px] font-black text-slate-400 uppercase tracking-widest leading-none mb-2 block">{t.labelNote}</Label>
                                <Input disabled={!canEdit} value={note} onChange={e => setNote(e.target.value)} className="h-12 rounded-xl font-medium text-slate-600 border-slate-200 overflow-hidden" placeholder="Transaction remarks..." />
                            </div>
                            <div className="col-span-2 mt-8">
                                <Button onClick={handleSaveCollection} disabled={isClosed || !canEdit} className="h-14 w-full bg-[#004442] hover:bg-[#051c1b] text-white font-black rounded-2xl shadow-xl shadow-emerald-900/20 transition-all text-base tracking-widest uppercase">
                                    💾 {t.btnSave} COLLECTION
                                </Button>
                            </div>
                        </div>
                    </div>
                )}

                {/* 3. EXPENSE TAB */}
                {activeTab === 'EXPENSE' && (
                    <div className="space-y-8 animate-in fade-in slide-in-from-top-4 duration-500">
                        <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest opacity-60 border-b border-slate-50 pb-4">Variable Cost & Operational Expense Ledger</p>
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
                            {/* Labor Section */}
                            <div className="col-span-2 lg:col-span-4 p-10 bg-slate-50/50 rounded-[2rem] border border-slate-100 ring-1 ring-white/50 relative overflow-hidden group">
                                <div className="absolute top-0 left-0 w-1.5 h-full bg-[#004442] opacity-20 group-hover:opacity-100 transition-opacity"></div>
                                <Label className="text-[11px] text-[#004442] font-black uppercase tracking-[0.2em] mb-8 block ml-2">Monthly Resource Allocation (M/M)</Label>
                                <div className="grid grid-cols-4 md:grid-cols-7 gap-6">
                                    {[
                                        { key: 'EXECUTIVE', label: '임원' },
                                        { key: 'DIRECTOR', label: '이사' },
                                        { key: 'MANAGER', label: '부장' },
                                        { key: 'DEPUTY', label: '차장' },
                                        { key: 'ASST', label: '과장' },
                                        { key: 'ASSOCIATE', label: '대리' },
                                        { key: 'JUNIOR', label: '사원' }
                                    ].map(g => (
                                        <div key={g.key} className="space-y-3">
                                            <Label className="text-xs text-slate-400 font-black uppercase tracking-widest text-center block leading-none">{g.label}</Label>
                                            <Input
                                                disabled={!canEdit}
                                                type="number"
                                                step="0.01"
                                                value={mmGrades[g.key] || ''}
                                                onChange={e => setMmGrades({ ...mmGrades, [g.key]: Number(e.target.value) })}
                                                className="h-12 text-sm font-black text-center bg-white border-slate-200 text-[#004442] rounded-xl focus:ring-[#004442] focus:border-[#004442] shadow-sm transition-all"
                                                placeholder="0.0"
                                            />
                                        </div>
                                    ))}
                                </div>
                                <div className="mt-8 pt-8 border-t border-slate-100 text-[10px] text-right font-black text-slate-400 tracking-widest uppercase">
                                    AGGREGATE TOTAL: <span className="text-2xl text-[#004442] ml-2 font-black">
                                        ₩{Object.entries(mmGrades).reduce((sum, [key, mm]) => {
                                            const grade = key as keyof typeof mmGrades;
                                            const base = rateSettings?.BaseRates?.find(r => r.Grade === grade)?.BaseRateKRW || 0;
                                            return sum + (mm * base);
                                        }, 0).toLocaleString()}
                                    </span> <span className="text-slate-300">KRW (Est.)</span>
                                </div>
                            </div>

                            {/* Outsource */}
                            <div className="p-2 space-y-2">
                                <Label className="text-[11px] font-black text-slate-400 uppercase tracking-widest leading-none mb-2 block">{t.labelOutsource} (KRW)</Label>
                                <Input type="text" value={outsourceCost === '' ? '' : Number(outsourceCost).toLocaleString()} onChange={e => {
                                    const val = e.target.value.replace(/,/g, '');
                                    if (val === '' || !isNaN(Number(val))) setOutsourceCost(val === '' ? '' : Number(val));
                                }} placeholder="0" className="h-12 rounded-xl font-black text-[#004442] border-slate-200" />
                            </div>

                            {/* Other Expense */}
                            <div className="p-2 space-y-2">
                                <Label className="text-[11px] font-black text-slate-400 uppercase tracking-widest leading-none mb-2 block">{t.labelExpense} (KRW)</Label>
                                <Input type="text" value={expenseCost === '' ? '' : Number(expenseCost).toLocaleString()} onChange={e => {
                                    const val = e.target.value.replace(/,/g, '');
                                    if (val === '' || !isNaN(Number(val))) setExpenseCost(val === '' ? '' : Number(val));
                                }} placeholder="0" className="h-12 rounded-xl font-black text-[#004442] border-slate-200" />
                            </div>

                            <div className="col-span-2 lg:col-span-4 space-y-2 mt-4">
                                <Label className="text-[11px] font-black text-slate-400 uppercase tracking-widest leading-none mb-2 block">{t.labelNote}</Label>
                                <Input value={note} onChange={e => setNote(e.target.value)} className="h-12 rounded-xl font-medium text-slate-600 border-slate-200" placeholder="Expenditure context..." />
                            </div>
                            <div className="col-span-2 lg:col-span-4 mt-8">
                                <Button onClick={handleSaveExpense} disabled={isClosed} className="h-14 w-full bg-rose-600 hover:bg-rose-700 text-white font-black rounded-2xl shadow-xl shadow-rose-900/10 transition-all text-base tracking-widest uppercase">
                                    💾 {t.btnSave} EXPENDITURE
                                </Button>
                            </div>
                        </div>
                    </div>
                )}


                <div className="mt-16 space-y-12">
                    {activeTab === 'CONTRACT' && (
                        <Card className="border-slate-100 shadow-xl rounded-3xl overflow-hidden">
                            <CardHeader className="bg-slate-50 p-8 border-b border-slate-100">
                                <CardTitle className="text-lg font-black text-[#004442] uppercase tracking-tighter">🏢 {t.titleProjectList}</CardTitle>
                            </CardHeader>
                            <CardContent className="p-0">
                                <div className="max-h-[400px] overflow-y-auto">
                                    <table className="w-full text-xs text-left border-collapse">
                                        <thead className="bg-[#004442] text-emerald-300 font-black text-sm uppercase tracking-widest sticky top-0">
                                            <tr><th className="px-6 py-4">PROJECT ID</th><th className="px-6 py-4">PROJECT NAME</th><th className="px-6 py-4 text-right">CONTRACT AMOUNT</th></tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {projects.map(p => (
                                                <tr key={p.ProjectID} className="hover:bg-slate-50 transition-colors group">
                                                    <td className="px-6 py-4 font-black text-slate-400">{p.ProjectID}</td>
                                                    <td className="px-6 py-4 font-bold text-slate-800 group-hover:text-[#004442]">{p.ProjectName}</td>
                                                    <td className="px-6 py-4 text-right font-black text-[#004442]">₩{p.ContractAmountKRW.toLocaleString()}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {activeTab === 'COLLECTION' && (
                        <Card className="border-slate-100 shadow-xl rounded-3xl overflow-hidden">
                            <CardHeader className="bg-slate-50 p-8 border-b border-slate-100">
                                <CardTitle className="text-lg font-black text-[#004442] uppercase tracking-tighter">💰 {t.titleRecentCollection} <span className="text-sm text-slate-400">/ REVENUE</span> <span className="text-slate-400 font-medium ml-2">[{monthKey}]</span></CardTitle>
                            </CardHeader>
                            <CardContent className="p-0">
                                <div className="max-h-[400px] overflow-y-auto">
                                    <table className="w-full text-xs text-left border-collapse">
                                        <thead className="bg-[#004442] text-emerald-300 font-black text-sm uppercase tracking-widest sticky top-0">
                                            <tr>
                                                <th className="px-6 py-4">PROJECT</th>
                                                <th className="px-6 py-4 text-center">TYPE</th>
                                                <th className="px-6 py-4 text-right">NET AMOUNT / MM</th>
                                                <th className="px-6 py-4 text-right">VAT / VALUE</th>
                                                <th className="px-6 py-4 text-right">GROSS TOTAL</th>
                                                <th className="px-6 py-4">NOTE</th>
                                                <th className="px-6 py-4 text-center">ACTION</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {filteredCollectionData.map((item: any) => (
                                                <tr key={item.id} className="hover:bg-slate-50 transition-colors group">
                                                    <td className="px-6 py-4">
                                                        <div className="font-black text-slate-400">{item.projectID}</div>
                                                        <div className="font-bold text-slate-800 text-xs truncate max-w-[150px]" title={item.projectName}>{item.projectName}</div>
                                                    </td>
                                                    <td className="px-6 py-4 text-center">
                                                        <span className={cn(
                                                            "px-2 py-1 rounded text-[10px] font-black uppercase tracking-wider",
                                                            item.type === 'COLLECTION'
                                                                ? "bg-indigo-50 text-indigo-600"
                                                                : item.type === 'SUPPORT_MM'
                                                                    ? "bg-purple-50 text-purple-600" // Distinct color for Sales Support
                                                                    : "bg-emerald-50 text-emerald-600"
                                                        )}>
                                                            {item.type === 'COLLECTION' ? 'CASH' : item.type === 'SUPPORT_MM' ? 'SUPPORT' : 'M/M'}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4 text-right font-black text-slate-600">
                                                        {item.type === 'COLLECTION' ? (
                                                            `₩${item.amount.toLocaleString()}`
                                                        ) : (
                                                            <Tooltip content={(item as any).breakdown}>
                                                                <span className="cursor-help underline decoration-dotted decoration-slate-300 underline-offset-4">
                                                                    {item.mm.toFixed(2)} M/M
                                                                </span>
                                                            </Tooltip>
                                                        )}
                                                    </td>
                                                    <td className="px-6 py-4 text-right font-bold text-slate-400">
                                                        {item.type === 'COLLECTION' ? `₩${item.vat.toLocaleString()}` : `(Est) ₩${(item as any).valueKRW.toLocaleString()}`}
                                                    </td>
                                                    <td className="px-6 py-4 text-right font-black text-[#004442] bg-emerald-50/30">
                                                        ₩{item.gross.toLocaleString()}
                                                    </td>
                                                    <td className="px-6 py-4 text-slate-500 font-medium italic truncate max-w-[200px]">{item.note}</td>
                                                    <td className="px-6 py-4 text-center">
                                                        {canEdit && (
                                                            <button
                                                                onClick={() => item.type === 'COLLECTION' ? handleDeleteCollection(item.id) : handleDeleteMmAllocation(item.id)}
                                                                disabled={isClosed}
                                                                className="text-slate-300 hover:text-rose-500 transition-colors disabled:opacity-30"
                                                                title="Delete"
                                                            >
                                                                🗑️
                                                            </button>
                                                        )}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {activeTab === 'EXPENSE' && (
                        <Card className="border-slate-100 shadow-xl rounded-3xl overflow-hidden">
                            <CardHeader className="bg-slate-50 p-8 border-b border-slate-100">
                                <CardTitle className="text-lg font-black text-rose-900 uppercase tracking-tighter">💸 {t.titleRecentExpense} <span className="text-sm text-slate-400">/ EXPENDITURE</span> <span className="text-slate-400 font-medium ml-2">[{monthKey}]</span></CardTitle>
                            </CardHeader>
                            <CardContent className="p-0">
                                <div className="max-h-[400px] overflow-y-auto">
                                    <table className="w-full text-xs text-left border-collapse">
                                        <thead className="bg-rose-900 text-rose-100 font-black text-sm uppercase tracking-widest sticky top-0">
                                            <tr>
                                                <th className="px-6 py-4">PROJECT</th>
                                                <th className="px-6 py-4 text-center">TYPE</th>
                                                <th className="px-6 py-4 text-right">AMOUNT / MM</th>
                                                <th className="px-6 py-4">NOTE</th>
                                                <th className="px-6 py-4 text-center">ACTION</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {filteredExpenseData.map((item: any) => (
                                                <tr key={item.id} className="hover:bg-rose-50 transition-colors group">
                                                    <td className="px-6 py-4">
                                                        <div className="font-black text-slate-400">{item.projectID}</div>
                                                        <div className="font-bold text-slate-700 text-xs truncate max-w-[150px] group-hover:text-rose-700" title={item.projectName}>{item.projectName}</div>
                                                    </td>
                                                    <td className="px-6 py-4 text-center">
                                                        <span className={cn(
                                                            "px-2 py-1 rounded text-[10px] font-black uppercase tracking-wider",
                                                            item.type === 'MM' ? "bg-[#004442] text-emerald-300" : "bg-rose-100 text-rose-700"
                                                        )}>
                                                            {item.type}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4 text-right font-black text-slate-700">
                                                        {(item.type === 'MM' || item.type === 'CROSS_MM') ? (
                                                            <Tooltip content={(item as any).breakdown}>
                                                                <span className="cursor-help underline decoration-dotted decoration-slate-300 underline-offset-4">
                                                                    {item.amountLabel}
                                                                </span>
                                                            </Tooltip>
                                                        ) : (
                                                            item.amountLabel
                                                        )}
                                                    </td>
                                                    <td className="px-6 py-4 text-slate-500 font-medium italic truncate max-w-[200px]">{item.note}</td>
                                                    <td className="px-6 py-4 text-center">
                                                        {canEdit && (
                                                            item.type === 'CROSS_MM' ? (
                                                                <Tooltip content="타 부서에서 생성한 내역입니다. 해당 부서(수금팀)에서 삭제해야 사라집니다.">
                                                                    <span className="text-slate-300 cursor-not-allowed text-xs">🔒</span>
                                                                </Tooltip>
                                                            ) : (
                                                                <button
                                                                    onClick={() => item.type === 'MM' ? handleDeleteMmAllocation(item.id) : handleDeleteCostExpense(item.id)}
                                                                    disabled={isClosed}
                                                                    className="text-slate-300 hover:text-rose-500 transition-colors disabled:opacity-30 flex items-center justify-center w-full"
                                                                    title="Delete"
                                                                >
                                                                    🗑️
                                                                </button>
                                                            )
                                                        )}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </CardContent>
                        </Card>
                    )}
                </div>
            </div>
        </div>
    );
}


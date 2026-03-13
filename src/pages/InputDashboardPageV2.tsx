import { useState, useMemo, useEffect, useRef, Fragment } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { useLanguage } from '../context/LanguageContext';
import { Button, Input, Select, Card, CardHeader, CardTitle, CardContent, Label } from '../components/ui-components';

import { cn, uuidv4, normalizeTeamId } from '../lib/utils';
import type { ProjectMaster, ProjectCategory, InputType, MmAllocation } from '../types';

import { useToast } from '../context/ToastContext';

type TabType = 'CONTRACT' | 'COLLECTION' | 'EXPENSE' | 'RESOURCE';



export default function InputDashboardPage() {
    const { teamId } = useParams();
    const { currentUser } = useAuth();
    const {
        teams, projects, calendar,
        addCollection, addCostExpense, addProject,
        deleteCollection, deleteCostExpense,
        bulkAddMmAllocations, bulkUpdateMmAllocations,
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
    const [monthKey, setMonthKey] = useState(() => {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    });

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
    const [supplyAmount, setSupplyAmount] = useState<string>('');
    const [taxAmount, setTaxAmount] = useState<string>('');

    // Expense State
    const [laborCost, setLaborCost] = useState<string>('');
    const [outsourceCost, setOutsourceCost] = useState<string>('');
    const [expenseCost, setExpenseCost] = useState<string>('');



    // Grid State for Bulk Resource Allocation
    type GridRow = {
        projectId: string;
        projectName: string;
        EXECUTIVE: number | string;
        DIRECTOR: number | string;
        MANAGER: number | string;
        DEPUTY: number | string;
        ASST: number | string;
        ASSOCIATE: number | string;
        JUNIOR: number | string;
        totalMM: number;
        note?: string;
    };
    const [gridData, setGridData] = useState<GridRow[]>([]);

    // Initialize Grid Data when projects or month changes
    // Only initialize if gridData is empty OR if the context (month/team) has changed significantly
    // usage of JSON.stringify to deep compare is expensive, so we use a simpler heuristic or just check if it's empty.
    // BETTER: Use a ref to track the last loaded key (Month + Team)
    const lastLoadedKey = useRef<string>('');

    useEffect(() => {
        // 1. Get filtered list of active projects
        const activeProjects = projects.filter(p => p.Status === 'ACTIVE');
        const currentKey = `${monthKey}-${teamId}`;

        // Heuristic: If we already loaded data for this key, AND the number of projects hasn't changed,
        // AND gridData is not empty, then we skip re-initialization to preserve local edits.
        if (lastLoadedKey.current === currentKey &&
            gridData.length === activeProjects.length &&
            gridData.length > 0) {
            return;
        }

        // 2. Get existing allocations for this month/team (normalized)
        const tid = normalizeTeamId(teamId);
        const existingAllocations = mmAllocations.filter(m => m.MonthKey === monthKey && normalizeTeamId(m.TeamID) === tid);

        // 2. Map all projects to rows (De-duplicate projects by ID)
        const uniqueProjectsMap = new Map();
        projects.filter(p => p.Status === 'ACTIVE').forEach(p => {
            if (!uniqueProjectsMap.has(p.ProjectID)) {
                uniqueProjectsMap.set(p.ProjectID, p);
            }
        });

        const rows: GridRow[] = Array.from(uniqueProjectsMap.values())
            .sort((a, b) => a.ProjectName.localeCompare(b.ProjectName))
            .map(p => {
                const existing = existingAllocations.find(m => m.ProjectID === p.ProjectID);
                const row: GridRow = {
                    projectId: p.ProjectID,
                    projectName: p.ProjectName,
                    EXECUTIVE: existing?.MM_EXECUTIVE || 0,
                    DIRECTOR: existing?.MM_DIRECTOR || 0,
                    MANAGER: existing?.MM_MANAGER || 0,
                    DEPUTY: existing?.MM_DEPUTY || 0,
                    ASST: existing?.MM_ASST || 0,
                    ASSOCIATE: existing?.MM_ASSOCIATE || 0,
                    JUNIOR: existing?.MM_JUNIOR || 0,
                    totalMM: existing?.MM || 0,
                    note: existing?.Note || ''
                };
                // Recalculate total just in case
                row.totalMM =
                    Number(row.EXECUTIVE || 0) +
                    Number(row.DIRECTOR || 0) +
                    Number(row.MANAGER || 0) +
                    Number(row.DEPUTY || 0) +
                    Number(row.ASST || 0) +
                    Number(row.ASSOCIATE || 0) +
                    Number(row.JUNIOR || 0);
                return row;
            });

        setGridData(rows);
        lastLoadedKey.current = currentKey;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [projects, mmAllocations, monthKey, teamId]);


    const handleGridChange = (rowIndex: number, field: string, value: string) => {
        setGridData(prev => {
            const newData = [...prev];
            // Create a new object for the row to avoid mutation
            newData[rowIndex] = { ...newData[rowIndex], [field]: value };

            // Recalculate Total (Parse to number)
            const r = newData[rowIndex];
            r.totalMM =
                Number(r.EXECUTIVE || 0) +
                Number(r.DIRECTOR || 0) +
                Number(r.MANAGER || 0) +
                Number(r.DEPUTY || 0) +
                Number(r.ASST || 0) +
                Number(r.ASSOCIATE || 0) +
                Number(r.JUNIOR || 0);

            return newData;
        });
    };

    const handlePaste = (e: React.ClipboardEvent, startRowIndex: number, startColIndex: number) => {
        e.preventDefault();
        const clipboardData = e.clipboardData.getData('text');
        const rows = clipboardData.split(/\r?\n/).filter(row => row.trim() !== '');

        if (rows.length === 0) return;

        // Use functional state update to ensure latest state and avoid mutation
        setGridData(prev => {
            // Deep copy of the array to allow mutation of rows in the copy
            const newData = prev.map(row => ({ ...row }));
            const gradeKeys = ['EXECUTIVE', 'DIRECTOR', 'MANAGER', 'DEPUTY', 'ASST', 'ASSOCIATE', 'JUNIOR'];

            // Warning if past exceeds table
            if (startRowIndex + rows.length > newData.length) {
                toast.error(`⚠️ 붙여넣을 데이터가 테이블 행보다 많습니다. (${rows.length}행 중 ${newData.length - startRowIndex}행만 입력됨)`);
            }

            let pastedCount = 0;

            rows.forEach((rowStr, i) => {
                const rowIndex = startRowIndex + i;
                if (rowIndex >= newData.length) return;

                const cells = rowStr.split('\t');
                cells.forEach((cellStr, j) => {
                    const colIndex = startColIndex + j;
                    if (colIndex >= gradeKeys.length) return;

                    const field = gradeKeys[colIndex];
                    // Robust number parsing: remove commas
                    const cleanStr = cellStr.replace(/,/g, '').trim();
                    const val = cleanStr === '' ? 0 : Number(cleanStr);

                    if (!isNaN(val)) {
                        // @ts-ignore
                        newData[rowIndex][field] = val;
                    }
                });

                // Recalculate Total for this row
                const r = newData[rowIndex];
                r.totalMM =
                    Number(r.EXECUTIVE || 0) +
                    Number(r.DIRECTOR || 0) +
                    Number(r.MANAGER || 0) +
                    Number(r.DEPUTY || 0) +
                    Number(r.ASST || 0) +
                    Number(r.ASSOCIATE || 0) +
                    Number(r.JUNIOR || 0);
                pastedCount++;
            });

            toast.success(`${pastedCount}행 데이터 붙여넣기 완료`);
            return newData;
        });
    };

    const handleSaveGrid = () => {
        if (isClosed) return toast.error(t.msgClosedMonth);
        if (window.confirm("인력 투입 계획을 저장하시겠습니까? (기존 데이터는 덮어씌워집니다)")) {
            try {
                const payloads: MmAllocation[] = [];
                const idsToDelete: string[] = [];

                gridData.forEach(row => {
                    const tid = normalizeTeamId(teamId);
                    const existing = mmAllocations.find(m => m.MonthKey === monthKey && normalizeTeamId(m.TeamID) === tid && m.ProjectID === row.projectId);

                    if (row.totalMM > 0) {
                        const payload: MmAllocation = {
                            id: existing?.id || uuidv4(),
                            MonthKey: monthKey,
                            TeamID: teamId || '',
                            ProjectID: row.projectId,
                            MM: Number(row.totalMM),
                            MM_EXECUTIVE: Number(row.EXECUTIVE || 0),
                            MM_DIRECTOR: Number(row.DIRECTOR || 0),
                            MM_MANAGER: Number(row.MANAGER || 0),
                            MM_DEPUTY: Number(row.DEPUTY || 0),
                            MM_ASST: Number(row.ASST || 0),
                            MM_ASSOCIATE: Number(row.ASSOCIATE || 0),
                            MM_JUNIOR: Number(row.JUNIOR || 0),
                            InputType: 'ACTUAL' as InputType,
                            Category: 'INTERNAL' as ProjectCategory,
                            Note: row.note || existing?.Note || ''
                        };

                        const project = projects.find(p => p.ProjectID === row.projectId);
                        if (project) {
                            const leadTeamId = project.LeadSalesTeamID;
                            if (leadTeamId !== teamId && ['TEAM_1', 'TEAM_2', 'TEAM_3', 'TEAM_4', 'TEAM_5'].includes(leadTeamId)) {
                                payload.Category = leadTeamId as ProjectCategory;
                            } else {
                                payload.Category = project.Category;
                            }
                        }
                        payloads.push(payload);
                    } else if (existing) {
                        idsToDelete.push(existing.id);
                    }
                });

                // Atomic Batch Operation
                bulkUpdateMmAllocations(payloads, idsToDelete);

                // Force re-sync by resetting lastLoadedKey so the useEffect can run again if context is the same
                lastLoadedKey.current = '';
                toast.success(`${payloads.length}건의 프로젝트 인력 투입이 저장되었습니다.`);
            } catch (e) {
                console.error(e);
                toast.error("저장 중 오류가 발생했습니다.");
            }
        }
    };



    // Derived Info
    const isClosed = monthCloseControls.find(c => c.MonthKey === monthKey && normalizeTeamId(c.TeamID) === normalizeTeamId(teamId))?.IsClosed;

    // PERMISSION CHECK
    const canEdit = useMemo(() => {
        if (isClosed) return false;
        if (!currentUser) return false;

        // Admin Roles can edit any team
        if (['ADMIN', 'SUB_ADMIN'].includes(currentUser.role)) return true;

        // Leader can edit ONLY their own team
        if (currentUser.role === 'LEADER') {
            return normalizeTeamId(currentUser.teamId) === normalizeTeamId(currentTeam?.TeamID);
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

        const prevMm = mmAllocations.filter(m => m.MonthKey === prevMonth && normalizeTeamId(m.TeamID) === normalizeTeamId(teamId));
        const prevExpenses = costExpenses.filter(e => e.MonthKey === prevMonth && normalizeTeamId(e.TeamID) === normalizeTeamId(teamId));

        if (prevMm.length === 0 && prevExpenses.length === 0) {
            return toast.info(`${prevMonth}에 저장된 데이터가 없습니다.`);
        }

        if (window.confirm(`${prevMonth}의 데이터를 현재 월(${monthKey})로 복사하시겠습니까? (기존 데이터와 합쳐집니다.)`)) {
            const mmPayloads = prevMm.map(m => ({
                ...m,
                id: uuidv4(),
                MonthKey: monthKey,
                Note: `[Copied from ${prevMonth}] ${m.Note || ''}`
            }));

            // Note: DataContext doesn't have bulkAddCostExpenses yet, but let's just use what we have for MM
            bulkAddMmAllocations(mmPayloads);

            prevExpenses.forEach(e => {
                addCostExpense({
                    ...e,
                    id: uuidv4(),
                    MonthKey: monthKey,
                    Note: `[Copied from ${prevMonth}] ${e.Note || ''}`
                });
            });

            lastLoadedKey.current = '';
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
        const hasMM = false; // totalMm removed from V2 single input

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
            /* 
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
            */

            setSupplyAmount('');
            setTaxAmount('');
            // setMmGrades({ EXECUTIVE: 0, DIRECTOR: 0, MANAGER: 0, DEPUTY: 0, ASST: 0, ASSOCIATE: 0, JUNIOR: 0 }); // Removed from V2
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
            /*
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
            */

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
                // setMmGrades({ EXECUTIVE: 0, DIRECTOR: 0, MANAGER: 0, DEPUTY: 0, ASST: 0, ASSOCIATE: 0, JUNIOR: 0 }); // Removed in V2
                setLaborCost('');
                setOutsourceCost('');
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
                        📝 {t.titleInputForm}
                    </h2>
                    <p className="text-[10px] md:text-xs text-slate-400 mt-1 md:mt-2 font-black uppercase tracking-[0.2em] pl-4 md:pl-6 italic">{currentTeam.TeamName.split('(')[0]} Management Node</p>
                </div>
                {isClosed && (
                    <div className="bg-rose-50 text-rose-600 px-4 md:px-6 py-2 md:py-2.5 rounded-2xl font-black text-[10px] md:text-xs border border-rose-100 shadow-sm animate-pulse flex items-center gap-2">
                        <div className="w-1.5 h-1.5 md:w-2 md:h-2 rounded-full bg-rose-500"></div>
                        {t.statusClosed} ({monthKey})
                    </div>
                )}
            </div>

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
                <button
                    onClick={() => setActiveTab('RESOURCE')}
                    className={cn(
                        "flex-1 md:flex-none px-4 md:px-8 py-2.5 md:py-3.5 font-black text-xs md:text-sm rounded-xl transition-all duration-300 whitespace-nowrap",
                        activeTab === 'RESOURCE'
                            ? "bg-[#004442] text-white shadow-lg shadow-black/10"
                            : "text-slate-400 hover:text-slate-600 hover:bg-white/50"
                    )}
                >
                    👥 인력(Resource)
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
                        {activeTab !== 'RESOURCE' && (
                            <div className="w-full md:w-auto">
                                <Label className="text-[10px] md:text-xs font-black text-slate-400 uppercase tracking-widest leading-none mb-2 md:mb-3 block">날짜 (PERIOD)</Label>
                                <Input type="month" value={monthKey} onChange={e => setMonthKey(e.target.value)} className="h-10 md:h-12 rounded-xl font-black text-slate-800 border-slate-200 bg-white min-w-[150px]" />
                            </div>
                        )}
                        {activeTab !== 'RESOURCE' && (
                            <div className="flex-1 w-full md:w-auto">
                                <Label className="text-[10px] md:text-xs font-black text-slate-400 uppercase tracking-widest leading-none mb-2 md:mb-3 block">{t.labelSelectProject}</Label>
                                <Select value={projectId} onChange={e => handleProjectChange(e.target.value)} className="h-10 md:h-12 rounded-xl font-bold text-slate-800 border-slate-200 bg-white w-full">
                                    <option value="">...</option>
                                    {projects.map(p => (
                                        <option key={p.ProjectID} value={p.ProjectID}>{p.ProjectName} ({p.ProjectID})</option>
                                    ))}
                                </Select>
                            </div>
                        )}

                        {/* Hide Category for Expense and Resource Tab per User Request */}
                        {activeTab !== 'EXPENSE' && activeTab !== 'RESOURCE' && (
                            <div className="w-full md:w-auto">
                                <Label className="text-[10px] md:text-xs font-black text-slate-400 uppercase tracking-widest leading-none mb-2 md:mb-3 block">사업 구분 (CATEGORY)</Label>
                                <Select disabled={!canEdit} value={inputCategory} onChange={e => setInputCategory(e.target.value as ProjectCategory)} className="h-10 md:h-12 rounded-xl font-bold text-slate-800 border-slate-200 bg-white min-w-[180px]">
                                    <option value="INTERNAL">자체사업 (Own Project)</option>
                                    <option value="CROSS_DEPT">타부서지원 (Internal Rev)</option>
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

                {/* 1. Contract Tab */}
                {activeTab === 'CONTRACT' && (
                    <div className="space-y-6 animate-in fade-in slide-in-from-top-4 duration-500">
                        <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest opacity-60 border-b border-slate-50 pb-4">{t.descContract}</p>
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

                {/* 2. Collection Tab */}
                {activeTab === 'COLLECTION' && (
                    <div className="space-y-8 animate-in fade-in slide-in-from-top-4 duration-500">
                        <p className="text-xs font-black text-slate-400 uppercase tracking-widest opacity-60 border-b border-slate-50 pb-4">Revenue & Collection Data Entry Ledger</p>
                        <div className="grid grid-cols-2 gap-8">
                            <div className="space-y-2">
                                <Label className="text-xs font-black text-slate-400 uppercase tracking-widest leading-none mb-2 block">공급가액 (SUPPLY AMOUNT) (KRW)</Label>
                                <Input
                                    disabled={!canEdit}
                                    type="text"
                                    value={supplyAmount.includes('.') ? supplyAmount : (supplyAmount === '' ? '' : Number(supplyAmount).toLocaleString())}
                                    onChange={e => {
                                        const val = e.target.value.replace(/,/g, '');
                                        if (val === '' || val === '.' || !isNaN(Number(val))) setSupplyAmount(val);
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
                                    value={taxAmount.includes('.') ? taxAmount : (taxAmount === '' ? '' : Number(taxAmount).toLocaleString())}
                                    onChange={e => {
                                        const val = e.target.value.replace(/,/g, '');
                                        if (val === '' || val === '.' || !isNaN(Number(val))) setTaxAmount(val);
                                    }}
                                    placeholder="0"
                                    className="h-12 rounded-xl font-black text-slate-600 border-slate-200"
                                />
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

                        {/* Collection List Table */}
                        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden mt-8">
                            <div className="p-4 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
                                <h3 className="font-bold text-slate-700">📋 수금 내역 목록 (List)</h3>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-xs text-left border-collapse">
                                    <thead className="bg-slate-50 text-slate-500 font-bold">
                                        <tr>
                                            <th className="p-3 border-b">Project</th>
                                            <th className="p-3 border-b text-right">Supply</th>
                                            <th className="p-3 border-b text-right">VAT</th>
                                            <th className="p-3 border-b text-right">Total</th>
                                            <th className="p-3 border-b">Note</th>
                                            <th className="p-3 border-b w-[50px]"></th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {(() => {
                                            // 1. Filter ALL collections for this team (Ignore MonthKey selection for List)
                                            const allCollections = arCollections
                                                .filter(c => {
                                                    const project = projects.find(p => p.ProjectID === c.ProjectID);
                                                    if (!project) return true; // Keep orphans for safety
                                                    const leadId = normalizeTeamId(project.LeadSalesTeamID);
                                                    const myId = normalizeTeamId(currentTeam.TeamID);
                                                    return leadId === myId;
                                                })
                                                .map(c => ({
                                                    id: c.id,
                                                    MonthKey: c.MonthKey,
                                                    projectName: projects.find(p => p.ProjectID === c.ProjectID)?.ProjectName || '',
                                                    amount: c.AmountKRW,
                                                    vat: c.TaxAmountKRW || 0,
                                                    gross: Number(c.AmountKRW) + Number(c.TaxAmountKRW || 0),
                                                    note: c.Note
                                                }))
                                                .sort((a, b) => {
                                                    // Sort by Month (Desc) then Project Name
                                                    if (a.MonthKey > b.MonthKey) return -1;
                                                    if (a.MonthKey < b.MonthKey) return 1;
                                                    return a.projectName.localeCompare(b.projectName);
                                                });

                                            if (allCollections.length === 0) {
                                                return (
                                                    <tr>
                                                        <td colSpan={6} className="p-8 text-center text-slate-400">
                                                            No collection data found.
                                                        </td>
                                                    </tr>
                                                );
                                            }

                                            // 2. Group by Month
                                            const groups: { [key: string]: typeof allCollections } = {};
                                            allCollections.forEach(item => {
                                                if (!groups[item.MonthKey]) groups[item.MonthKey] = [];
                                                groups[item.MonthKey].push(item);
                                            });

                                            // 3. Render Groups
                                            return Object.keys(groups).sort().reverse().map(mKey => (
                                                <Fragment key={mKey}>
                                                    {/* Month Header */}
                                                    <tr className="bg-slate-100/80">
                                                        <td colSpan={6} className="p-2 pl-4 font-black text-slate-600 text-xs tracking-widest border-y border-slate-200">
                                                            📅 {mKey}
                                                        </td>
                                                    </tr>
                                                    {/* Month Rows */}
                                                    {groups[mKey].map(item => (
                                                        <tr key={item.id} className="hover:bg-slate-50/50">
                                                            <td className="p-3 font-medium text-slate-700">{item.projectName}</td>
                                                            <td className="p-3 text-right font-bold text-[#004442]">
                                                                {Math.round(item.amount).toLocaleString()}
                                                            </td>
                                                            <td className="p-3 text-right text-slate-500">
                                                                {Math.round(item.vat).toLocaleString()}
                                                            </td>
                                                            <td className="p-3 text-right font-bold text-slate-700">
                                                                {Math.round(item.gross).toLocaleString()}
                                                            </td>
                                                            <td className="p-3 text-slate-500 truncate max-w-[200px]">
                                                                {item.note}
                                                            </td>
                                                            <td className="p-3 text-center">
                                                                {canEdit && (
                                                                    <button
                                                                        onClick={() => handleDeleteCollection(item.id)}
                                                                        className="text-slate-300 hover:text-rose-500 transition-colors"
                                                                    >
                                                                        🗑️
                                                                    </button>
                                                                )}
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </Fragment>
                                            ));
                                        })()}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}

                {/* 3. Resource Tab (NEW Bulk Table) - Manually added as activeTab === 'RESOURCE' */}
                {activeTab === 'RESOURCE' && (
                    <div className="space-y-6 animate-in fade-in slide-in-from-top-4 duration-500">
                        <Card className="border-slate-200 shadow-sm overflow-hidden">
                            <CardHeader className="bg-slate-50 pb-4 border-b border-slate-100 flex flex-row justify-between items-center">
                                <div>
                                    <CardTitle className="text-lg font-black text-[#004442] flex items-center gap-2">
                                        👥 인력 투입 관리 (Resource Allocation)
                                    </CardTitle>
                                    <div className="text-sm text-slate-500 mt-1">
                                        프로젝트별 직급별 투입 M/M를 관리합니다. 엑셀에서 복사하여 붙여넣을 수 있습니다.
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    <Button
                                        onClick={handleSaveGrid}
                                        disabled={!canEdit}
                                        className="bg-[#004442] hover:bg-[#003332] text-white font-bold shadow-md"
                                    >
                                        💾 전체 저장 (Save All)
                                    </Button>
                                </div>
                            </CardHeader>
                            <CardContent className="p-0">
                                <div className="overflow-x-auto max-h-[600px] relative">
                                    <table className="w-full text-sm text-left border-collapse">
                                        <thead className="bg-[#004442] text-white sticky top-0 z-10 shadow-md">
                                            <tr>
                                                <th className="p-3 font-bold border-r border-[#005553] min-w-[200px]">Project Name</th>
                                                {['EXECUTIVE', 'DIRECTOR', 'MANAGER', 'DEPUTY', 'ASST', 'ASSOCIATE', 'JUNIOR'].map(grade => (
                                                    <th key={grade} className="p-3 font-bold text-center border-r border-[#005553] min-w-[80px]">
                                                        {GRADE_LABELS[grade][language].split(' ')[0]} {/* Short Label */}
                                                    </th>
                                                ))}
                                                <th className="p-3 font-bold text-center bg-[#003332] min-w-[80px]">Total</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {gridData.map((row, rowIndex) => (
                                                <tr key={`${row.projectId}-${rowIndex}`} className="hover:bg-slate-50 transition-colors group">
                                                    <td className="p-2 border-r border-slate-100 font-medium text-slate-700 bg-white sticky left-0 z-0 group-hover:bg-slate-50">
                                                        <div className="flex flex-col">
                                                            <div className="whitespace-normal break-words max-w-[300px]" title={row.projectName}>
                                                                {row.projectName}
                                                            </div>
                                                            <div className="mt-1">
                                                                {(() => {
                                                                    const p = projects.find(proj => proj.ProjectID === row.projectId);
                                                                    // Check if project is owned by current team
                                                                    // Handle strict ID match or mapped Team ID
                                                                    const leadId = p?.LeadSalesTeamID || '';
                                                                    const isMine = leadId === teamId ||
                                                                        leadId === teamId?.replace('TEAM_', 'TEAM_0') ||
                                                                        leadId.replace('TEAM_0', 'TEAM_') === teamId;

                                                                    return isMine ? (
                                                                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-100 uppercase tracking-tight">
                                                                            자체사업 (Own Project)
                                                                        </span>
                                                                    ) : (
                                                                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-100 uppercase tracking-tight">
                                                                            {(() => {
                                                                                // Try to find team name, otherwise show ID
                                                                                const tName = teams.find(t => t.TeamID === leadId)?.TeamName || leadId;
                                                                                // Shorten team name for badge
                                                                                const shortName = tName.replace('Railway Division ', '').replace('Team', '팀').replace('Department', '부');
                                                                                return `${shortName} 지원 (Internal Rev)`;
                                                                            })()}
                                                                        </span>
                                                                    );
                                                                })()}
                                                            </div>
                                                        </div>
                                                    </td>
                                                    {['EXECUTIVE', 'DIRECTOR', 'MANAGER', 'DEPUTY', 'ASST', 'ASSOCIATE', 'JUNIOR'].map((grade, colIndex) => (
                                                        <td key={grade} className="p-0 border-r border-slate-100">
                                                            <input
                                                                type="text"
                                                                className="w-full h-10 text-center focus:bg-[#E0F2F1] focus:ring-2 focus:ring-[#004442] outline-none transition-all font-mono text-slate-600 bg-transparent"
                                                                value={row[grade as keyof GridRow] || ''}
                                                                onChange={(e) => handleGridChange(rowIndex, grade, e.target.value)}
                                                                onPaste={(e) => handlePaste(e, rowIndex, colIndex)}
                                                                disabled={!canEdit}
                                                            />
                                                        </td>
                                                    ))}
                                                    <td className="p-2 text-center font-bold text-[#004442] bg-slate-50">
                                                        {Number(row.totalMM).toFixed(2)}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                        {gridData.length > 0 && (
                                            <tfoot className="bg-slate-50 font-black text-slate-600 border-t border-slate-200 sticky bottom-0 z-10 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)]">
                                                <tr>
                                                    <td className="p-3 text-right uppercase tracking-widest border-r border-slate-200">Grand Total</td>
                                                    {['EXECUTIVE', 'DIRECTOR', 'MANAGER', 'DEPUTY', 'ASST', 'ASSOCIATE', 'JUNIOR'].map(g => (
                                                        <td key={g} className="p-3 text-center text-[#004442] border-r border-slate-200">
                                                            {gridData.reduce((sum, row) => sum + (Number(row[g as keyof GridRow]) || 0), 0).toFixed(2)}
                                                        </td>
                                                    ))}
                                                    <td className="p-3 text-center text-lg text-[#004442] bg-slate-100">
                                                        {gridData.reduce((sum, row) => sum + row.totalMM, 0).toFixed(2)}
                                                    </td>
                                                </tr>
                                            </tfoot>
                                        )}
                                    </table>
                                </div>

                                {gridData.length === 0 && (
                                    <div className="p-8 text-center text-slate-400">
                                        활성 프로젝트가 없습니다.
                                    </div>
                                )}

                                {/* Financial Summary Footer (Resource Tab) */}
                                <div className="mt-8 p-6 bg-slate-50/50 rounded-2xl border border-slate-100">
                                    <h3 className="text-sm font-black text-slate-400 uppercase tracking-[0.2em] mb-6 flex items-center gap-2">
                                        <span className="w-8 h-[1px] bg-slate-200"></span>
                                        Financial Summary
                                        <span className="w-8 h-[1px] bg-slate-200"></span>
                                    </h3>

                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                                        {(() => {
                                            // 1. Calculate Earned Support Revenue (Revenue from external/other teams)
                                            const earnedSupportRevenue = gridData.reduce((sum, row) => {
                                                const p = projects.find(proj => proj.ProjectID === row.projectId);
                                                if (!p) return sum;
                                                const leadId = normalizeTeamId(p.LeadSalesTeamID);
                                                const tid = normalizeTeamId(teamId);
                                                const isDivision2Common = leadId === 'TEAM_COMMON' || (p.ProjectName?.includes('철도2부') && p.ProjectName?.includes('공통'));
                                                if (leadId === tid || isDivision2Common) return sum;

                                                let factor = 1.0;
                                                if (leadId === 'TEAM_OTHER' || leadId?.startsWith('DEPT_')) {
                                                    factor = rateSettings?.Surcharges?.find(s => s.Category === 'CROSS_DEPT')?.Factor || 1.3;
                                                }

                                                let rowRev = 0;
                                                (['EXECUTIVE', 'DIRECTOR', 'MANAGER', 'DEPUTY', 'ASST', 'ASSOCIATE', 'JUNIOR'] as const).forEach(g => {
                                                    const base = rateSettings?.BaseRates?.find(r => r.Grade === g)?.BaseRateKRW || 0;
                                                    const mmVal = row[g as keyof GridRow];
                                                    const mm = (typeof mmVal === 'string') ? (parseFloat(mmVal.replace(/,/g, '')) || 0) : (Number(mmVal) || 0);
                                                    rowRev += mm * base * factor;
                                                });
                                                return sum + rowRev;
                                            }, 0);

                                            // 2. Calculate Gross Payroll (Total cost of my team's effort)
                                            const payrollCost = gridData.reduce((sum, row) => {
                                                let rowCost = 0;
                                                (['EXECUTIVE', 'DIRECTOR', 'MANAGER', 'DEPUTY', 'ASST', 'ASSOCIATE', 'JUNIOR'] as const).forEach(g => {
                                                    const base = rateSettings?.BaseRates?.find(r => r.Grade === g)?.BaseRateKRW || 0;
                                                    const mmVal = row[g as keyof GridRow];
                                                    const mm = (typeof mmVal === 'string') ? (parseFloat(mmVal.replace(/,/g, '')) || 0) : (Number(mmVal) || 0);
                                                    rowCost += mm * base;
                                                });
                                                return sum + rowCost;
                                            }, 0);

                                            // 3. Calculate Inbound Support Cost (Cost of others working on my projects)
                                            const inboundSupportCost = mmAllocations.reduce((outSum, m) => {
                                                if (m.MonthKey !== monthKey) return outSum;
                                                const tid = normalizeTeamId(teamId);
                                                if (normalizeTeamId(m.TeamID) === tid) return outSum;
                                                const p = projects.find(proj => proj.ProjectID === m.ProjectID);
                                                if (!p || normalizeTeamId(p.LeadSalesTeamID) !== tid) return outSum;
                                                let outboundRow = 0;
                                                (['EXECUTIVE', 'DIRECTOR', 'MANAGER', 'DEPUTY', 'ASST', 'ASSOCIATE', 'JUNIOR'] as const).forEach(g => {
                                                    const base = rateSettings?.BaseRates?.find(r => r.Grade === g)?.BaseRateKRW || 0;
                                                    const mm = Number(m[`MM_${g}` as keyof typeof m] || 0);
                                                    outboundRow += mm * base;
                                                });
                                                return outSum + outboundRow;
                                            }, 0);

                                            // Logic Update:
                                            // Resource Profit = (Support Revenue) - (Gross Labor + Inbound Support)
                                            const resourceExpenes = payrollCost + inboundSupportCost;
                                            const resourceProfit = earnedSupportRevenue - resourceExpenes;

                                            return (
                                                <>
                                                    {/* 1. Support Revenue Card */}
                                                    <div className="bg-[#EEF2FF] rounded-2xl p-6 border border-indigo-100 flex flex-col justify-between shadow-sm hover:shadow-md transition-all">
                                                        <div>
                                                            <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-1">Generate Revenue</p>
                                                            <h4 className="text-xs font-black text-indigo-600 mb-4 truncate">SUPPORT REVENUE</h4>
                                                            <p className="text-[10px] text-indigo-400/70 font-bold leading-tight">타 팀 지원 수익<br />(인건비 차감 전)</p>
                                                        </div>
                                                        <div className="mt-4 text-right">
                                                            <p className="text-2xl font-black text-indigo-600">
                                                                ₩{Math.round((earnedSupportRevenue || 0) / 1000000).toLocaleString()}M
                                                            </p>
                                                        </div>
                                                    </div>

                                                    {/* 2. Gross Labor Cost Card */}
                                                    <div className="bg-[#FFF1F2] rounded-2xl p-6 border border-rose-100 flex flex-col justify-between shadow-sm hover:shadow-md transition-all">
                                                        <div>
                                                            <p className="text-[10px] font-black text-rose-400 uppercase tracking-widest mb-1">Internal Resource</p>
                                                            <h4 className="text-xs font-black text-rose-600 mb-4 truncate">LABOR COST (GROSS)</h4>
                                                            <p className="text-[10px] text-rose-400/70 font-bold leading-tight">본진 인력 총 투입비<br />(수익 상계 전)</p>
                                                        </div>
                                                        <div className="mt-4 text-right">
                                                            <p className="text-2xl font-black text-rose-700">
                                                                ₩{Math.round((payrollCost || 0) / 1000000).toLocaleString()}M
                                                            </p>
                                                            <p className="text-[10px] font-bold text-rose-600 mt-1">
                                                                {gridData.reduce((sum, row) => sum + (Number(row.totalMM) || 0), 0).toFixed(2)} M/M
                                                            </p>
                                                        </div>
                                                    </div>

                                                    {/* 3. Inbound Support Card */}
                                                    <div className="bg-[#FFFBEB] rounded-2xl p-6 border border-amber-100 flex flex-col justify-between shadow-sm hover:shadow-md transition-all">
                                                        <div>
                                                            <p className="text-[10px] font-black text-amber-500 uppercase tracking-widest mb-1">External Resource</p>
                                                            <h4 className="text-xs font-black text-amber-600 mb-4 truncate">INBOUND SUPPORT</h4>
                                                            <p className="text-[10px] text-amber-400/70 font-bold leading-tight">타 팀 투입 비용<br />(지원 받음)</p>
                                                        </div>
                                                        <div className="mt-4 text-right">
                                                            <p className="text-2xl font-black text-amber-700">
                                                                ₩{Math.round((inboundSupportCost || 0) / 1000000).toLocaleString()}M
                                                            </p>
                                                        </div>
                                                    </div>

                                                    {/* 4. Total Resource Profit Card */}
                                                    <div className={cn(
                                                        "rounded-2xl p-6 border flex flex-col justify-between shadow-sm hover:shadow-md transition-all",
                                                        (resourceProfit || 0) >= 0 ? "bg-[#ECFDF5] border-emerald-100" : "bg-rose-50 border-rose-100"
                                                    )}>
                                                        <div>
                                                            <p className={cn("text-[10px] font-black uppercase tracking-widest mb-1", (resourceProfit || 0) >= 0 ? "text-emerald-500" : "text-rose-500")}>Operating Results</p>
                                                            <h4 className={cn("text-xs font-black mb-4 truncate", (resourceProfit || 0) >= 0 ? "text-emerald-600" : "text-rose-600")}>RESOURCE PROFIT</h4>
                                                            <p className={cn("text-[10px] font-bold leading-tight", (resourceProfit || 0) >= 0 ? "text-emerald-400/70" : "text-rose-400/70")}>리소스 실익<br />(수익 - 전체지출)</p>
                                                        </div>
                                                        <div className="mt-4 text-right">
                                                            <p className={cn("text-2xl font-black", (resourceProfit || 0) >= 0 ? "text-emerald-700" : "text-rose-700")}>
                                                                ₩{Math.round((resourceProfit || 0) / 1000000).toLocaleString()}M
                                                            </p>
                                                        </div>
                                                    </div>
                                                </>
                                            );
                                        })()}
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 text-sm text-blue-700 flex items-start gap-3">
                            <div className="font-bold">💡 Tip:</div>
                            <div>
                                <p>엑셀에서 <strong>[임원 ~ 사원]</strong>까지의 숫자 데이터만 드래그하여 복사(Ctrl+C)한 후, 테이블의 원하는 위치를 클릭하고 붙여넣기(Ctrl+V) 하세요.</p>
                            </div>
                        </div>
                    </div>
                )}

                {/* 4. Expense Tab */}
                {activeTab === 'EXPENSE' && (
                    <div className="space-y-8 animate-in fade-in slide-in-from-top-4 duration-500">
                        <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest opacity-60 border-b border-slate-50 pb-4">Variable Cost & Operational Expense Ledger</p>
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
                            <div className="col-span-2 lg:col-span-4 p-6 bg-slate-50/50 rounded-[2rem] border border-slate-100 ring-1 ring-white/50 text-center">
                                <p className="text-xs text-slate-400 font-bold">
                                    💁🏻‍♀️ 인력 투입(M/M)은 [인력관리(Resource)] 탭의 통합 계획표에서 관리해주세요.
                                </p>
                            </div>

                            <div className="p-2 space-y-2">
                                <Label className="text-[11px] font-black text-slate-400 uppercase tracking-widest leading-none mb-2 block">{t.labelOutsource} (KRW)</Label>
                                <Input type="text" value={outsourceCost.includes('.') ? outsourceCost : (outsourceCost === '' ? '' : Number(outsourceCost).toLocaleString())} onChange={e => {
                                    const val = e.target.value.replace(/,/g, '');
                                    if (val === '' || val === '.' || !isNaN(Number(val))) setOutsourceCost(val);
                                }} placeholder="0" className="h-12 rounded-xl font-black text-[#004442] border-slate-200" />
                            </div>

                            <div className="p-2 space-y-2">
                                <Label className="text-[11px] font-black text-slate-400 uppercase tracking-widest leading-none mb-2 block">{t.labelExpense} (KRW)</Label>
                                <Input type="text" value={expenseCost.includes('.') ? expenseCost : (expenseCost === '' ? '' : Number(expenseCost).toLocaleString())} onChange={e => {
                                    const val = e.target.value.replace(/,/g, '');
                                    if (val === '' || val === '.' || !isNaN(Number(val))) setExpenseCost(val);
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

                        {/* Expense List Table */}
                        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden mt-8">
                            <div className="p-4 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
                                <h3 className="font-bold text-slate-700">📋 지출 내역 목록 (List)</h3>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-xs text-left border-collapse">
                                    <thead className="bg-slate-50 text-slate-500 font-bold">
                                        <tr>
                                            <th className="p-3 border-b">Project</th>
                                            <th className="p-3 border-b text-right">Outsource</th>
                                            <th className="p-3 border-b text-right">Expense</th>
                                            <th className="p-3 border-b text-right">Total</th>
                                            <th className="p-3 border-b">Note</th>
                                            <th className="p-3 border-b w-[50px]"></th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {costExpenses.filter(e => e.MonthKey === monthKey && normalizeTeamId(e.TeamID) === normalizeTeamId(teamId)).length === 0 ? (
                                            <tr>
                                                <td colSpan={6} className="p-8 text-center text-slate-400">
                                                    No expense data found.
                                                </td>
                                            </tr>
                                        ) : (
                                            costExpenses
                                                .filter(e => e.MonthKey === monthKey && normalizeTeamId(e.TeamID) === normalizeTeamId(teamId))
                                                .map((item) => (
                                                    <tr key={item.id} className="hover:bg-slate-50/50">
                                                        <td className="p-3 font-medium text-slate-700">
                                                            {projects.find(p => p.ProjectID === item.ProjectID)?.ProjectName || item.ProjectID}
                                                        </td>
                                                        <td className="p-3 text-right text-slate-600">{(item.OutsourceCostKRW || 0).toLocaleString()}</td>
                                                        <td className="p-3 text-right text-slate-600">{(item.ExpenseCostKRW || 0).toLocaleString()}</td>
                                                        <td className="p-3 text-right font-bold text-rose-600">
                                                            {((item.OutsourceCostKRW || 0) + (item.ExpenseCostKRW || 0)).toLocaleString()}
                                                        </td>
                                                        <td className="p-3 text-slate-500 truncate max-w-[200px]">
                                                            {item.Note}
                                                        </td>
                                                        <td className="p-3 text-center">
                                                            {canEdit && (
                                                                <button
                                                                    onClick={() => handleDeleteCostExpense(item.id)}
                                                                    className="text-slate-300 hover:text-rose-500 transition-colors"
                                                                >
                                                                    🗑️
                                                                </button>
                                                            )}
                                                        </td>
                                                    </tr>
                                                ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div >
    );
}

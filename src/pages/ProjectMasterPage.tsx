import React, { useState, useMemo } from 'react';
import { useData } from '../context/DataContext';
import { useLanguage } from '../context/LanguageContext';
import { useToast } from '../context/ToastContext';
import { Button, Input, Select, Card, CardHeader, CardTitle, CardContent, Label } from '../components/ui-components';
import type { ProjectMaster, ProjectStatus } from '../types';
import { cn, downloadCSV } from '../lib/utils';

export default function ProjectMasterPage() {
    const { projects, teams, updateProject, bulkAddProjects, addProject, deleteProject } = useData();
    const { t } = useLanguage();
    const toast = useToast();

    const handleExportCSV = () => {
        const headers = ['ProjectID', 'ProjectName', 'Client', 'ContractAmountKRW', 'StartMonth', 'EndMonthPlan', 'LeadSalesTeamID', 'Status', 'Category'];
        downloadCSV(projects, headers, `projects_master_${new Date().toISOString().split('T')[0]}.csv`);
    };
    const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
    const [isAdding, setIsAdding] = useState(false);
    const [formData, setFormData] = useState<Partial<ProjectMaster>>({});

    // Phase 1 Search/Filter State
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState<ProjectStatus | 'ALL'>('ALL');

    const [newEntry, setNewEntry] = useState<Partial<ProjectMaster>>({
        ProjectID: '',
        ProjectName: '',
        Client: '',
        ContractAmountKRW: 0,
        LeadSalesTeamID: '',
        Status: 'ACTIVE',
        Category: 'INTERNAL',
        StartMonth: '2026-01',
        EndMonthPlan: '2026-12'
    });

    const filteredProjects = useMemo(() => {
        return projects.filter(p => {
            const matchesSearch = p.ProjectID.toLowerCase().includes(searchTerm.toLowerCase()) ||
                p.ProjectName.toLowerCase().includes(searchTerm.toLowerCase());
            const matchesStatus = statusFilter === 'ALL' || p.Status === statusFilter;
            return matchesSearch && matchesStatus;
        });
    }, [projects, searchTerm, statusFilter]);
    const fileInputRef = React.useRef<HTMLInputElement>(null);

    const salesTeams = teams.filter(t => t.TeamType === 'SALES');

    // DEBUG LOG
    console.log("ProjectMasterPage Teams:", teams);
    console.log("Filtered Sales Teams:", salesTeams);
    console.log("Team 3 Type:", teams.find(t => t.TeamID === 'TEAM_3')?.TeamType);

    const handleDelete = (projectId: string) => {
        if (window.confirm(`⚠️ 경고: 프로젝트(${projectId})를 삭제하시겠습니까?\n이 프로젝트와 연결된 모든 수금 및 지출 내역이 함께 삭제되며, 복구할 수 없습니다.`)) {
            deleteProject(projectId);
            if (selectedProjectId === projectId) {
                handleCancel();
            }
            toast.success("삭제되었습니다.");
        }
    };

    const handleCsvUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            const text = event.target?.result as string;
            if (!text) return;

            const lines = text.split(/\r?\n/).filter(line => line.trim().length > 0);
            if (lines.length <= 1) return toast.error("CSV file is empty or only contains header.");

            const newProjects: ProjectMaster[] = [];

            // Skip header (i=1)
            for (let i = 1; i < lines.length; i++) {
                const parts = lines[i].split(',').map(p => p.trim());
                if (parts.length < 8) continue;

                const [id, name, client, amount, start, end, teamId, status] = parts;

                newProjects.push({
                    ProjectID: id,
                    ProjectName: name,
                    Client: client,
                    ContractAmountKRW: Number(amount) || 0,
                    StartMonth: start,
                    EndMonthPlan: end,
                    LeadSalesTeamID: teamId,
                    Status: (status as ProjectStatus) || 'ACTIVE',
                    Category: 'INTERNAL' // Default category for CSV upload
                });
            }

            if (newProjects.length > 0) {
                bulkAddProjects(newProjects);
                toast.success(`${newProjects.length} projects imported (skipped existing IDs).`);
            }
            if (fileInputRef.current) fileInputRef.current.value = '';
        };
        reader.readAsText(file);
    };

    // When a project is selected from the table
    const handleSelectProject = (project: ProjectMaster) => {
        setIsAdding(false);
        setSelectedProjectId(project.ProjectID);
        setFormData({ ...project });
    };

    const handleStartAdd = () => {
        setSelectedProjectId(null);
        setIsAdding(true);
        setFormData({
            ProjectID: '',
            ProjectName: '',
            Client: '',
            ContractAmountKRW: 0,
            LeadSalesTeamID: '',
            Status: 'ACTIVE',
            Category: 'INTERNAL',
            StartMonth: '2026-01',
            EndMonthPlan: '2026-12'
        });
    };

    const handleInlineSubmit = () => {
        if (!newEntry.ProjectID || !newEntry.ProjectName) return toast.error(t.msgRequired);
        if (projects.find(p => p.ProjectID === newEntry.ProjectID)) return toast.error(t.msgDuplicateID);

        addProject(newEntry as ProjectMaster);
        setNewEntry({
            ProjectID: '',
            ProjectName: '',
            Client: '',
            ContractAmountKRW: 0,
            LeadSalesTeamID: '',
            Status: 'ACTIVE',
            Category: 'INTERNAL',
            StartMonth: '2026-01',
            EndMonthPlan: '2026-12'
        });
        toast.success(t.msgProjectSaved);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.ProjectName) return toast.error(t.msgRequired);

        if (isAdding) {
            if (!formData.ProjectID) return toast.error(t.msgRequired);
            if (projects.find(p => p.ProjectID === formData.ProjectID)) return toast.error(t.msgDuplicateID);

            addProject(formData as ProjectMaster);
            toast.success(t.msgProjectSaved);
            setIsAdding(false);
            setFormData({});
        } else {
            updateProject(formData as ProjectMaster);
            toast.success("Project updated successfully.");
        }
    };

    const handleCancel = () => {
        setSelectedProjectId(null);
        setIsAdding(false);
        setFormData({});
    };

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader className="p-8 border-b border-slate-50 flex flex-col md:flex-row items-center justify-between gap-6">
                    <div className="flex flex-col gap-1">
                        <h1 className="text-3xl font-black tracking-tighter text-[#004442] border-l-8 border-[#004442] pl-5 leading-none mb-4">
                            🏢 {t.titleProjectList}
                        </h1>
                        <div className="flex gap-4 items-center">
                            <div className="w-80 relative group">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-400 uppercase tracking-widest opacity-0 group-focus-within:opacity-100 transition-opacity">Search</span>
                                <Input
                                    placeholder={t.labelSearch}
                                    value={searchTerm}
                                    onChange={e => setSearchTerm(e.target.value)}
                                    className="h-11 pl-4 font-bold text-slate-800 focus:ring-[#004442] shadow-sm rounded-xl border-slate-200"
                                />
                            </div>
                            <div className="w-40">
                                <Select
                                    value={statusFilter}
                                    onChange={e => setStatusFilter(e.target.value as any)}
                                    className="h-11 font-black text-[#004442] border-slate-200 rounded-xl shadow-sm"
                                >
                                    <option value="ALL">{t.statusAll}</option>
                                    <option value="ACTIVE">{t.statusActive}</option>
                                    <option value="COMPLETED">{t.statusCompleted}</option>
                                    <option value="CANCELLED">{t.statusCancelled}</option>
                                </Select>
                            </div>
                        </div>
                    </div>
                    <div className="flex gap-2 items-center">
                        <input
                            type="file"
                            accept=".csv"
                            onChange={handleCsvUpload}
                            className="hidden"
                            ref={fileInputRef}
                        />
                        <Button
                            variant="secondary"
                            onClick={handleExportCSV}
                            className="h-11 px-6 rounded-xl border-slate-200 text-slate-600 font-black text-xs hover:bg-slate-50 transition-all flex items-center gap-2"
                        >
                            <span>📥 CSV DOWNLOAD</span>
                        </Button>
                        <Button
                            variant="secondary"
                            onClick={() => fileInputRef.current?.click()}
                            className="h-11 px-6 rounded-xl border-slate-200 text-slate-600 font-black text-xs hover:bg-slate-50 transition-all flex items-center gap-2"
                        >
                            <span>📤 BULK UPLOAD</span>
                        </Button>
                        <Button
                            onClick={handleStartAdd}
                            className="h-11 px-8 rounded-xl bg-[#004442] hover:bg-[#051c1b] text-white font-black text-sm shadow-lg shadow-emerald-900/20 transition-all flex items-center gap-2"
                        >
                            <span>➕ {t.btnRegister}</span>
                        </Button>
                    </div>
                </CardHeader>
                <CardContent>
                    {/* Desktop Table View (Hidden on mobile) */}
                    <div className="hidden lg:block overflow-x-auto max-h-[600px] border border-slate-100 rounded-2xl shadow-sm">
                        <table className="w-full text-sm text-left border-collapse min-w-[1200px]">
                            <thead className="bg-slate-50 text-slate-500 text-base font-black uppercase tracking-widest border-b sticky top-0 z-10">
                                <tr>
                                    <th className="px-6 py-5 whitespace-nowrap">{t.tableID}</th>
                                    <th className="px-6 py-5 min-w-[300px]">{t.tableName}</th>
                                    <th className="px-6 py-5 whitespace-nowrap">{t.tableClient}</th>
                                    <th className="px-6 py-5 text-right whitespace-nowrap">{t.tableAmount}</th>
                                    <th className="px-6 py-5 whitespace-nowrap">{t.tableTeam}</th>
                                    <th className="px-6 py-5 text-center whitespace-nowrap">{t.tableStatus}</th>
                                    <th className="px-6 py-5 text-center whitespace-nowrap">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {/* Inline Entry Row */}
                                <tr className="bg-emerald-50/50">
                                    <td className="px-4 py-4">
                                        <Input
                                            placeholder="ID"
                                            value={newEntry.ProjectID}
                                            onChange={e => setNewEntry({ ...newEntry, ProjectID: e.target.value })}
                                            className="h-10 text-xs font-black border-slate-200 bg-white"
                                        />
                                    </td>
                                    <td className="px-4 py-4">
                                        <Input
                                            placeholder="Project Name"
                                            value={newEntry.ProjectName}
                                            onChange={e => setNewEntry({ ...newEntry, ProjectName: e.target.value })}
                                            className="h-10 text-xs font-bold border-slate-200 bg-white"
                                        />
                                    </td>
                                    <td className="px-4 py-4">
                                        <Input
                                            placeholder="Client"
                                            value={newEntry.Client}
                                            onChange={e => setNewEntry({ ...newEntry, Client: e.target.value })}
                                            className="h-10 text-xs font-medium border-slate-200 bg-white"
                                        />
                                    </td>
                                    <td className="px-4 py-4">
                                        <Input
                                            type="number"
                                            placeholder="Amount"
                                            value={newEntry.ContractAmountKRW || ''}
                                            onChange={e => setNewEntry({ ...newEntry, ContractAmountKRW: Number(e.target.value) })}
                                            className="h-10 text-xs font-black text-right border-slate-200 bg-white"
                                        />
                                    </td>
                                    <td className="px-4 py-4">
                                        <Select
                                            value={newEntry.LeadSalesTeamID}
                                            onChange={e => setNewEntry({ ...newEntry, LeadSalesTeamID: e.target.value })}
                                            className="h-10 text-xs font-bold border-slate-200 bg-white"
                                        >
                                            <option value="">Team</option>
                                            {salesTeams.map(team => (
                                                <option key={team.TeamID} value={team.TeamID}>{team.TeamName.split('(')[0]}</option>
                                            ))}
                                        </Select>
                                    </td>
                                    <td className="px-4 py-4">
                                        <Select
                                            value={newEntry.Category}
                                            onChange={e => setNewEntry({ ...newEntry, Category: e.target.value as any })}
                                            className="h-10 text-xs font-bold border-slate-200 bg-white"
                                        >
                                            <option value="INTERNAL">자체</option>
                                            <option value="CROSS_DEPT">타부서</option>
                                            <option value="OVERSEAS">해외</option>
                                        </Select>
                                    </td>
                                    <td className="px-4 py-4">
                                        <Button className="h-10 w-full bg-[#004442] hover:bg-[#051c1b] text-white font-black text-xs shadow-md transition-all" onClick={handleInlineSubmit}>QUICK ADD</Button>
                                    </td>
                                </tr>
                                {filteredProjects.map(p => (
                                    <tr key={p.ProjectID} className={cn("border-b border-slate-50 hover:bg-slate-50/80 transition-colors group cursor-pointer", selectedProjectId === p.ProjectID && "bg-emerald-50/30")}>
                                        <td className="px-6 py-5 font-black text-slate-400 text-xs">{p.ProjectID}</td>
                                        <td className="px-6 py-5 font-bold text-slate-800 group-hover:text-[#004442] transition-colors">{p.ProjectName}</td>
                                        <td className="px-6 py-5 font-medium text-slate-600">{p.Client}</td>
                                        <td className="px-6 py-5 text-right font-black text-[#004442] text-base">₩{p.ContractAmountKRW.toLocaleString()}</td>
                                        <td className="px-6 py-5 font-bold text-slate-500">{teams.find(t => t.TeamID === p.LeadSalesTeamID)?.TeamName.split('(')[0]}</td>
                                        <td className="px-6 py-5 text-center whitespace-nowrap">
                                            <span className={cn(
                                                "px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-tighter inline-block whitespace-nowrap",
                                                p.Status === 'ACTIVE' ? "bg-emerald-100 text-emerald-700 shadow-sm" : "bg-slate-200 text-slate-700"
                                            )}>
                                                {p.Status === 'ACTIVE' ? t.statusActive :
                                                    p.Status === 'COMPLETED' ? t.statusCompleted : t.statusCancelled}
                                            </span>
                                        </td>
                                        <td className="px-6 py-5">
                                            <div className="flex gap-2 justify-center">
                                                <Button variant="secondary" onClick={() => handleSelectProject(p)} className="h-9 px-4 rounded-lg bg-white border-slate-200 font-black text-xs hover:bg-slate-50">EDIT</Button>
                                                <Button
                                                    className="h-9 px-4 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 font-black text-xs"
                                                    onClick={() => handleDelete(p.ProjectID)}
                                                >
                                                    DELETE
                                                </Button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Mobile/Compact Card View (Shown on mobile/tablet) */}
                    <div className="lg:hidden space-y-4">
                        {/* Mobile Search/Filter already covered in Header, focused on List here */}
                        {filteredProjects.map(p => (
                            <div key={p.ProjectID} className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4 transition-all active:scale-[0.98]" onClick={() => handleSelectProject(p)}>
                                <div className="flex justify-between items-start">
                                    <div className="flex flex-col gap-1">
                                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{p.ProjectID}</span>
                                        <h3 className="text-base font-black text-slate-800 leading-tight">{p.ProjectName}</h3>
                                    </div>
                                    <span className={cn(
                                        "px-2 py-1 rounded-full text-[9px] font-black uppercase tracking-tighter shrink-0",
                                        p.Status === 'ACTIVE' ? "bg-emerald-100 text-emerald-700 shadow-sm" : "bg-slate-200 text-slate-700"
                                    )}>
                                        {p.Status === 'ACTIVE' ? t.statusActive :
                                            p.Status === 'COMPLETED' ? t.statusCompleted : t.statusCancelled}
                                    </span>
                                </div>

                                <div className="grid grid-cols-2 gap-4 pt-2 border-t border-slate-50">
                                    <div>
                                        <p className="text-[9px] text-slate-400 font-bold uppercase mb-0.5">금액 (Amount)</p>
                                        <p className="text-sm font-black text-[#004442]">₩{p.ContractAmountKRW.toLocaleString()}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-[9px] text-slate-400 font-bold uppercase mb-0.5">주관부서 (Team)</p>
                                        <p className="text-sm font-bold text-slate-600">{teams.find(t => t.TeamID === p.LeadSalesTeamID)?.TeamName.split('(')[0]}</p>
                                    </div>
                                    <div>
                                        <p className="text-[9px] text-slate-400 font-bold uppercase mb-0.5">발주처 (Client)</p>
                                        <p className="text-sm font-medium text-slate-500">{p.Client || '-'}</p>
                                    </div>
                                </div>

                                <div className="flex gap-2 pt-2">
                                    <Button variant="secondary" className="flex-1 h-9 rounded-xl font-black text-[11px]" onClick={(e) => { e.stopPropagation(); handleSelectProject(p); }}>EDIT</Button>
                                    <Button className="flex-1 h-9 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 font-black text-[11px]" onClick={(e) => { e.stopPropagation(); handleDelete(p.ProjectID); }}>DELETE</Button>
                                </div>
                            </div>
                        ))}
                        {filteredProjects.length === 0 && (
                            <div className="py-20 text-center text-slate-400 font-bold">
                                No projects found.
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>

            {(selectedProjectId || isAdding) && (
                <Card className="animate-in fade-in slide-in-from-bottom-6 duration-500 border-slate-200 shadow-2xl rounded-3xl overflow-hidden mt-12 mb-20">
                    <CardHeader className="bg-[#004442] p-10">
                        <CardTitle className="text-2xl font-black text-white flex items-center gap-3">
                            <span className="w-2 h-8 bg-[#c4d600] rounded-full"></span>
                            {isAdding ? t.titleNewProject : `${t.tableName}: ${selectedProjectId}`}
                        </CardTitle>
                        <p className="text-emerald-200/60 text-[11px] font-black uppercase tracking-[0.2em] mt-2">DOHWA Master Project Registration & Lifecycle Management</p>
                    </CardHeader>
                    <CardContent className="p-10 bg-white">
                        <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-4">
                            <div className={cn("space-y-2", !isAdding && "opacity-60")}>
                                <Label className="text-[11px] font-black text-slate-400 uppercase tracking-widest leading-none mb-2 block">{t.labelID} {!isAdding && "(READ ONLY)"}</Label>
                                <Input
                                    value={formData.ProjectID || ''}
                                    onChange={e => isAdding && setFormData({ ...formData, ProjectID: e.target.value })}
                                    disabled={!isAdding}
                                    placeholder="Enter Project ID"
                                    className="h-12 rounded-xl font-black text-slate-800 border-slate-200 focus:ring-[#004442]"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-[11px] font-black text-slate-400 uppercase tracking-widest leading-none mb-2 block">{t.labelName}</Label>
                                <Input
                                    value={formData.ProjectName || ''}
                                    onChange={e => setFormData({ ...formData, ProjectName: e.target.value })}
                                    className="h-12 rounded-xl font-bold text-slate-800 border-slate-200 focus:ring-[#004442]"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-[11px] font-black text-slate-400 uppercase tracking-widest leading-none mb-2 block">{t.labelClient}</Label>
                                <Input
                                    value={formData.Client || ''}
                                    onChange={e => setFormData({ ...formData, Client: e.target.value })}
                                    className="h-12 rounded-xl font-bold text-slate-800 border-slate-200 focus:ring-[#004442]"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-[11px] font-black text-slate-400 uppercase tracking-widest leading-none mb-2 block">{t.labelAmount} (KRW)</Label>
                                <Input
                                    type="number"
                                    value={formData.ContractAmountKRW || 0}
                                    onChange={e => setFormData({ ...formData, ContractAmountKRW: Number(e.target.value) })}
                                    className="h-12 rounded-xl font-black text-slate-900 border-slate-200 focus:ring-[#004442]"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-[11px] font-black text-slate-400 uppercase tracking-widest leading-none mb-2 block">{t.labelStart}</Label>
                                <Input
                                    type="month"
                                    value={formData.StartMonth || ''}
                                    onChange={e => setFormData({ ...formData, StartMonth: e.target.value })}
                                    className="h-12 rounded-xl font-bold text-slate-800 border-slate-200 focus:ring-[#004442]"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-[11px] font-black text-slate-400 uppercase tracking-widest leading-none mb-2 block">{t.labelEnd}</Label>
                                <Input
                                    type="month"
                                    value={formData.EndMonthPlan || ''}
                                    onChange={e => setFormData({ ...formData, EndMonthPlan: e.target.value })}
                                    className="h-12 rounded-xl font-bold text-slate-800 border-slate-200 focus:ring-[#004442]"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-[11px] font-black text-slate-400 uppercase tracking-widest leading-none mb-2 block">{t.labelLeadTeam}</Label>
                                <Select
                                    value={formData.LeadSalesTeamID || ''}
                                    onChange={e => setFormData({ ...formData, LeadSalesTeamID: e.target.value })}
                                    className="h-12 rounded-xl font-bold text-slate-800 border-slate-200 focus:ring-[#004442]"
                                >
                                    <option value="">...</option>
                                    {salesTeams.map(team => (
                                        <option key={team.TeamID} value={team.TeamID}>
                                            {team.TeamName.split('(')[0]}
                                        </option>
                                    ))}
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label className="text-[11px] font-black text-slate-400 uppercase tracking-widest leading-none mb-2 block">{t.labelStatus}</Label>
                                <Select
                                    value={formData.Status || 'ACTIVE'}
                                    onChange={e => setFormData({ ...formData, Status: e.target.value as ProjectStatus })}
                                    className="h-12 rounded-xl font-bold text-slate-800 border-slate-200 focus:ring-[#004442]"
                                >
                                    <option value="ACTIVE">{t.statusActive}</option>
                                    <option value="COMPLETED">{t.statusCompleted}</option>
                                    <option value="CANCELLED">{t.statusCancelled}</option>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label className="text-[11px] font-black text-slate-400 uppercase tracking-widest leading-none mb-2 block">PROJECT CATEGORY</Label>
                                <Select
                                    value={formData.Category || 'INTERNAL'}
                                    onChange={e => setFormData({ ...formData, Category: e.target.value as any })}
                                    className="h-12 rounded-xl font-bold text-slate-800 border-slate-200 focus:ring-[#004442]"
                                >
                                    <option value="INTERNAL">부서 자체 수행</option>
                                    <option value="CROSS_DEPT">타부서 지원 수행</option>
                                    <option value="OVERSEAS">해외 과업 수행</option>
                                </Select>
                            </div>
                            <div className="col-span-2 pt-10 flex gap-4 justify-end">
                                <Button type="button" variant="ghost" onClick={handleCancel} className="h-12 px-8 rounded-xl font-black text-slate-400 hover:text-slate-600">CANCEL</Button>
                                <Button type="submit" className="h-12 px-10 rounded-xl bg-[#004442] hover:bg-[#051c1b] text-white font-black text-sm shadow-xl shadow-emerald-900/20 transition-all">
                                    {isAdding ? t.btnRegister : "SAVE PROJECT UPDATES"}
                                </Button>
                            </div>
                        </form>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}

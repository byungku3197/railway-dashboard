import { useState } from 'react';
import { useData } from '../context/DataContext';
import { useLanguage } from '../context/LanguageContext';
import { Button, Card, CardHeader, CardTitle, CardContent } from '../components/ui-components';
import { cn } from '../lib/utils';

export default function MonthControlPage() {
    const { teams, calendar, monthCloseControls, setMonthClose } = useData();
    const { t } = useLanguage();
    const [selectedYear, setSelectedYear] = useState(2026);

    const months = calendar.filter(c => c.Year === selectedYear);
    const inputTeams = teams.filter(t => t.TeamID.startsWith('TEAM_'));

    const toggleClose = (monthKey: string, teamId: string) => {
        const currentStatus = monthCloseControls.find(c => c.MonthKey === monthKey && c.TeamID === teamId)?.IsClosed || false;
        setMonthClose({
            id: `${monthKey}_${teamId}`,
            MonthKey: monthKey,
            TeamID: teamId,
            IsClosed: !currentStatus,
            ClosedBy: 'Admin',
            ClosedAt: new Date().toISOString()
        });
    };

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle className="flex justify-between items-center">
                        {t.titleMonthControl}
                        <select
                            className="ml-4 text-sm border rounded p-1"
                            value={selectedYear}
                            onChange={e => setSelectedYear(Number(e.target.value))}
                        >
                            <option value="2026">2026</option>
                            <option value="2027">2027</option>
                        </select>
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left border-collapse border">
                            <thead className="bg-gray-100">
                                <tr>
                                    <th className="p-3 border font-medium">{t.tableMonth}</th>
                                    {inputTeams.map(team => (
                                        <th key={team.TeamID} className="p-3 border font-medium text-center">
                                            <div className="text-xs text-gray-500">{team.TeamName.split('(')[0]}</div>
                                            {team.TeamType === 'SALES' ? t.salesTeam : t.supportTeam}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {months.map(m => (
                                    <tr key={m.MonthKey} className="hover:bg-gray-50">
                                        <td className="p-3 border font-bold">{m.MonthKey}</td>
                                        {inputTeams.map(team => {
                                            const isClosed = monthCloseControls.find(c => c.MonthKey === m.MonthKey && c.TeamID === team.TeamID)?.IsClosed;
                                            return (
                                                <td key={team.TeamID} className="p-2 border text-center">
                                                    <Button
                                                        variant={isClosed ? "destructive" : "secondary"}
                                                        className={cn(
                                                            "h-8 w-20 text-xs",
                                                            isClosed ? "bg-red-100 text-red-700 hover:bg-red-200" : "bg-green-100 text-green-700 hover:bg-green-200"
                                                        )}
                                                        onClick={() => toggleClose(m.MonthKey, team.TeamID)}
                                                    >
                                                        {isClosed ? t.btnClosed : t.btnOpen}
                                                    </Button>
                                                </td>
                                            );
                                        })}
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

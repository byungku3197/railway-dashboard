import { useState, useEffect } from 'react';
import { useData } from '../context/DataContext';
import { Card, CardHeader, CardTitle, CardContent, Input, Button, Label } from '../components/ui-components';
import type { AnnualGoal } from '../types';

export default function AnnualGoalsPage() {
    const { goals, updateGoal } = useData();

    // Goal State
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
    // Find existing goal or default to 0
    const currentGoal = goals.find(g => g.Year === selectedYear) || { Year: selectedYear, ContractGoal: 0, CollectionGoal: 0 };
    const [localGoal, setLocalGoal] = useState<AnnualGoal>(currentGoal);

    // Sync local goal when year changes or goals reload
    // Sync local goal when year changes
    useEffect(() => {
        const found = goals.find(g => g.Year === selectedYear);
        if (found) {
            setLocalGoal(found);
        } else {
            setLocalGoal({ Year: selectedYear, ContractGoal: 0, CollectionGoal: 0 });
        }
    }, [selectedYear]);

    // Initial load check: if we are viewing the default year and local goal is 0 but server has data, sync it once.
    useEffect(() => {
        const found = goals.find(g => g.Year === selectedYear);
        if (found && localGoal.ContractGoal === 0 && localGoal.CollectionGoal === 0) {
            setLocalGoal(found);
        }
    }, [goals]);

    const handleGoalChange = (field: 'ContractGoal' | 'CollectionGoal', value: number) => {
        setLocalGoal(prev => ({ ...prev, [field]: value }));
    };

    const handleSave = () => {
        updateGoal(localGoal);
        alert("목표 설정이 저장되었습니다.");
    };

    return (
        <div className="space-y-6">
            <h1 className="text-2xl font-bold">연간 목표 관리</h1>

            <Card>
                <CardHeader>
                    <CardTitle>연간 수주/수금 목표 설정 (단위: 원)</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="space-y-6">
                        {/* Year Selector */}
                        <div className="flex items-center gap-4">
                            <span className="font-bold text-lg">대상 연도:</span>
                            <div className="flex items-center bg-gray-100 rounded-lg p-1">
                                <Button variant="ghost" onClick={() => setSelectedYear(y => y - 1)}>&lt;</Button>
                                <span className="mx-4 font-black text-xl">{selectedYear}년</span>
                                <Button variant="ghost" onClick={() => setSelectedYear(y => y + 1)}>&gt;</Button>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 p-6 bg-slate-50 rounded-xl border border-slate-200">
                            <div className="space-y-2">
                                <Label className="text-base font-bold text-slate-700">연간 수주 목표액 (Contract Goal)</Label>
                                <div className="relative">
                                    <Input
                                        type="number"
                                        className="text-right text-lg font-bold pr-12"
                                        value={localGoal.ContractGoal || ''}
                                        onChange={(e) => handleGoalChange('ContractGoal', Number(e.target.value))}
                                        placeholder="0"
                                    />
                                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">원</span>
                                </div>
                                <p className="text-right text-sm text-slate-400 font-medium">
                                    {Number(localGoal.ContractGoal || 0).toLocaleString()} 원
                                </p>
                            </div>

                            <div className="space-y-2">
                                <Label className="text-base font-bold text-slate-700">연간 수금 목표액 (Collection Goal)</Label>
                                <div className="relative">
                                    <Input
                                        type="number"
                                        className="text-right text-lg font-bold pr-12"
                                        value={localGoal.CollectionGoal || ''}
                                        onChange={(e) => handleGoalChange('CollectionGoal', Number(e.target.value))}
                                        placeholder="0"
                                    />
                                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">원</span>
                                </div>
                                <p className="text-right text-sm text-slate-400 font-medium">
                                    {Number(localGoal.CollectionGoal || 0).toLocaleString()} 원
                                </p>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <div className="flex justify-end">
                <Button onClick={handleSave} className="bg-blue-600 hover:bg-blue-700 text-white px-8 h-12 text-lg">
                    목표 저장
                </Button>
            </div>
        </div>
    );
}

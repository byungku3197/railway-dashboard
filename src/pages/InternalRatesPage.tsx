import { useState } from 'react';
import { useData } from '../context/DataContext';
import { Card, CardHeader, CardTitle, CardContent, Input, Button, Label } from '../components/ui-components';
import type { GradeKey, ProjectCategory, RateSettings } from '../types';

export default function InternalRatesPage() {
    const { rateSettings, updateRateSettings } = useData();
    const [localSettings, setLocalSettings] = useState<RateSettings>(rateSettings);



    const grades: { key: GradeKey; label: string }[] = [
        { key: 'EXECUTIVE', label: '임원' },
        { key: 'DIRECTOR', label: '이사급' },
        { key: 'MANAGER', label: '부장급' },
        { key: 'DEPUTY', label: '차장급' },
        { key: 'ASST', label: '과장급' },
        { key: 'ASSOCIATE', label: '대리급' },
        { key: 'JUNIOR', label: '사원급' },
    ];

    const categories: { key: ProjectCategory; label: string }[] = [
        { key: 'INTERNAL', label: '부서 자체 수행' },
        { key: 'CROSS_DEPT', label: '타부서 수행' },
        { key: 'OVERSEAS', label: '해외과업 수행' },
    ];

    const handleBaseRateChange = (grade: GradeKey, value: number) => {
        const existing = localSettings.BaseRates.find(r => r.Grade === grade);
        let newBaseRates;
        if (existing) {
            newBaseRates = localSettings.BaseRates.map(r =>
                r.Grade === grade ? { ...r, BaseRateKRW: value } : r
            );
        } else {
            newBaseRates = [...localSettings.BaseRates, { Grade: grade, BaseRateKRW: value }];
        }
        setLocalSettings({ ...localSettings, BaseRates: newBaseRates });
    };

    const handleSurchargeChange = (category: ProjectCategory, value: number) => {
        const existing = localSettings.Surcharges.find(s => s.Category === category);
        let newSurcharges;
        if (existing) {
            newSurcharges = localSettings.Surcharges.map(s =>
                s.Category === category ? { ...s, Factor: value } : s
            );
        } else {
            newSurcharges = [...localSettings.Surcharges, { Category: category, Factor: value }];
        }
        setLocalSettings({ ...localSettings, Surcharges: newSurcharges });
    };

    const handleSave = () => {
        updateRateSettings(localSettings);
        alert("단가 설정이 저장되었습니다.");
    };



    return (
        <div className="space-y-6">
            <h1 className="text-2xl font-bold">내부 단가 및 할증 관리</h1>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* 1. 직급별 기준 단가 */}
                <Card>
                    <CardHeader>
                        <CardTitle>1. 직급별 기준 단가 (원/MM)</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            {grades.map(g => {
                                const rate = localSettings.BaseRates.find(r => r.Grade === g.key)?.BaseRateKRW || 0;
                                return (
                                    <div key={g.key} className="flex items-center justify-between">
                                        <Label className="w-24">{g.label}</Label>
                                        <Input
                                            type="number"
                                            value={rate}
                                            onChange={e => handleBaseRateChange(g.key, Number(e.target.value))}
                                            className="w-48 text-right"
                                        />
                                    </div>
                                );
                            })}
                        </div>
                    </CardContent>
                </Card>

                {/* 2. 과업 유형별 할증률 */}
                <Card>
                    <CardHeader>
                        <CardTitle>2. 과업 유형별 할증률 (배수)</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            {categories.map(c => {
                                const factor = localSettings.Surcharges.find(s => s.Category === c.key)?.Factor || 1;
                                return (
                                    <div key={c.key} className="flex items-center justify-between">
                                        <Label className="w-32">{c.label}</Label>
                                        <Input
                                            type="number"
                                            step="0.01"
                                            value={factor}
                                            onChange={e => handleSurchargeChange(c.key, Number(e.target.value))}
                                            className="w-48 text-right"
                                        />
                                    </div>
                                );
                            })}
                        </div>
                    </CardContent>
                </Card>
            </div>



            {/* 4. 최종 결과 미리보기 */}
            <Card>
                <CardHeader>
                    <CardHeader>
                        <CardTitle>3. 최종 적용 단가 시뮬레이션 (최종 단가 = 기준 단가 × 할증률)</CardTitle>
                    </CardHeader>
                </CardHeader>
                <CardContent>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-gray-100 uppercase">
                                <tr>
                                    <th className="px-4 py-2 text-center">직급</th>
                                    {categories.map(c => <th key={c.key} className="px-4 py-2 text-center">{c.label}</th>)}
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {grades.map(g => {
                                    const base = localSettings.BaseRates.find(r => r.Grade === g.key)?.BaseRateKRW || 0;
                                    return (
                                        <tr key={g.key}>
                                            <td className="px-4 py-3 font-medium text-center bg-gray-50">{g.label}</td>
                                            {categories.map(c => {
                                                const factor = localSettings.Surcharges.find(s => s.Category === c.key)?.Factor || 1;
                                                return (
                                                    <td key={c.key} className="px-4 py-3 text-right font-bold text-blue-600">
                                                        ₩ {(base * factor).toLocaleString()}
                                                    </td>
                                                );
                                            })}
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </CardContent>
            </Card>

            <div className="flex justify-end">
                <Button onClick={handleSave} className="bg-blue-600 hover:bg-blue-700 text-white px-8 h-12 text-lg">
                    설정값 저장 및 전체 적용
                </Button>
            </div>
        </div>
    );
}

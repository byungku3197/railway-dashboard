import os

file_path = r"c:\Users\user\Documents\카카오톡 받은 파일\railway-dashboard_V2\src\pages\DashboardHomePageV2.tsx"

with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
    lines = f.readlines()

# Line 88 (Index 87)
lines[87] = "        { id: 'TOTAL', name: '철도2부 (Total)' },\n"

# Line 503 (Index 502)
lines[502] = "            name: '철도2부 공통', revenue, expense, profit: revenue - expense\n"
lines[503] = "        };\n"
lines[504] = "    }, [teamSummaryData, projects, costExpenses, startMonth, endMonth, isManagedProject]);\n"

# Fix 713-715 (Wait, I need to check the indices again)
# 713:                     </div>
# 714:                         </div>
# 715:                 )}
lines[713] = "                        </div>\n"
lines[714] = "                    )}\n"
lines[715] = "                </div>\n"

# Fix 798
lines[797] = '                                        <p className="text-[10px] md:text-[11px] text-slate-400 font-black uppercase tracking-widest mt-1.5 px-3 md:px-5">누적 계약 대비 실제 수금액과 지출액의 흐름</p>\n'

# Fix 898
lines[897] = '                                                            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest leading-none block">지출 (Expense)</span>\n'

# Fix 908 (Original was: <div ...>?몄＜/吏€??/div>)
lines[907] = '                                                                <div className="text-[9px] text-slate-400 font-bold mb-0.5 whitespace-nowrap">외주/지원</div>\n'
lines[909] = '                                                                    <div className="text-[11px] font-bold text-slate-500">\n'
lines[910] = '                                                                        ₩{(team.outsource / 1000000).toFixed(1)}M\n'
lines[911] = '                                                                    </div>\n'

# Fix 1007
lines[1006] = '                                                    지출 (EXPENSE)\n'

# Fix 1016-1019
lines[1015] = '                                                <th className="px-4 py-3 text-right border-r border-slate-100 text-slate-600 font-bold">인건비 (Net)</th>\n'
lines[1016] = '                                                <th className="px-4 py-3 text-right border-r border-slate-100 text-slate-500">외주/지원 (Ext/Supp)</th>\n'
lines[1017] = '                                                <th className="px-4 py-3 text-right border-r border-slate-100 text-slate-500">기타 (Other)</th>\n'
lines[1018] = '                                                <th className="px-4 py-3 text-right border-r border-slate-100 bg-slate-100 text-slate-600 font-bold">합계 (Total)</th>\n'

with open(file_path, 'w', encoding='utf-8') as f:
    f.writelines(lines)

print("Dashboard fixed successfully.")

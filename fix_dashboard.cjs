const fs = require('fs');
const filePath = 'c:\\Users\\user\\Documents\\카카오톡 받은 파일\\railway-dashboard_V2\\src\\pages\\DashboardHomePageV2.tsx';

try {
    const data = fs.readFileSync(filePath, 'utf8');
    const lines = data.split(/\r?\n/);

    // 0-based index
    // Line 88 is index 87
    lines[87] = "        { id: 'TOTAL', name: '철도2부 (Total)' },";

    // Line 503 is index 502
    lines[502] = "            name: '철도2부 공통', revenue, expense, profit: revenue - expense };";
    // I noticed I previously tried to split 503 into multiple lines, but let's stick to the original structure to avoid shifting everything.

    // Line 713-715 (Index 712-714)
    // 713:                     </div>
    // 714:                         </div>
    // 715:                 )}
    lines[712] = "                        </div>";
    lines[713] = "                    )}";
    lines[714] = "                </div>";

    // Line 798 (Index 797)
    lines[797] = '                                        <p className="text-[10px] md:text-[11px] text-slate-400 font-black uppercase tracking-widest mt-1.5 px-3 md:px-5">누적 계약 대비 실제 수금액과 지출액의 흐름</p>';

    // Line 898 (Index 897)
    lines[897] = '                                                            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest leading-none block">지출 (Expense)</span>';

    // Line 908 (Index 907)
    lines[907] = '                                                                <div className="text-[9px] text-slate-400 font-bold mb-0.5 whitespace-nowrap">외주/지원</div>';

    // Line 910 (Index 909)
    lines[909] = '                                                                    <div className="text-[11px] font-bold text-slate-500">';
    lines[910] = '                                                                        ₩{(team.outsource / 1000000).toFixed(1)}M';
    lines[911] = '                                                                    </div>';

    // Line 1007 (Index 1006)
    lines[1006] = '                                                    지출 (EXPENSE)';

    // Line 1016-1019 (Index 1015-1018)
    lines[1015] = '                                                <th className="px-4 py-3 text-right border-r border-slate-100 text-slate-600 font-bold">인건비 (Net)</th>';
    lines[1016] = '                                                <th className="px-4 py-3 text-right border-r border-slate-100 text-slate-500">외주/지원 (Ext/Supp)</th>';
    lines[1017] = '                                                <th className="px-4 py-3 text-right border-r border-slate-100 text-slate-500">기타 (Other)</th>';
    lines[1018] = '                                                <th className="px-4 py-3 text-right border-r border-slate-100 bg-slate-100 text-slate-600 font-bold">합계 (Total)</th>';

    fs.writeFileSync(filePath, lines.join('\r\n'), 'utf8');
    console.log("File fixed successfully via Node.js (.cjs)");
} catch (err) {
    console.error("Error fixing file:", err);
    process.exit(1);
}

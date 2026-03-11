import type { CalendarMonth, TeamMaster } from "../types";

export const INITIAL_TEAMS: TeamMaster[] = [
    { TeamID: 'TEAM_1', TeamName: '1팀', TeamType: 'SALES', SortOrder: 1 },
    { TeamID: 'TEAM_2', TeamName: '2팀', TeamType: 'SALES', SortOrder: 2 },
    { TeamID: 'TEAM_3', TeamName: '3팀', TeamType: 'SALES', SortOrder: 3 },
    { TeamID: 'TEAM_4', TeamName: '4팀', TeamType: 'SALES', SortOrder: 4 },
    { TeamID: 'TEAM_5', TeamName: '5팀', TeamType: 'SALES', SortOrder: 5 },
    { TeamID: 'TEAM_OTHER', TeamName: '타부서', TeamType: 'SALES', SortOrder: 6 },
    { TeamID: 'TEAM_COMMON', TeamName: '2부공통', TeamType: 'SALES', SortOrder: 7 },
];

export const generateCalendar = (): CalendarMonth[] => {
    const startYear = 2026;
    const endYear = 2027;
    const calendar: CalendarMonth[] = [];

    for (let year = startYear; year <= endYear; year++) {
        for (let month = 1; month <= 12; month++) {
            const monthStr = month.toString().padStart(2, '0');
            calendar.push({
                MonthKey: `${year}-${monthStr}`,
                Year: year,
                Month: month,
                Quarter: Math.ceil(month / 3),
            });
        }
    }
    return calendar;
};

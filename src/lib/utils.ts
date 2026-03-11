import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

export function uuidv4() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

export function downloadCSV(data: any[], headers: string[], filename: string) {
    const csvContent = [
        headers.join(','),
        ...data.map(row => headers.map(header => {
            const cell = row[header] === null || row[header] === undefined ? '' : row[header];
            // Escape quotes and wrap in quotes if necessary
            const cellStr = cell.toString().replace(/"/g, '""');
            return `"${cellStr}"`;
        }).join(','))
    ].join('\n');

    const blob = new Blob(["\ufeff" + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

export function normalizeTeamId(id: string | undefined | null) {
    if (!id) return '';
    const sid = String(id).trim().toUpperCase();

    // 1. Handle "TEAM_5", "TEAM_05" -> "TEAM_5"
    const teamMatch = sid.match(/^TEAM_(\d+)$/i);
    if (teamMatch) return `TEAM_${parseInt(teamMatch[1])}`;

    // 2. Handle "5팀", "5 팀", "제5팀" -> "TEAM_5"
    const krMatch = sid.match(/(\d+)\s*팀/);
    if (krMatch) return `TEAM_${parseInt(krMatch[1])}`;

    return sid;
}

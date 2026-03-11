import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { GoogleSheetAdapter } from './googleSheetAdapter.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CREDENTIALS_FILE = path.join(__dirname, 'credentials.json');

const diagnostic = async () => {
    console.log("🔍 [Diagnostic] Checking MM_Allocations specifically...");

    if (!fs.existsSync(CREDENTIALS_FILE)) {
        console.error("❌ Credentials missing");
        return;
    }

    const credentials = JSON.parse(fs.readFileSync(CREDENTIALS_FILE, 'utf-8'));
    const adapter = new GoogleSheetAdapter(process.env.GOOGLE_SHEET_ID, credentials);

    try {
        await adapter.init();
        const data = await adapter.load();

        console.log("\n--- Data Statistics ---");
        console.log(`Teams: ${data.teams?.length || 0}`);
        console.log(`Projects: ${data.projects?.length || 0}`);
        console.log(`MM_Allocations: ${data.mmAllocations?.length || 0}`);

        if (data.mmAllocations && data.mmAllocations.length > 0) {
            console.log("\n--- Sample MM Allocation ---");
            console.log(JSON.stringify(data.mmAllocations[0], null, 2));

            // Check for specific team/month combos if known
            const teamsWithMM = [...new Set(data.mmAllocations.map(m => m.TeamID))];
            console.log("\nTeams with data:", teamsWithMM);
            const monthsWithMM = [...new Set(data.mmAllocations.map(m => m.MonthKey))];
            console.log("Months with data:", monthsWithMM);
        } else {
            console.log("\n⚠️ MM_Allocations is EMPTY on Google Sheets!");
        }

        // Check Local Backup too
        const DB_FILE = path.join(__dirname, 'db.json');
        if (fs.existsSync(DB_FILE)) {
            const local = JSON.parse(fs.readFileSync(DB_FILE, 'utf-8'));
            console.log(`\n--- Local Backup (db.json) Status ---`);
            console.log(`Local MM_Allocations: ${local.mmAllocations?.length || 0}`);
        }

    } catch (e) {
        console.error("❌ Diagnostic Failed:", e);
    }
};

diagnostic();

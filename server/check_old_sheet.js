import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { GoogleSheetAdapter } from './googleSheetAdapter.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CREDENTIALS_FILE = path.join(__dirname, 'credentials.json');

// OLD SHEET ID mentioned in previous logs
const OLD_SHEET_ID = '1WHwcJX5nrpZlDKTt9_nMMl3h9-W9gdipcVce23PReno';

const checkOldSheet = async () => {
    console.log(`🔍 [Recovery] Checking Old Sheet: ${OLD_SHEET_ID}`);

    if (!fs.existsSync(CREDENTIALS_FILE)) {
        console.error("❌ Credentials missing");
        return;
    }

    const credentials = JSON.parse(fs.readFileSync(CREDENTIALS_FILE, 'utf-8'));
    const adapter = new GoogleSheetAdapter(OLD_SHEET_ID, credentials);

    try {
        await adapter.init();
        const data = await adapter.load();

        console.log("\n--- Old Sheet Data Statistics ---");
        console.log(`Projects: ${data.projects?.length || 0}`);
        console.log(`Collections(AR): ${data.arCollections?.length || 0}`);
        console.log(`Expenses(Cost): ${data.costExpenses?.length || 0}`);
        console.log(`MM_Allocations: ${data.mmAllocations?.length || 0}`);

        if (data.mmAllocations && data.mmAllocations.length > 0) {
            console.log("\n--- Sample MM Allocation from Old Sheet ---");
            console.log(JSON.stringify(data.mmAllocations[0], null, 2));

            const teamsWithMM = [...new Set(data.mmAllocations.map(m => m.TeamID))];
            console.log("\nTeams with data in old sheet:", teamsWithMM);
            const monthsWithMM = [...new Set(data.mmAllocations.map(m => m.MonthKey))];
            console.log("Months with data in old sheet:", monthsWithMM);

            // SAVE TO TEMP FILE for recovery
            fs.writeFileSync(path.join(__dirname, 'recovered_data.json'), JSON.stringify(data, null, 2));
            console.log("\n💾 Data from old sheet has been backed up to 'recovered_data.json'");
        } else {
            console.log("\n⚠️ OLD Sheet also appears to have NO MM_Allocations!");
        }

    } catch (e) {
        console.error("❌ Recovery Check Failed:", e);
    }
};

checkOldSheet();

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { GoogleSheetAdapter } from './googleSheetAdapter.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CREDENTIALS_FILE = path.join(__dirname, 'credentials.json');

const verify = async () => {
    console.log("🔍 Verifying Google Sheet Data...");
    console.log("Sheet ID:", process.env.GOOGLE_SHEET_ID);

    if (!fs.existsSync(CREDENTIALS_FILE)) {
        console.error("❌ Credentials file missing");
        return;
    }

    const credentials = JSON.parse(fs.readFileSync(CREDENTIALS_FILE, 'utf-8'));
    const adapter = new GoogleSheetAdapter(process.env.GOOGLE_SHEET_ID, credentials);

    try {
        await adapter.init();
        const data = await adapter.load();

        console.log("--- Google Sheet Data Summary ---");
        console.log("Projects:", data.projects?.length || 0);
        console.log("Collections:", data.arCollections?.length || 0);
        console.log("Allocations:", data.mmAllocations?.length || 0);
        console.log("Teams:", data.teams?.length || 0);
        console.log("Password:", data.settings?.password);
        console.log("GlobalPassword:", data.globalPassword);

        if (data.projects && data.projects.length > 0) {
            console.log("Sample Project:", data.projects[0].ProjectName);
        }
    } catch (e) {
        console.error("❌ Verification Failed:", e);
    }
};

verify();

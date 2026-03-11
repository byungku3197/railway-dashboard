import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { GoogleSheetAdapter } from './googleSheetAdapter.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DB_FILE = path.join(__dirname, 'db.json');
const CREDENTIALS_FILE = path.join(__dirname, 'credentials.json');

const migrateSafer = async () => {
    console.log("🚀 Starting SAFE Data Migration...");

    if (!fs.existsSync(DB_FILE)) {
        console.error("❌ db.json missing");
        return;
    }

    const localData = JSON.parse(fs.readFileSync(DB_FILE, 'utf-8'));
    const credentials = JSON.parse(fs.readFileSync(CREDENTIALS_FILE, 'utf-8'));
    const adapter = new GoogleSheetAdapter(process.env.GOOGLE_SHEET_ID, credentials);

    try {
        await adapter.init();
        console.log(`✅ Connected to: ${adapter.doc.title}`);

        // Prepare data matching schema
        const dataToSave = { ...localData };
        if (dataToSave.rateSettings) {
            dataToSave.rateSettings_Base = dataToSave.rateSettings.BaseRates || [];
            dataToSave.rateSettings_Surcharges = dataToSave.rateSettings.Surcharges || [];
        }

        const schemaKeys = Object.entries(adapter.schema);

        for (const [key, sheetTitle] of schemaKeys) {
            const items = dataToSave[key];
            const rows = Array.isArray(items) ? items : (key === 'settings' ? Object.entries(items || {}).map(([k, v]) => ({ Key: k, Value: v })) : []);

            console.log(`📝 Processing [${sheetTitle}]: ${rows.length} rows...`);

            let sheet = adapter.doc.sheetsByTitle[sheetTitle];
            if (!sheet) {
                console.log(`   + Creating sheet [${sheetTitle}]`);
                sheet = await adapter.doc.addSheet({ title: sheetTitle });
            }

            if (rows.length > 0) {
                const headers = Object.keys(rows[0]);

                await new Promise(r => setTimeout(r, 2000)); // Be extremely generous with rate limit
                await sheet.clear();
                console.log(`   - Cleared [${sheetTitle}]`);

                await new Promise(r => setTimeout(r, 500));
                await sheet.setHeaderRow(headers);
                console.log(`   - Headers set for [${sheetTitle}]`);

                await new Promise(r => setTimeout(r, 500));
                await sheet.addRows(rows);
                console.log(`   ✅ [${sheetTitle}] complete!`);
            } else {
                await sheet.clear();
                console.log(`   ⚪ [${sheetTitle}] cleared (empty).`);
            }
        }

        console.log("🎉 ALL DATA MIGRATED SUCCESSFULLY!");
    } catch (e) {
        console.error("🔥 CRITICAL MIGRATION ERROR:", e);
    }
};

migrateSafer();

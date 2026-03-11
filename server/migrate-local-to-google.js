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

const migrate = async () => {
    console.log("🚀 Starting Data Migration: Local db.json -> Google Sheets");

    // 1. Read Local DB
    if (!fs.existsSync(DB_FILE)) {
        console.error("❌ Error: server/db.json not found!");
        process.exit(1);
    }
    const localData = JSON.parse(fs.readFileSync(DB_FILE, 'utf-8'));
    console.log(`✅ Loaded local data: Teams(${localData.teams?.length || 0}), Projects(${localData.projects?.length || 0})`);

    // 2. Connect to Google Sheets
    if (!process.env.GOOGLE_SHEET_ID) {
        console.error("❌ Error: GOOGLE_SHEET_ID is missing in .env file");
        process.exit(1);
    }
    if (!fs.existsSync(CREDENTIALS_FILE)) {
        console.error("❌ Error: server/credentials.json not found!");
        process.exit(1);
    }

    let credentials;
    try {
        credentials = JSON.parse(fs.readFileSync(CREDENTIALS_FILE, 'utf-8'));
    } catch (e) {
        console.error("❌ Error: Failed to parse server/credentials.json");
        process.exit(1);
    }

    const adapter = new GoogleSheetAdapter(process.env.GOOGLE_SHEET_ID, credentials);

    try {
        await adapter.init();
        console.log(`✅ Connected to Google Sheet: ${adapter.doc.title}`);

        // 3. Save to Sheets
        console.log("📤 Uploading data to Google Sheets... (This may take a few seconds)");
        await adapter.save(localData);

        console.log("🎉 Migration Complete! Your local data is now on Google Drive.");
        console.log("⚠️  IMPORTANT: Go to Render Dashboard -> Manual Deploy -> Restart Service to load the new data.");
    } catch (e) {
        console.error("❌ Migration Failed:", e);
    }
};

migrate();

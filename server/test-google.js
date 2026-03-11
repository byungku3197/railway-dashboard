
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleSheetAdapter } from './googleSheetAdapter.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CREDENTIALS_FILE = path.join(__dirname, 'credentials.json');

async function testConnection() {
    console.log("--- Testing Google Sheet Connection ---");

    if (!fs.existsSync(CREDENTIALS_FILE)) {
        console.error("❌ ERROR: credentials.json not found in server/ folder.");
        process.exit(1);
    }

    if (!process.env.GOOGLE_SHEET_ID) {
        console.error("❌ ERROR: GOOGLE_SHEET_ID not found in .env file.");
        process.exit(1);
    }

    try {
        const credentials = JSON.parse(fs.readFileSync(CREDENTIALS_FILE, 'utf-8'));
        const sheetId = process.env.GOOGLE_SHEET_ID;

        console.log(`Using Sheet ID: ${sheetId}`);
        console.log(`Using Service Account: ${credentials.client_email}`);

        const adapter = new GoogleSheetAdapter(sheetId, credentials);
        await adapter.init();

        console.log("✅ Connection Successful!");
        console.log(`Title: ${adapter.doc.title}`);

        console.log("Attempting to write test data...");
        await adapter.save({
            test_sheet: [{ message: "Hello from Railway Dashboard Test", timestamp: new Date().toISOString() }]
        });
        console.log("✅ Write Successful!");

        process.exit(0);

    } catch (error) {
        console.error("❌ CONNECTION FAILED:", error);
        process.exit(1);
    }
}

testConnection();

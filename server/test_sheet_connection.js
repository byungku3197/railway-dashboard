
import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CREDENTIALS_FILE = path.join(__dirname, 'credentials.json');
const SHEET_ID = '1f2Hiz-cfA9xRJDcwNXtZkYWLwpOpb3mUSpoTCuAWfTc';

async function testConnection() {
    try {
        if (!fs.existsSync(CREDENTIALS_FILE)) {
            console.error('❌ Error: credentials.json not found.');
            process.exit(1);
        }

        const creds = JSON.parse(fs.readFileSync(CREDENTIALS_FILE, 'utf-8'));
        const serviceAccountAuth = new JWT({
            email: creds.client_email,
            key: creds.private_key,
            scopes: ['https://www.googleapis.com/auth/spreadsheets'],
        });

        const doc = new GoogleSpreadsheet(SHEET_ID, serviceAccountAuth);

        console.log(`Connecting to Sheet ID: ${SHEET_ID}...`);
        await doc.loadInfo();

        console.log(`✅ SUCCESS! Connected to: "${doc.title}"`);
        console.log(`- Sheets count: ${doc.sheetCount}`);

    } catch (err) {
        console.error('❌ Connection Failed!');
        console.error(err.message);
        if (err.response) {
            console.error('Status:', err.response.status);
            console.error('Data:', err.response.data);
        }
    }
}

testConnection();

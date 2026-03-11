
import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CREDENTIALS_FILE = path.join(__dirname, 'credentials.json');
const USER_EMAIL = 's0000dragon@gmail.com';

async function createSheet() {
    try {
        if (!fs.existsSync(CREDENTIALS_FILE)) {
            console.error('❌ Error: credentials.json not found in server folder.');
            process.exit(1);
        }

        const creds = JSON.parse(fs.readFileSync(CREDENTIALS_FILE, 'utf-8'));

        const serviceAccountAuth = new JWT({
            email: creds.client_email,
            key: creds.private_key,
            scopes: ['https://www.googleapis.com/auth/spreadsheets', 'https://www.googleapis.com/auth/drive.file'],
        });

        console.log('Creates a new Sheet with title "Railway Dashboard DB"...');
        const doc = await GoogleSpreadsheet.createNewSpreadsheetDocument(serviceAccountAuth, {
            title: 'Railway Dashboard DB'
        });

        console.log(`✅ Sheet Created! ID: ${doc.spreadsheetId}`);
        console.log(`URL: ${doc.getUrl()}`);

        console.log(`Sharing with ${USER_EMAIL}...`);
        try {
            await doc.share(USER_EMAIL, { role: 'writer', type: 'user' }); // 'writer' is Editor
            console.log(`✅ Successfully shared with ${USER_EMAIL}`);
        } catch (shareError) {
            console.error('⚠️ Failed to share:', shareError.message);
            console.log('Please share it manually if needed.');
        }

        console.log('\n--- RESULT ---');
        console.log('GOOGLE_SHEET_ID:', doc.spreadsheetId);

    } catch (err) {
        console.error('❌ Failed to create sheet.');
        console.error('Error Message:', err.message);
        if (err.response) {
            console.error('Response Status:', err.response.status);
            console.error('Response Data:', JSON.stringify(err.response.data, null, 2));
        }
    }
}

createSheet();

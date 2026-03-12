
import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { GoogleSheetAdapter } from './googleSheetAdapter.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001; // Allow Render to set PORT
const DB_FILE = path.join(__dirname, 'db.json');
const CREDENTIALS_FILE = path.join(__dirname, 'credentials.json');

app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Initial Data Structure
const INITIAL_TEAMS = [
    { TeamID: 'TEAM_1', TeamName: '1팀', TeamType: 'SALES', SortOrder: 1 },
    { TeamID: 'TEAM_2', TeamName: '2팀', TeamType: 'SALES', SortOrder: 2 },
    { TeamID: 'TEAM_3', TeamName: '3팀', TeamType: 'SALES', SortOrder: 3 },
    { TeamID: 'TEAM_4', TeamName: '4팀', TeamType: 'SALES', SortOrder: 4 },
    { TeamID: 'TEAM_5', TeamName: '5팀', TeamType: 'SALES', SortOrder: 5 },
];

const generateCalendar = () => {
    const startYear = 2026;
    const endYear = 2027;
    const calendar = [];

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

const INITIAL_DATA = {
    teams: INITIAL_TEAMS,
    projects: [],
    calendar: generateCalendar(),
    internalRates: [],
    rateSettings: { BaseRates: [], Surcharges: [] }, // Critical fix: frontend expects this structure
    arCollections: [],
    costExpenses: [],
    mmAllocations: [],
    monthCloseControls: [],
    globalPassword: '0',
    settings: { password: '0' }
};

// --- Storage Abstraction ---
let googleAdapter = null;
let cachedData = null; // Memory cache for performance

const initStorage = async () => {
    // 1. Check for Google Credentials
    let credentials = null;
    if (process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
        try {
            credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
        } catch (e) {
            console.error("Failed to parse GOOGLE_SERVICE_ACCOUNT_JSON");
        }
    } else if (fs.existsSync(CREDENTIALS_FILE)) {
        try {
            credentials = JSON.parse(fs.readFileSync(CREDENTIALS_FILE, 'utf-8'));
        } catch (e) {
            console.error("Failed to parse credentials.json");
        }
    }

    const sheetId = process.env.GOOGLE_SHEET_ID;

    if (credentials && sheetId) {
        console.log("Starting in GOOGLE DRIVE mode.");
        googleAdapter = new GoogleSheetAdapter(sheetId, credentials);
        let retries = 5;
        while (retries > 0) {
            try {
                cachedData = await googleAdapter.load();
                if (!cachedData || Object.keys(cachedData).length === 0) {
                    console.log("⚠️ Google Sheet is empty, initializing with default data.");
                    cachedData = JSON.parse(JSON.stringify(INITIAL_DATA));
                    await googleAdapter.save(cachedData);
                } else if (cachedData._isCleaned) {
                    console.log("🧹 Data cleaned during load (duplicates removed). Syncing back to Google Sheet...");
                    delete cachedData._isCleaned; // Remove the internal flag before saving
                    await googleAdapter.save(cachedData);
                    console.log("✅ Synced cleaned data to Google Sheet.");
                } else {
                    console.log(`✅ Loaded Data from Google: Projects(${cachedData.projects?.length}), Collections(${cachedData.arCollections?.length})`);
                }
                break; // Success
            } catch (err) {
                console.error(`❌ Load Attempt Failed (${6 - retries}/5):`, err.message);
                retries--;
                if (retries === 0) {
                    console.error("🔥 CRITICAL: Failed to load data from Google Sheets after multiple attempts. Server exiting to prevent data loss.");
                    process.exit(1); // Force exit to avoid overwriting DB with empty data
                }
                // Exponential backoff
                const delay = 2000 * (6 - retries);
                console.log(`Waiting ${delay}ms before retry...`);
                await new Promise(r => setTimeout(r, delay));
            }
        }
    } else {
        console.log("Starting in LOCAL FILE mode.");
        if (fs.existsSync(DB_FILE)) {
            try {
                cachedData = JSON.parse(fs.readFileSync(DB_FILE, 'utf-8'));
            } catch (e) {
                console.error("Corrupt DB file, resetting.");
                cachedData = JSON.parse(JSON.stringify(INITIAL_DATA));
            }
        } else {
            cachedData = JSON.parse(JSON.stringify(INITIAL_DATA));
            fs.writeFileSync(DB_FILE, JSON.stringify(INITIAL_DATA, null, 2), 'utf-8');
        }
    }

    // Ensure structure integrity on load (Deep merge or just key checks)
    if (!cachedData) cachedData = JSON.parse(JSON.stringify(INITIAL_DATA)); // Double safety
    if (!cachedData) cachedData = JSON.parse(JSON.stringify(INITIAL_DATA)); // Double safety

    // FORCE SYNC: Only initialize Teams if missing. DO NOT OVERWRITE existing data.
    if (!cachedData.teams || cachedData.teams.length === 0) {
        console.log("⚠️ No teams found, initializing with default teams.");
        cachedData.teams = INITIAL_TEAMS;
    }
    if (!cachedData.calendar) cachedData.calendar = generateCalendar();
    if (!cachedData.settings) cachedData.settings = {};
    if (!cachedData.settings.password || cachedData.settings.password === '0000') {
        cachedData.settings.password = '0';
    }
    // Sync top-level globalPassword for frontend LoginPage
    cachedData.globalPassword = cachedData.settings.password;

    if (!cachedData.rateSettings) cachedData.rateSettings = { BaseRates: [], Surcharges: [] }; // Critical safety check
    console.log(`🔑 Current System Password: "${cachedData.settings.password}" (Global: "${cachedData.globalPassword}")`);
    console.log("🚀 Server Initialization Complete. Storage mode check finished.");
};

const getData = () => {
    return cachedData;
};

// Mutex to prevent race conditions during save
let isSaving = false;
const saveQueue = [];

const processSaveQueue = async () => {
    if (isSaving) return;
    if (saveQueue.length === 0) return;

    isSaving = true;
    const { newData, resolve, reject } = saveQueue.shift();

    try {
        cachedData = newData; // Update cache immediately

        if (googleAdapter) {
            console.log("💾 Starting Google Sheet Sync...");
            let retries = 3;
            while (retries > 0) {
                try {
                    await googleAdapter.save(newData);
                    console.log("✅ Google Sheet Sync Complete");
                    break;
                } catch (saveErr) {
                    console.error(`❌ Google Save Failed (${4 - retries}/3):`, saveErr.message);
                    retries--;
                    if (retries === 0) throw saveErr; // Final failure
                    await new Promise(r => setTimeout(r, 2000)); // Wait 2s before retry
                }
            }
        } else {
            fs.writeFileSync(DB_FILE, JSON.stringify(newData, null, 2), 'utf-8');
        }
        resolve();
    } catch (err) {
        console.error("❌ Save Failed Final:", err);
        // We do NOT reject() here if we want the frontend to continue optimistically, 
        // but rejecting is better to alert the user. 
        // However, since we updated 'cachedData' in memory, the server "thinks" it has the new data.
        // If we reject, frontend might rollback.
        reject(err);
    } finally {
        isSaving = false;
        // Process next item if any
        if (saveQueue.length > 0) {
            processSaveQueue();
        }
    }
};

const saveData = (newData) => {
    // OPTIMISTIC CACHE UPDATE: Ensure GET requests see the new data immediately 
    // while the Google Sheet Sync happens in the background.
    cachedData = newData;

    return new Promise((resolve, reject) => {
        saveQueue.push({ newData, resolve, reject });
        processSaveQueue();
    });
};

// Initialize Storage on Start
initStorage();

// API Endpoints
app.post('/api/verify-password', (req, res) => {
    try {
        const { password } = req.body;
        const data = getData();
        const currentPassword = String(data.settings?.password || '');
        const inputPassword = String(password || '');

        console.log(`🔐 Password Attempt: Input("${inputPassword}"), Current("${currentPassword}")`);

        if (inputPassword === currentPassword) {
            res.json({ success: true });
        } else {
            res.status(401).json({ success: false, message: 'Invalid Password' });
        }
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to verify password' });
    }
});

// Debug Storage Mode - Moved up for priority
app.get('/api/debug-storage', (req, res) => {
    console.log("🔍 Received request for /api/debug-storage");
    try {
        res.json({
            mode: googleAdapter ? 'GOOGLE DRIVE' : 'LOCAL FILE',
            sheetId: process.env.GOOGLE_SHEET_ID || 'not set',
            hasCredentials: !!(process.env.GOOGLE_SERVICE_ACCOUNT_JSON || fs.existsSync(CREDENTIALS_FILE)),
            serverTime: new Date().toISOString(),
            status: 'Server is running'
        });
    } catch (err) {
        console.error("❌ Debug endpoint failed:", err);
        res.status(500).json({ error: err.message });
    }
});

// Update Password
app.post('/api/update-password', async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;
        const data = getData();
        const storedPassword = data.settings?.password;

        if (currentPassword !== storedPassword) {
            return res.status(401).json({ success: false, message: 'Invalid Current Password' });
        }

        data.settings.password = newPassword;
        await saveData(data);
        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to update password' });
    }
});

// Get Data
app.get('/api/data', (req, res) => {
    try {
        const data = getData();

        // EMERGENCY FIX: Force overwrite TeamType on READ to ensure frontend gets SALES
        if (data && data.teams) {
            data.teams = data.teams.map(t => {
                if (['TEAM_1', 'TEAM_2', 'TEAM_3', 'TEAM_4', 'TEAM_5'].includes(t.TeamID)) {
                    return { ...t, TeamType: 'SALES' };
                }
                return t;
            });
        }

        console.log("Serving /api/data. Teams count:", data.teams.length);
        if (data.teams.length > 0) {
            console.log("Sample Teams:", data.teams.map(t => `${t.TeamID}:${t.TeamType}`).join(', '));
        }
        res.json(data);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to read data' });
    }
});

// Save Data
app.post('/api/data', async (req, res) => {
    try {
        const newData = req.body;
        await saveData(newData);
        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to save data' });
    }
});

// Serve Static Files (Frontend)
const DIST_PATH = path.join(__dirname, '../dist');
if (fs.existsSync(DIST_PATH)) {
    console.log("Serving static files from:", DIST_PATH);
    app.use(express.static(DIST_PATH));
    app.get(/(.*)/, (req, res) => {
        res.sendFile(path.join(DIST_PATH, 'index.html'));
    });
}


app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running at http://0.0.0.0:${PORT}`);
});

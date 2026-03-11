import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';
import { randomUUID } from 'crypto';

export class GoogleSheetAdapter {
    constructor(sheetId, credentials) {
        this.sheetId = sheetId;
        this.credentials = credentials;
        this.doc = null;

        this.schema = {
            'teams': 'Teams',
            'projects': 'Projects',
            'calendar': 'Calendar',
            'rateSettings_Base': 'Rates_Base',
            'rateSettings_Surcharges': 'Rates_Surcharges',
            'arCollections': 'AR_Collections',
            'costExpenses': 'Cost_Expenses',
            'mmAllocations': 'MM_Allocations',
            'monthCloseControls': 'MonthCloseControls',
            'goals': 'Goals',
            'users': 'Users',
            'settings': 'Settings'
        };

        // Configuration for split sheets
        this.splitConfig = {
            'mmAllocations': { prefix: 'MM_', teamField: 'TeamID' },
            'arCollections': { prefix: 'COL_', teamField: 'TeamID' },
            'costExpenses': { prefix: 'EXP_', teamField: 'TeamID' },
            'projects': { prefix: 'PRJ_', teamField: 'LeadSalesTeamID' }
        };
    }

    async init() {
        const serviceAccountAuth = new JWT({
            email: this.credentials.client_email,
            key: this.credentials.private_key,
            scopes: ['https://www.googleapis.com/auth/spreadsheets'],
        });

        this.doc = new GoogleSpreadsheet(this.sheetId, serviceAccountAuth);
        await this.doc.loadInfo();
        console.log(`Connected to Google Sheet: ${this.doc.title}`);
    }

    async load() {
        if (!this.doc) await this.init();

        const data = {};
        const splitDataAccumulator = {};
        Object.keys(this.splitConfig).forEach(key => splitDataAccumulator[key] = []);

        for (const [key, sheetTitle] of Object.entries(this.schema)) {
            // Split keys are handled dynamically via prefixes later
            if (this.splitConfig[key]) continue;

            let sheet = this.doc.sheetsByTitle[sheetTitle];
            if (!sheet) {
                data[key] = key === 'settings' ? {} : [];
                continue;
            }

            let rows = [];
            try {
                rows = await sheet.getRows();
            } catch (e) {
                data[key] = (key === 'settings') ? {} : [];
                continue;
            }

            if (key === 'settings') {
                const settings = {};
                rows.forEach(row => {
                    const k = row.get('Key');
                    const v = row.get('Value');
                    if (k) settings[k] = v;
                });
                data[key] = settings;
                if (settings.password) data.globalPassword = settings.password;
            } else {
                const rawItems = rows.map(row => this._mapRowToObject(row));
                data[key] = this._ensureIdsAndDeduplicate(key, rawItems);
            }
        }

        // --- Load Dynamic Split Sheets (MM_, COL_, PRJ_, EXP_) ---
        for (const sheet of this.doc.sheetsByIndex) {
            for (const [key, config] of Object.entries(this.splitConfig)) {
                // If the sheet title starts with the prefix OR is exactly the legacy title
                const legacySheetName = this.schema[key];
                if (sheet.title === legacySheetName || sheet.title.startsWith(config.prefix)) {
                    console.log(`📂 Loading ${key} data from sheet: ${sheet.title}`);
                    try {
                        const rows = await sheet.getRows();
                        const items = rows.map(row => this._mapRowToObject(row));
                        splitDataAccumulator[key].push(...items);
                    } catch (e) {
                        console.warn(`⚠️ Failed to load ${key} sheet ${sheet.title}: ${e.message}`);
                    }
                }
            }
        }

        // Merge accumulated split data
        Object.entries(splitDataAccumulator).forEach(([key, items]) => {
            data[key] = this._ensureIdsAndDeduplicate(key, items);
        });

        // POST-PROCESS: Merge split rate settings back into structure
        data.rateSettings = {
            BaseRates: data.rateSettings_Base || [],
            Surcharges: data.rateSettings_Surcharges || []
        };
        delete data.rateSettings_Base;
        delete data.rateSettings_Surcharges;

        return data;
    }

    _mapRowToObject(row) {
        const obj = row.toObject();
        ['SortOrder', 'Amount', 'ContractAmount', 'CollectionAmount', 'ExpenseAmount',
            'AmountKRW', 'LaborCostKRW', 'OutsourceCostKRW', 'ExpenseCostKRW', 'ContractAmountKRW',
            'BaseRateKRW', 'Factor', 'Year', 'Month', 'Quarter',
            'MM', 'MM_EXECUTIVE', 'MM_DIRECTOR', 'MM_MANAGER', 'MM_DEPUTY', 'MM_ASST', 'MM_ASSOCIATE', 'MM_JUNIOR',
            'ContractGoal', 'CollectionGoal'
        ].forEach(field => {
            if (obj[field] !== undefined && obj[field] !== null && obj[field] !== '') {
                const val = Number(obj[field]);
                if (!isNaN(val)) obj[field] = val;
            }
        });
        return obj;
    }

    _ensureIdsAndDeduplicate(key, rawItems) {
        let items = rawItems;
        if (['arCollections', 'costExpenses', 'mmAllocations', 'monthCloseControls', 'internalRates'].includes(key)) {
            items = items.map(item => {
                if (!item.id) item.id = randomUUID();
                return item;
            });
            const seen = new Set();
            return items.filter(item => {
                if (seen.has(item.id)) return false;
                seen.add(item.id);
                return true;
            });
        } else if (key === 'teams' || key === 'projects') {
            const seen = new Set();
            const idField = key === 'teams' ? 'TeamID' : 'ProjectID';
            return rawItems.filter(item => {
                const id = item[idField];
                if (!id) return true;
                if (seen.has(id)) return false;
                seen.add(id);
                return true;
            });
        }
        return items;
    }

    async save(data) {
        if (!this.doc) await this.init();

        const dataToSave = { ...data };
        if (dataToSave.rateSettings) {
            dataToSave.rateSettings_Base = dataToSave.rateSettings.BaseRates || [];
            dataToSave.rateSettings_Surcharges = dataToSave.rateSettings.Surcharges || [];
        }

        if (dataToSave.globalPassword) {
            if (!dataToSave.settings) dataToSave.settings = {};
            dataToSave.settings.password = dataToSave.globalPassword;
        }

        // Project name lookup
        const projectLookup = {};
        (dataToSave.projects || []).forEach(p => { projectLookup[p.ProjectID] = p.ProjectName; });

        // 1. Process standard sheets (those not configured for splitting)
        for (const [key, sheetTitle] of Object.entries(this.schema)) {
            if (this.splitConfig[key]) continue;
            const items = dataToSave[key];
            if (!items && key !== 'settings') continue;

            await this._saveToSheet(sheetTitle, items, key === 'settings');
        }

        // 2. Process Split Sheets (COL/EXP/PRJ/MM)
        const sheetsToKeep = new Set();
        const existingDynamicSheets = this.doc.sheetsByIndex
            .filter(s => Object.values(this.splitConfig).some(c => s.title.startsWith(c.prefix)))
            .map(s => s.title);

        for (const [key, config] of Object.entries(this.splitConfig)) {
            const items = dataToSave[key] || [];
            const grouped = {};

            // Ensure 1-5 teams always exist for consistency
            ['TEAM_1', 'TEAM_2', 'TEAM_3', 'TEAM_4', 'TEAM_5'].forEach(tid => {
                grouped[tid] = [];
                sheetsToKeep.add(`${config.prefix}${tid}`);
            });

            items.forEach(item => {
                let teamId = item[config.teamField] || 'OTHER';
                if (!grouped[teamId]) grouped[teamId] = [];

                // Add ProjectName for readability
                if (item.ProjectID && !item.ProjectName) {
                    item.ProjectName = projectLookup[item.ProjectID] || '';
                }
                grouped[teamId].push(item);
                sheetsToKeep.add(`${config.prefix}${teamId}`);
            });

            // Save each team group
            for (const [teamId, rows] of Object.entries(grouped)) {
                const sheetTitle = `${config.prefix}${teamId}`;
                await this._saveToSheet(sheetTitle, rows, false, false, key);
            }
        }

        // 3. Cleanup unused splits AND legacy unified sheets
        const legacyUnifiedSheets = Object.keys(this.splitConfig).map(k => this.schema[k]);
        for (const sheetTitle of [...existingDynamicSheets, ...legacyUnifiedSheets]) {
            if (!sheetsToKeep.has(sheetTitle)) {
                const s = this.doc.sheetsByTitle[sheetTitle];
                if (s) {
                    console.log(`🗑️ Deleting unused/legacy sheet: ${sheetTitle}`);
                    await new Promise(r => setTimeout(r, 1200));
                    await s.delete().catch(e => console.error(`Error deleting ${sheetTitle}:`, e));
                }
            }
        }
    }

    async _saveToSheet(sheetTitle, items, isSettings = false, isMM_Legacy = false, splitKey = null) {
        console.log(`📡 Saving sheet: ${sheetTitle} (${Array.isArray(items) ? items.length : 'Object'} items)...`);
        let sheet = this.doc.sheetsByTitle[sheetTitle];
        if (!sheet) {
            sheet = await this.doc.addSheet({ title: sheetTitle });
        }

        let headers = [];
        let rows = [];

        if (isSettings) {
            headers = ['Key', 'Value'];
            rows = Object.entries(items || {}).map(([k, v]) => ({ Key: k, Value: v }));
        } else if (Array.isArray(items)) {
            // Define consistent headers for each split type
            if (splitKey === 'mmAllocations') {
                headers = ['id', 'MonthKey', 'TeamID', 'ProjectID', 'ProjectName', 'MM', 'MM_EXECUTIVE', 'MM_DIRECTOR', 'MM_MANAGER', 'MM_DEPUTY', 'MM_ASST', 'MM_ASSOCIATE', 'MM_JUNIOR', 'InputType', 'Category', 'Note'];
            } else if (splitKey === 'projects') {
                headers = ['ProjectID', 'ProjectName', 'Client', 'ContractAmountKRW', 'Status', 'StartMonth', 'EndMonthPlan', 'LeadSalesTeamID', 'Category'];
            } else if (splitKey === 'arCollections') {
                headers = ['id', 'MonthKey', 'TeamID', 'ProjectID', 'ProjectName', 'CollectionAmount', 'InputType', 'Note'];
            } else if (splitKey === 'costExpenses') {
                headers = ['id', 'MonthKey', 'TeamID', 'ProjectID', 'ProjectName', 'LaborCostKRW', 'OutsourceCostKRW', 'ExpenseCostKRW', 'InputType', 'Note'];
            } else if (items.length > 0) {
                headers = Object.keys(items[0]);
                if (!headers.includes('id') && ['AR_Collections', 'Cost_Expenses', 'MonthCloseControls'].includes(sheetTitle)) {
                    headers.unshift('id');
                }
            } else {
                // For empty sheets, try to retain existing headers if possible
                try {
                    if (sheet.rowCount > 0 && sheet.columnCount > 0) {
                        await sheet.loadHeaderRow();
                        headers = sheet.headerValues || [];
                    }
                } catch (e) { }
            }

            rows = [...items];
            // Sort logic
            if (sheetTitle === 'Teams') {
                rows.sort((a, b) => (a.SortOrder || 0) - (b.SortOrder || 0));
            } else if (['MM_', 'COL_', 'EXP_', 'PRJ_'].some(p => sheetTitle.startsWith(p))) {
                rows.sort((a, b) => (a.MonthKey || '').localeCompare(b.MonthKey || '') || (a.ProjectID || '').localeCompare(b.ProjectID || ''));
            } else if (sheetTitle === 'Projects') {
                rows.sort((a, b) => (a.LeadSalesTeamID || '').localeCompare(b.LeadSalesTeamID || '') || (a.ProjectID || '').localeCompare(b.ProjectID || ''));
            } else if (['AR_Collections', 'Cost_Expenses', 'MonthCloseControls'].includes(sheetTitle)) {
                rows.sort((a, b) => (a.MonthKey || '').localeCompare(b.MonthKey || '') || (a.TeamID || a.LeadSalesTeamID || '').localeCompare(b.TeamID || b.LeadSalesTeamID || ''));
            }
        }

        // Throttling for quota
        await new Promise(r => setTimeout(r, 1200));
        await sheet.clear();

        if (headers.length > 0) {
            await new Promise(r => setTimeout(r, 300));
            await sheet.setHeaderRow(headers);
            if (rows.length > 0) {
                await sheet.addRows(rows);
            }
        }
    }
}

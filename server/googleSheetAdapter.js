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
            } else {
                const rawItems = rows.map(row => this._mapRowToObject(row));
                data[key] = this._ensureIdsAndDeduplicate(key, rawItems);
            }
        }

        for (const sheet of this.doc.sheetsByIndex) {
            for (const [key, config] of Object.entries(this.splitConfig)) {
                if (sheet.title === this.schema[key] || sheet.title.startsWith(config.prefix)) {
                    try {
                        const rows = await sheet.getRows();
                        const items = rows.map(row => this._mapRowToObject(row));
                        splitDataAccumulator[key].push(...items);
                    } catch (e) {}
                }
            }
        }

        Object.entries(splitDataAccumulator).forEach(([key, items]) => {
            data[key] = this._ensureIdsAndDeduplicate(key, items);
        });

        data.rateSettings = {
            BaseRates: data.rateSettings_Base || [],
            Surcharges: data.rateSettings_Surcharges || []
        };
        return data;
    }

    _mapRowToObject(row) {
        const obj = row.toObject();
        ['SortOrder', 'Amount', 'ContractAmount', 'CollectionAmount', 'ExpenseAmount',
            'AmountKRW', 'TaxAmountKRW', 'LaborCostKRW', 'OutsourceCostKRW', 'ExpenseCostKRW', 'ContractAmountKRW',
            'BaseRateKRW', 'Factor', 'Year', 'Month', 'Quarter',
            'MM', 'MM_EXECUTIVE', 'MM_DIRECTOR', 'MM_MANAGER', 'MM_DEPUTY', 'MM_ASST', 'MM_ASSOCIATE', 'MM_JUNIOR',
            'ContractGoal', 'CollectionGoal'
        ].forEach(field => {
            if (obj[field] !== undefined && obj[field] !== null && obj[field] !== '' && typeof obj[field] !== 'number') {
                const cleanVal = String(obj[field]).replace(/,/g, '');
                const val = Number(cleanVal);
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
        for (const [key, sheetTitle] of Object.entries(this.schema)) {
            if (this.splitConfig[key]) continue;
            await this._saveToSheet(sheetTitle, dataToSave[key], key === 'settings');
        }
        for (const [key, config] of Object.entries(this.splitConfig)) {
            const items = dataToSave[key] || [];
            const grouped = {};
            ['TEAM_1', 'TEAM_2', 'TEAM_3', 'TEAM_4', 'TEAM_5'].forEach(tid => { grouped[tid] = []; });
            items.forEach(item => {
                let teamId = item[config.teamField] || 'OTHER';
                if (!grouped[teamId]) grouped[teamId] = [];
                grouped[teamId].push(item);
            });
            for (const [teamId, rows] of Object.entries(grouped)) {
                await this._saveToSheet(`${config.prefix}${teamId}`, rows, false);
            }
        }
    }

    async _saveToSheet(sheetTitle, items, isSettings = false) {
        let sheet = this.doc.sheetsByTitle[sheetTitle];
        if (!sheet) sheet = await this.doc.addSheet({ title: sheetTitle });
        let headers = [];
        let rows = [];
        if (isSettings) {
            headers = ['Key', 'Value'];
            rows = Object.entries(items || {}).map(([k, v]) => ({ Key: k, Value: v }));
        } else if (Array.isArray(items)) {
            if (items.length > 0) headers = Object.keys(items[0]);
            rows = [...items];
        }
        await new Promise(r => setTimeout(r, 1200));
        await sheet.clear();
        if (headers.length > 0) {
            await sheet.setHeaderRow(headers);
            if (rows.length > 0) await sheet.addRows(rows);
        }
    }
}

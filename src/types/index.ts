export type TeamType = 'SALES' | 'SUPPORT';

export interface TeamMaster {
    TeamID: string;
    TeamName: string;
    TeamType: TeamType;
    SortOrder: number;
}

export type ProjectStatus = 'ACTIVE' | 'COMPLETED' | 'CANCELLED';
export type ProjectCategory = 'INTERNAL' | 'CROSS_DEPT' | 'OVERSEAS' | 'TEAM_1' | 'TEAM_2' | 'TEAM_3' | 'TEAM_4' | 'TEAM_5';

export interface ProjectMaster {
    ProjectID: string; // 00-0000-000
    ProjectName: string;
    Client: string;
    ContractAmountKRW: number;
    StartMonth: string; // YYYY-MM
    EndMonthPlan: string; // YYYY-MM
    LeadSalesTeamID: string;
    Status: ProjectStatus;
    Category: ProjectCategory;
}

export interface CalendarMonth {
    MonthKey: string; // YYYY-MM
    Year: number;
    Month: number;
    Quarter: number;
}

export interface InternalRate {
    id: string; // unique key (MonthKey + TeamID)
    MonthKey: string;
    TeamID: string;
    RateKRWPerMM: number; // Legacy or average
    Note?: string;
}

export type GradeKey = 'EXECUTIVE' | 'DIRECTOR' | 'MANAGER' | 'DEPUTY' | 'ASST' | 'ASSOCIATE' | 'JUNIOR';

export interface GradeRate {
    Grade: GradeKey;
    BaseRateKRW: number;
}

export interface SurchargeFactor {
    Category: ProjectCategory;
    Factor: number;
}

export interface RateSettings {
    BaseRates: GradeRate[];
    Surcharges: SurchargeFactor[];
}

export type DocType = 'INVOICE' | 'CLAIM' | 'OTHER';

export interface ArCollection {
    id: string; // UUID
    MonthKey: string;
    ProjectID: string;
    ReceiptDate: string; // YYYY-MM-DD
    AmountKRW: number;
    TaxAmountKRW?: number; // VAT
    DocType: DocType;
    DocNo?: string;
    Payer?: string;
    Note?: string;
}

export type CostCenter = 'PROJECT' | 'COMMON';

export interface CostExpense {
    id: string; // UUID
    MonthKey: string;
    TeamID: string;
    ProjectID?: string; // Optional if Common
    CostCenter: CostCenter;
    LaborCostKRW: number;
    OutsourceCostKRW: number;
    ExpenseCostKRW: number;
    Vendor?: string;
    Note?: string;
    Category?: ProjectCategory;
}

export type InputType = 'ACTUAL' | 'PLAN';

export interface MmAllocation {
    id: string; // UUID
    MonthKey: string;
    TeamID: string;
    ProjectID: string;
    MM: number; // Total MM
    MM_EXECUTIVE: number;
    MM_DIRECTOR: number;
    MM_MANAGER: number;
    MM_DEPUTY: number;
    MM_ASST: number;
    MM_ASSOCIATE: number;
    MM_JUNIOR: number;
    InputType: InputType;
    Note?: string;
    Category?: ProjectCategory;
}

export interface MonthCloseControl {
    id: string; // MonthKey + TeamID
    MonthKey: string;
    TeamID: string;
    IsClosed: boolean;
    ClosedBy?: string;
    ClosedAt?: string;
    Note?: string;
}

export interface AnnualGoal {
    Year: number;
    ContractGoal: number; // 수주 목표
    CollectionGoal: number; // 수금 목표
}

export type UserRole = 'HEAD' | 'LEADER' | 'ADMIN' | 'SUB_ADMIN';

export type UserStatus = 'PENDING' | 'ACTIVE' | 'REJECTED';

export interface User {
    id: string;
    description: string; // Name or Position
    role: UserRole;
    teamId?: string;
    password?: string; // Optional (default to something if missing)
    status: UserStatus;
    createdAt?: string; // ISO Date
}

export interface AppState {
    teams: TeamMaster[];
    projects: ProjectMaster[];
    calendar: CalendarMonth[];
    internalRates: InternalRate[];
    rateSettings: RateSettings;
    arCollections: ArCollection[];
    costExpenses: CostExpense[];
    mmAllocations: MmAllocation[];
    monthCloseControls: MonthCloseControl[];
    goals: AnnualGoal[];
    users: User[];
    globalPassword?: string; // Global Access Password
}

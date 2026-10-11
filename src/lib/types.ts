export type UserRole = "admin" | "employee";

export type WorkType = "installation" | "maintenance" | "inspection";

export type WarrantyStatus = "yes" | "no";

export type PaymentStatus = "cash" | "on_account";

export type ReportPart = {
  id: string;
  item: string;
  quantity: number;
  price: number;
};

export type FieldReport = {
  id?: string;
  reportNumber: string;
  customerName: string;
  customerPhone: string;
  orderNumber: string;
  workType: WorkType;
  problemDescription: string;
  area: string;
  projectName: string;
  previousSupply: WarrantyStatus;
  previousSupplyDetails: string;
  technicians: string[];
  parts: ReportPart[];
  serviceFee: number;
  warranty: WarrantyStatus;
  paymentStatus: PaymentStatus;
  recommendations: string;
  receiverSignature: string;
  technicianSignature: string;
  managerSignature: string;
  carNumber: string;
  startTime: string;
  endTime: string;
  reportDate: string;
  createdByUid: string;
  createdByName: string;
  createdAt: string;
  updatedAt: string;
  archived?: boolean;
  revision?: number;
};

export type AppUser = {
  username?: string;
  uid: string;
  email: string;
  displayName: string;
  role: UserRole;
  active: boolean;
  deleted?: boolean;
  createdAt?: string;
};

export type AutofillOptions = {
  customers: Array<{
    name: string;
    phone: string;
    area: string;
    projectName: string;
    previousSupply: WarrantyStatus;
  }>;
  parts: Array<{
    item: string;
    price: number;
  }>;
  technicians: string[];
  areas: string[];
  carNumbers: string[];
};

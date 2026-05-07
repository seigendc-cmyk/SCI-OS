import { db } from '../lib/firebase';
import {
  doc,
  setDoc,
  serverTimestamp,
  writeBatch,
  collection,
  getDocs,
  query,
  where,
} from 'firebase/firestore';
import { createBIEvent, BIEventType } from './biService';

export enum AccountType {
  ASSET = 'Asset',
  LIABILITY = 'Liability',
  EQUITY = 'Equity',
  INCOME = 'Income',
  EXPENSE = 'Expense',
  COST_OF_SALES = 'Cost of Sales',
}

export interface ChartAccount {
  accountId: string;
  vendorId: string;
  accountCode: string;
  accountName: string;
  accountType: AccountType;
  normalBalance: 'debit' | 'credit';
  systemAccount: boolean;
  active: boolean;
}

export interface JournalLine {
  accountId: string;
  accountCode: string;
  accountName: string;
  description: string;
  debit: number;
  credit: number;
}

export const validateJournalBalanced = (lines: JournalLine[]): boolean => {
  const totalDebits = lines.reduce((sum, line) => sum + (line.debit || 0), 0);
  const totalCredits = lines.reduce((sum, line) => sum + (line.credit || 0), 0);

  // Floating point precision handling
  const isBalanced = Math.abs(totalDebits - totalCredits) < 0.001;
  const hasValidLines = lines.every(
    (line) =>
      line.accountId && line.debit >= 0 && line.credit >= 0 && !(line.debit > 0 && line.credit > 0),
  );

  return isBalanced && hasValidLines && lines.length > 0;
};

export const createAccountingJournalDraft = async (payload: {
  vendorId: string;
  sourceType: string;
  sourceId: string;
  journalDate: any;
  lines: JournalLine[];
  userId: string;
  userEmail: string;
  userRole: string;
}) => {
  const isBalanced = validateJournalBalanced(payload.lines);

  if (!isBalanced) {
    await createBIEvent({
      vendorId: payload.vendorId,
      userId: payload.userId,
      userEmail: payload.userEmail,
      userRole: payload.userRole,
      eventType: BIEventType.DOUBLE_ENTRY_VALIDATION_FAILED,
      severity: 'critical',
      message: `Journal validation failed for ${payload.sourceType}: ${payload.sourceId}`,
      metadata: { lines: payload.lines },
    });
  }

  const journalId = `JRN-${Date.now()}`;
  const totalDebit = payload.lines.reduce((sum, l) => sum + (l.debit || 0), 0);
  const totalCredit = payload.lines.reduce((sum, l) => sum + (l.credit || 0), 0);

  const batch = writeBatch(db);

  batch.set(doc(db, 'accounting_journals', journalId), {
    journalId,
    vendorId: payload.vendorId,
    sourceModule: 'POS',
    sourceType: payload.sourceType,
    sourceId: payload.sourceId,
    journalDate: payload.journalDate,
    status: 'draft',
    totalDebit,
    totalCredit,
    createdByUid: payload.userId,
    createdByEmail: payload.userEmail,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  payload.lines.forEach((line, index) => {
    const lineId = `${journalId}-L${index}`;
    batch.set(doc(db, 'journal_lines', lineId), {
      ...line,
      lineId,
      journalId,
      vendorId: payload.vendorId,
      createdAt: serverTimestamp(),
    });
  });

  await batch.commit();
  return journalId;
};

export const seedChartOfAccounts = async (vendorId: string) => {
  if (!vendorId) throw new Error('Vendor ID is required for seeding.');

  console.log('[COA SEED START]', { vendorId });

  const defaultAccounts: Omit<ChartAccount, 'accountId' | 'vendorId'>[] = [
    // Assets
    {
      accountCode: '1000',
      accountName: 'Cash on Hand',
      accountType: AccountType.ASSET,
      normalBalance: 'debit',
      systemAccount: true,
      active: true,
    },
    {
      accountCode: '1010',
      accountName: 'Bank Account',
      accountType: AccountType.ASSET,
      normalBalance: 'debit',
      systemAccount: true,
      active: true,
    },
    {
      accountCode: '1020',
      accountName: 'Mobile Money',
      accountType: AccountType.ASSET,
      normalBalance: 'debit',
      systemAccount: true,
      active: true,
    },
    {
      accountCode: '1030',
      accountName: 'Card Clearing',
      accountType: AccountType.ASSET,
      normalBalance: 'debit',
      systemAccount: true,
      active: true,
    },
    {
      accountCode: '1200',
      accountName: 'Inventory',
      accountType: AccountType.ASSET,
      normalBalance: 'debit',
      systemAccount: true,
      active: true,
    },
    {
      accountCode: '1300',
      accountName: 'Customer Debtors',
      accountType: AccountType.ASSET,
      normalBalance: 'debit',
      systemAccount: true,
      active: true,
    },

    // Liabilities
    {
      accountCode: '2000',
      accountName: 'Supplier/Creditors',
      accountType: AccountType.LIABILITY,
      normalBalance: 'credit',
      systemAccount: true,
      active: true,
    },
    {
      accountCode: '2100',
      accountName: 'VAT/Tax Payable',
      accountType: AccountType.LIABILITY,
      normalBalance: 'credit',
      systemAccount: true,
      active: true,
    },
    {
      accountCode: '2200',
      accountName: 'COGS Reserve Control',
      accountType: AccountType.LIABILITY,
      normalBalance: 'credit',
      systemAccount: true,
      active: true,
    },

    // Income
    {
      accountCode: '4000',
      accountName: 'Sales Revenue',
      accountType: AccountType.INCOME,
      normalBalance: 'credit',
      systemAccount: true,
      active: true,
    },

    // Cost of Sales
    {
      accountCode: '5000',
      accountName: 'Cost of Goods Sold',
      accountType: AccountType.COST_OF_SALES,
      normalBalance: 'debit',
      systemAccount: true,
      active: true,
    },

    // Expenses
    {
      accountCode: '6000',
      accountName: 'Rent',
      accountType: AccountType.EXPENSE,
      normalBalance: 'debit',
      systemAccount: true,
      active: true,
    },
    {
      accountCode: '6010',
      accountName: 'Salaries/Wages',
      accountType: AccountType.EXPENSE,
      normalBalance: 'debit',
      systemAccount: true,
      active: true,
    },
    {
      accountCode: '6020',
      accountName: 'Airtime/Communication',
      accountType: AccountType.EXPENSE,
      normalBalance: 'debit',
      systemAccount: true,
      active: true,
    },
    {
      accountCode: '6030',
      accountName: 'Transport',
      accountType: AccountType.EXPENSE,
      normalBalance: 'debit',
      systemAccount: true,
      active: true,
    },
    {
      accountCode: '6040',
      accountName: 'Utilities',
      accountType: AccountType.EXPENSE,
      normalBalance: 'debit',
      systemAccount: true,
      active: true,
    },
    {
      accountCode: '6999',
      accountName: 'General Expenses',
      accountType: AccountType.EXPENSE,
      normalBalance: 'debit',
      systemAccount: true,
      active: true,
    },
    {
      accountCode: '9999',
      accountName: 'Unclassified Expenses',
      accountType: AccountType.EXPENSE,
      normalBalance: 'debit',
      systemAccount: true,
      active: true,
    },
  ];

  const batch = writeBatch(db);
  const now = serverTimestamp();
  const accountIds: string[] = [];

  defaultAccounts.forEach((acc) => {
    const accountId = `${vendorId}-${acc.accountCode}`;
    accountIds.push(accountId);
    console.log('[COA SEED WRITING]', acc.accountCode);
    batch.set(
      doc(db, 'chart_accounts', accountId),
      {
        ...acc,
        accountId,
        vendorId,
        createdAt: now,
        updatedAt: now,
      },
      { merge: true },
    );
  });

  await batch.commit();
  console.log('[COA SEED RESULT]', { vendorId, count: defaultAccounts.length });

  return {
    success: true,
    writtenCount: defaultAccounts.length,
    accountIds,
  };
};

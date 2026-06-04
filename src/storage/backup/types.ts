export type BackupSummaryCounts = {
  attachments: number;
  categoryBudgets: number;
  categories: number;
  monthlyBudgets: number;
  transactions: number;
};

export type BackupExportResult = {
  fileName: string;
  fileUri: string;
  counts: BackupSummaryCounts;
};

export type BackupFileTarget = {
  fileName: string;
  fileUri: string;
};

export type BackupSaveResult = BackupFileTarget & {
  saved: boolean;
};

export type BackupShareResult = {
  shared: boolean;
};

export type BackupImportResult = {
  counts: BackupSummaryCounts;
  warnings: string[];
};

export type BackupRepository = {
  exportBackup: () => Promise<BackupExportResult>;
  saveBackupToFiles: (target: BackupFileTarget) => Promise<BackupSaveResult>;
  shareBackup: (target: BackupFileTarget) => Promise<BackupShareResult>;
  importBackup: () => Promise<BackupImportResult | null>;
};

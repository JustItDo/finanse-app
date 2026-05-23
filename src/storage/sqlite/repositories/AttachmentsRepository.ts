import type { Attachment, EntrySourceType, OcrStatus } from '@/src/domain/finance';
import { toIsoTimestamp } from '@/src/shared/utils/date';
import { createEntityId } from '@/src/shared/utils/id';
import type { DatabaseContext } from '@/src/storage/sqlite/database';

export type CreateAttachmentInput = {
  transactionId?: string | null;
  kind: Attachment['kind'];
  fileUri: string;
  fileName?: string | null;
  mimeType?: string | null;
  fileSizeBytes?: number | null;
  sourceType?: EntrySourceType;
  sourceReference?: string | null;
  ocrStatus?: OcrStatus;
  ocrConfidence?: number | null;
  ocrRawText?: string | null;
};

type AttachmentRow = {
  id: string;
  transaction_id: string | null;
  kind: Attachment['kind'];
  storage_type: Attachment['storageType'];
  file_uri: string;
  file_name: string | null;
  mime_type: string | null;
  file_size_bytes: number | null;
  source_type: Attachment['sourceType'];
  source_reference: string | null;
  ocr_status: Attachment['ocrStatus'];
  ocr_confidence: number | null;
  ocr_raw_text: string | null;
  created_at: string;
  updated_at: string;
};

function mapAttachment(row: AttachmentRow): Attachment {
  return {
    createdAt: row.created_at,
    fileName: row.file_name,
    fileSizeBytes: row.file_size_bytes,
    fileUri: row.file_uri,
    id: row.id,
    kind: row.kind,
    mimeType: row.mime_type,
    ocrConfidence: row.ocr_confidence,
    ocrRawText: row.ocr_raw_text,
    ocrStatus: row.ocr_status,
    sourceReference: row.source_reference,
    sourceType: row.source_type,
    storageType: row.storage_type,
    transactionId: row.transaction_id,
    updatedAt: row.updated_at,
  };
}

export function createAttachmentsRepository(context: DatabaseContext) {
  return {
    async create(input: CreateAttachmentInput) {
      const db = await context.getDb();
      const id = createEntityId('attachment');
      const now = toIsoTimestamp();

      await db.runAsync(
        `
          INSERT INTO attachments (
            id, transaction_id, kind, storage_type, file_uri, file_name, mime_type, file_size_bytes,
            source_type, source_reference, ocr_status, ocr_confidence, ocr_raw_text, created_at, updated_at
          ) VALUES (?, ?, ?, 'local_file', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        id,
        input.transactionId ?? null,
        input.kind,
        input.fileUri,
        input.fileName ?? null,
        input.mimeType ?? null,
        input.fileSizeBytes ?? null,
        input.sourceType ?? 'manual',
        input.sourceReference ?? null,
        input.ocrStatus ?? 'not_requested',
        input.ocrConfidence ?? null,
        input.ocrRawText ?? null,
        now,
        now,
      );

      const created = await db.getFirstAsync<AttachmentRow>('SELECT * FROM attachments WHERE id = ?', id);

      if (!created) {
        throw new Error('Nie udało się odczytać zapisanego załącznika.');
      }

      return mapAttachment(created);
    },

    async listByTransactionId(transactionId: string) {
      const db = await context.getDb();
      const rows = await db.getAllAsync<AttachmentRow>(
        'SELECT * FROM attachments WHERE transaction_id = ? ORDER BY created_at DESC',
        transactionId,
      );

      return rows.map(mapAttachment);
    },
  };
}

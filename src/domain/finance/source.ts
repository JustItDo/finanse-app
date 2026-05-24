import type { EntrySourceType } from './types';

export type EntrySourceKind = 'manual' | 'ocr' | 'sync';

export type EntrySourceMeta = {
  kind: EntrySourceKind;
  label: string;
  shortLabel: string;
  isOcr: boolean;
  type: EntrySourceType;
};

export function getEntrySourceMeta(sourceType: EntrySourceType): EntrySourceMeta {
  if (sourceType === 'receipt_ocr') {
    return {
      isOcr: true,
      kind: 'ocr',
      label: 'OCR paragonu',
      shortLabel: 'OCR',
      type: sourceType,
    };
  }

  if (sourceType === 'screenshot_ocr') {
    return {
      isOcr: true,
      kind: 'ocr',
      label: 'OCR screena',
      shortLabel: 'OCR',
      type: sourceType,
    };
  }

  if (sourceType === 'obsidian_import' || sourceType === 'obsidian_sync') {
    return {
      isOcr: false,
      kind: 'sync',
      label: sourceType === 'obsidian_import' ? 'Import z Obsidiana' : 'Synchronizacja z Obsidianem',
      shortLabel: 'Sync',
      type: sourceType,
    };
  }

  return {
    isOcr: false,
    kind: 'manual',
    label: 'Ręcznie',
    shortLabel: 'Ręcznie',
    type: sourceType,
  };
}

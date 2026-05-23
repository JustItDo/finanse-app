export const OBSIDIAN_VAULT_RELATIVE_PATH = '../obsidian value';

export const obsidianIntegrationConfig = {
  relativeVaultPathFromApp: OBSIDIAN_VAULT_RELATIVE_PATH,
  supportedExtensions: ['.md'],
  futureSourceTypes: ['obsidian_import', 'obsidian_sync'] as const,
};

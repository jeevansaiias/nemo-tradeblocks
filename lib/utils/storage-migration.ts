// Safe localStorage migration helpers for NemoBlocks branding
// This copies legacy keys (tradeblocks-*) to new nemoblocks-* keys on first run
// without deleting the legacy keys (kept as a backup).

const LEGACY_ACTIVE_KEY = "tradeblocks-active-block-id";
const NEW_ACTIVE_KEY = "nemoblocks-active-block-id";

export function getActiveBlockKeyNames() {
  return { legacy: LEGACY_ACTIVE_KEY, current: NEW_ACTIVE_KEY };
}

export function migrateLocalStorageKeys(): void {
  if (typeof window === "undefined") return;

  try {
    const legacy = localStorage.getItem(LEGACY_ACTIVE_KEY);
    const current = localStorage.getItem(NEW_ACTIVE_KEY);

    // If the legacy key exists and the new key is absent, copy it across.
    if (legacy && !current) {
      localStorage.setItem(NEW_ACTIVE_KEY, legacy);
    }
  } catch (err) {
    // Do not throw — migration should be best-effort and non-blocking
    console.warn("LocalStorage migration failed:", err);
  }
}

export function readActiveBlockIdFromStorage(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return (
      localStorage.getItem(NEW_ACTIVE_KEY) ?? localStorage.getItem(LEGACY_ACTIVE_KEY)
    );
  } catch {
    return null;
  }
}

export function writeActiveBlockIdToStorage(blockId: string | null): void {
  if (typeof window === "undefined") return;
  try {
    if (blockId === null) {
      // Keep the legacy key present for backup, but set both to empty string
      localStorage.setItem(NEW_ACTIVE_KEY, "");
      localStorage.setItem(LEGACY_ACTIVE_KEY, "");
    } else {
      localStorage.setItem(NEW_ACTIVE_KEY, blockId);
      localStorage.setItem(LEGACY_ACTIVE_KEY, blockId);
    }
  } catch (err) {
    console.warn("Failed to write active block id to storage:", err);
  }
}

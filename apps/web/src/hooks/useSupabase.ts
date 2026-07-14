// apps/web/src/hooks/useSupabase.ts
// SUDAH GA DIPAKE LAGI, REDIRECT KE API

export function useSupabase() {
  return {
    loading: false,
    error: null,
    uploadMasterData: async () => ({ data: null, error: 'Use API instead' }),
    saveBarcodeMapping: async () => ({ data: null, error: 'Use API instead' }),
    saveOpname: async () => ({ data: null, error: 'Use API instead' }),
  }
}
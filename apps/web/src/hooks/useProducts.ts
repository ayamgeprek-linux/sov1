// apps/web/src/hooks/useProducts.ts
import { useState, useCallback, useEffect } from 'react'
import { api } from '../api/client'
import { useAuth } from '../auth/contexts/AuthContext'

export interface Product {
  id: string
  sku: string
  nama_barang: string
  kategori: string
  warna: string
  size: string
  stock_sistem: number
  created_at: string
  status_mapping?: boolean
  qty_fisik?: number | null
}

export function useProducts() {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(false)
  const { token } = useAuth()

  // ============================================================
  // LOAD PRODUCTS DARI BACKEND (SEMUA DATA)
  // ============================================================
  const loadProducts = useCallback(async () => {
    setLoading(true)
    try {
      console.log('[useProducts] Loading products from API...')
      
      const result = await api.get<{ success: boolean; data: Product[]; total: number }>(
        '/api/products', 
        token || undefined
      )
      
      if (result.success && result.data) {
        console.log(`[useProducts] Loaded ${result.data.length} products (total: ${result.total})`)
        setProducts(result.data)
        return result.data
      }
      return []
    } catch (error) {
      console.error('[useProducts] Error loading products:', error)
      return []
    } finally {
      setLoading(false)
    }
  }, [token])

  // ============================================================
  // REFRESH PRODUCTS
  // ============================================================
  const refreshProducts = useCallback(async () => {
    return await loadProducts()
  }, [loadProducts])

  // ============================================================
  // SAVE OPNAME
  // ============================================================
  const saveOpname = useCallback(async (sku: string, size: string, qty_fisik: number) => {
    try {
      const result = await api.post<{ success: boolean; data: any; selisih: number; status: string }>(
        '/api/opname',
        { sku, size, qty_fisik },
        token || undefined
      )
      
      if (result.success) {
        // Update local state
        setProducts(prev => prev.map(p => 
          p.sku === sku && p.size === size ? { ...p, qty_fisik } : p
        ))
        return true
      }
      return false
    } catch (error) {
      console.error('[useProducts] Save opname error:', error)
      return false
    }
  }, [token])

  // ============================================================
  // AUTO LOAD
  // ============================================================
  useEffect(() => {
    loadProducts()
  }, [loadProducts])

  return {
    products,
    loading,
    loadProducts,
    refreshProducts,
    saveOpname,
  }
}
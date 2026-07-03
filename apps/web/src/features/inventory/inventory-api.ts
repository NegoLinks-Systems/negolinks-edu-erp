import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import type { InventoryCategory, InventoryItem, StockMovement, MovementType } from '../../lib/database.types';

/* ----------------------------- categories ----------------------------- */
export function useInvCategories(institutionId: string) {
  return useQuery({
    queryKey: ['inv-categories', institutionId],
    enabled: !!institutionId,
    queryFn: async () => {
      const { data, error } = await supabase.from('inventory_categories').select('*').eq('institution_id', institutionId).order('name');
      if (error) throw error;
      return (data ?? []) as InventoryCategory[];
    },
  });
}
export function useUpsertInvCategory(institutionId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id?: string; name: string }) => {
      const { id, ...rest } = input;
      const row = { ...rest, institution_id: institutionId };
      const res = id ? await supabase.from('inventory_categories').update(row).eq('id', id) : await supabase.from('inventory_categories').insert(row);
      if (res.error) throw res.error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['inv-categories', institutionId] }),
  });
}
export function useDeleteInvCategory(institutionId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from('inventory_categories').delete().eq('id', id); if (error) throw error; },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['inv-categories', institutionId] }),
  });
}

/* -------------------------------- items ------------------------------- */
export function useItems(institutionId: string, filters: { categoryId: string; search: string }) {
  return useQuery({
    queryKey: ['inv-items', institutionId, filters],
    enabled: !!institutionId,
    queryFn: async () => {
      let q = supabase.from('inventory_items').select('*').eq('institution_id', institutionId).order('name').limit(500);
      if (filters.categoryId) q = q.eq('category_id', filters.categoryId);
      const s = filters.search.replace(/[,()*%]/g, ' ').trim();
      if (s) q = q.or(`name.ilike.%${s}%,sku.ilike.%${s}%`);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as InventoryItem[];
    },
  });
}
export function useUpsertItem(institutionId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Partial<InventoryItem> & { id?: string; name: string }) => {
      const { id, quantity, created_at, updated_at, ...rest } = input as any;
      // quantity is managed by movements; only set it on first create (opening stock).
      const row: any = { ...rest, institution_id: institutionId };
      if (!id && typeof quantity === 'number') row.quantity = quantity;
      const res = id ? await supabase.from('inventory_items').update(row).eq('id', id) : await supabase.from('inventory_items').insert(row);
      if (res.error) throw res.error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['inv-items', institutionId] }),
  });
}
export function useDeleteItem(institutionId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from('inventory_items').delete().eq('id', id); if (error) throw error; },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['inv-items', institutionId] }),
  });
}

/* ------------------------------ movements ----------------------------- */
export function useItemHistory(itemId: string | null) {
  return useQuery({
    queryKey: ['item-history', itemId],
    enabled: !!itemId,
    queryFn: async () => {
      const { data, error } = await supabase.from('stock_movements').select('*').eq('item_id', itemId!).order('created_at', { ascending: false }).limit(100);
      if (error) throw error;
      return (data ?? []) as StockMovement[];
    },
  });
}

export function useRecordMovement(institutionId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { item_id: string; type: MovementType; change: number; issued_to?: string | null; note?: string | null }) => {
      const { error } = await supabase.from('stock_movements').insert({
        institution_id: institutionId, item_id: input.item_id, type: input.type, change: input.change,
        issued_to: input.issued_to ?? null, note: input.note ?? null,
      });
      if (error) {
        if (/Insufficient stock/i.test(error.message)) throw new Error('Not enough in stock for that issue');
        throw error;
      }
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ['inv-items', institutionId] });
      qc.invalidateQueries({ queryKey: ['item-history', v.item_id] });
    },
  });
}

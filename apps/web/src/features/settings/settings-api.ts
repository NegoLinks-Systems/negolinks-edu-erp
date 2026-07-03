import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { supabase } from '../../lib/supabase';
import { tenantQueryKeys } from '../../providers/app-providers';
import type { Campus, Institution } from '../../lib/database.types';

/* ----------------------------- schemas ----------------------------- */
export const institutionTypes = [
  'primary_school', 'secondary_school', 'combined_school', 'college',
  'polytechnic', 'university', 'professional_academy',
  'vocational_center', 'coaching_center', 'learning_institute',
] as const;

const hex = z.string().regex(/^#([0-9a-fA-F]{6})$/, 'Use a 6-digit hex colour, e.g. #1d4ed8');

export const identitySchema = z.object({
  name: z.string().min(2, 'Enter the institution name'),
  type: z.enum(institutionTypes),
  motto: z.string().max(160).optional().or(z.literal('')),
  primary_color: hex,
  secondary_color: hex,
});
export type IdentityForm = z.infer<typeof identitySchema>;

export const contactSchema = z.object({
  email: z.string().email('Enter a valid email').optional().or(z.literal('')),
  phone: z.string().max(40).optional().or(z.literal('')),
  whatsapp: z.string().max(40).optional().or(z.literal('')),
  website: z.string().url('Enter a full URL, e.g. https://…').optional().or(z.literal('')),
  address: z.string().max(400).optional().or(z.literal('')),
  registration_number: z.string().max(80).optional().or(z.literal('')),
  tax_id: z.string().max(80).optional().or(z.literal('')),
});
export type ContactForm = z.infer<typeof contactSchema>;

export const localizationSchema = z.object({
  currency: z.string().length(3, 'Use a 3-letter code, e.g. NGN'),
  timezone: z.string().min(1),
  locale: z.string().min(2),
});
export type LocalizationForm = z.infer<typeof localizationSchema>;

export const campusSchema = z.object({
  name: z.string().min(2, 'Enter a campus name'),
  code: z.string().max(20).optional().or(z.literal('')),
  address: z.string().max(400).optional().or(z.literal('')),
  phone: z.string().max(40).optional().or(z.literal('')),
  email: z.string().email('Enter a valid email').optional().or(z.literal('')),
  is_main: z.boolean().default(false),
});
export type CampusForm = z.infer<typeof campusSchema>;

export interface GradeBand { grade: string; min: number; max: number; remark: string; point: number; }

/* ------------------------- institution update ---------------------- */
export function useUpdateInstitution(institutionId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (patch: Partial<Institution>) => {
      const { data, error } = await supabase
        .from('institutions').update(patch).eq('id', institutionId).select().single();
      if (error) throw error;
      return data as Institution;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: tenantQueryKeys.institution(institutionId) });
    },
  });
}

/* ------------------------------ campuses --------------------------- */
const campusKey = (id: string) => ['campuses', id] as const;

export function useCampuses(institutionId: string) {
  return useQuery({
    queryKey: campusKey(institutionId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('campuses').select('*')
        .eq('institution_id', institutionId)
        .order('is_main', { ascending: false }).order('name');
      if (error) throw error;
      return data as Campus[];
    },
  });
}

export function useUpsertCampus(institutionId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CampusForm & { id?: string }) => {
      const row = { ...input, institution_id: institutionId };
      const q = input.id
        ? supabase.from('campuses').update(row).eq('id', input.id)
        : supabase.from('campuses').insert(row);
      const { error } = await q;
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: campusKey(institutionId) }),
  });
}

export function useDeleteCampus(institutionId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('campuses').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: campusKey(institutionId) }),
  });
}

/* ------------------------- branding assets ------------------------- */
export type AssetKind = 'logo' | 'letterhead' | 'stamp' | 'signature';
const PUBLIC_ASSETS: AssetKind[] = ['logo', 'letterhead'];
const ASSET_COLUMN: Record<AssetKind, keyof Institution> = {
  logo: 'logo_url', letterhead: 'letterhead_url',
  stamp: 'stamp_url', signature: 'signature_url',
};

export function useUploadAsset(institutionId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ kind, file }: { kind: AssetKind; file: File }) => {
      const ext = file.name.split('.').pop()?.toLowerCase() || 'png';
      const isPublic = PUBLIC_ASSETS.includes(kind);
      const bucket = isPublic ? 'branding' : 'documents';
      const path = isPublic
        ? `${institutionId}/${kind}.${ext}`
        : `${institutionId}/branding/${kind}.${ext}`;

      const { error: upErr } = await supabase.storage
        .from(bucket).upload(path, file, { upsert: true, cacheControl: '3600' });
      if (upErr) throw upErr;

      // Public buckets store a URL (cache-busted); private buckets store the path.
      const value = isPublic
        ? `${supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl}?v=${Date.now()}`
        : path;

      const { error: dbErr } = await supabase
        .from('institutions').update({ [ASSET_COLUMN[kind]]: value }).eq('id', institutionId);
      if (dbErr) throw dbErr;
      return value;
    },
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: tenantQueryKeys.institution(institutionId) }),
  });
}

/** Private assets (stamp/signature) are stored as paths; sign on demand to preview. */
export async function signedAssetUrl(pathOrUrl: string | null): Promise<string | null> {
  if (!pathOrUrl) return null;
  if (pathOrUrl.startsWith('http')) return pathOrUrl; // already a public URL
  const { data, error } = await supabase.storage
    .from('documents').createSignedUrl(pathOrUrl, 3600);
  if (error) return null;
  return data.signedUrl;
}

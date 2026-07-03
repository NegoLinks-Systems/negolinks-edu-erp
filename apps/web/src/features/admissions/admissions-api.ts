import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import type { AdmissionApplication, ApplicationStatus, InstitutionType } from '../../lib/database.types';

export const APPLICATION_STATUSES: ApplicationStatus[] = ['submitted', 'under_review', 'offered', 'accepted', 'rejected', 'enrolled', 'withdrawn'];
export const STATUS_LABEL: Record<ApplicationStatus, string> = {
  submitted: 'Submitted', under_review: 'Under review', offered: 'Offered', accepted: 'Accepted',
  rejected: 'Rejected', enrolled: 'Admitted', withdrawn: 'Withdrawn',
};

/* --------------------------- public submit ---------------------------- */
export interface ApplicationInput {
  institutionId: string; first: string; last: string; email?: string; phone?: string;
  dob?: string; gender?: string; address?: string; prior_school?: string; intended?: string;
}
export function useSubmitApplication() {
  return useMutation({
    mutationFn: async (i: ApplicationInput): Promise<string> => {
      const { data, error } = await supabase.rpc('submit_application', {
        _institution_id: i.institutionId, _first: i.first, _last: i.last, _email: i.email ?? null, _phone: i.phone ?? null,
        _dob: i.dob || null, _gender: i.gender ?? null, _address: i.address ?? null, _prior_school: i.prior_school ?? null, _intended: i.intended ?? null,
      });
      if (error) throw error;
      return data as string;
    },
  });
}

/* --------------------- public institution lookup ---------------------- */
export interface PublicInstitution {
  id: string; slug: string; name: string; type: InstitutionType;
  logo_url: string | null; primary_color: string | null; secondary_color: string | null; motto: string | null;
}

/** Resolve which institution a public visitor is applying to, without a login.
 *  Priority: ?school=<slug> query param, then the first subdomain label
 *  (e.g. `school` in school.negolinks.com). Returns null if neither applies. */
export function resolveSchoolSlug(): string | null {
  if (typeof window === 'undefined') return null;
  const q = new URLSearchParams(window.location.search).get('school');
  if (q && q.trim()) return q.trim();
  const parts = window.location.hostname.split('.');
  if (parts.length >= 3 && parts[0] !== 'www') return parts[0];
  return null;
}

export function usePublicInstitution() {
  const slug = resolveSchoolSlug();
  return useQuery({
    queryKey: ['public-institution', slug],
    enabled: !!slug,
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<PublicInstitution | null> => {
      const { data, error } = await supabase.rpc('get_public_institution', { _slug: slug! });
      if (error) throw error;
      return ((data as PublicInstitution[]) ?? [])[0] ?? null;
    },
  });
}

/* ------------------------------ staff list ---------------------------- */
export function useApplications(institutionId: string, status: ApplicationStatus | 'all') {
  return useQuery({
    queryKey: ['applications', institutionId, status],
    enabled: !!institutionId,
    queryFn: async () => {
      let q = supabase.from('admission_applications').select('*').eq('institution_id', institutionId).order('created_at', { ascending: false }).limit(500);
      if (status !== 'all') q = q.eq('status', status);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as AdmissionApplication[];
    },
  });
}

export function useUpdateApplication(institutionId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; status?: ApplicationStatus; score?: number | null; notes?: string | null }) => {
      const { id, ...rest } = input;
      const { error } = await supabase.from('admission_applications').update(rest).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['applications', institutionId] }),
  });
}

export function useAdmitApplication(institutionId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string): Promise<{ student_id: string; admission_number: string }> => {
      const { data, error } = await supabase.rpc('admit_application', { _application_id: id });
      if (error) throw error;
      return data as { student_id: string; admission_number: string };
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['applications', institutionId] }),
  });
}

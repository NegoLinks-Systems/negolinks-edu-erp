import {
  createContext, useContext, useEffect, useMemo, useState, type ReactNode,
} from 'react';
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import type { AppRole, Institution } from '../lib/database.types';

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 60_000, refetchOnWindowFocus: false } },
});

/* ------------------------------------------------------------------ */
/* Auth                                                               */
/* ------------------------------------------------------------------ */
interface AuthValue {
  session: Session | null;
  user: User | null;
  loading: boolean;
  signOut: () => Promise<void>;
}
const AuthContext = createContext<AuthValue | null>(null);

function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  const value = useMemo<AuthValue>(
    () => ({
      session,
      user: session?.user ?? null,
      loading,
      signOut: async () => {
        await supabase.auth.signOut();
      },
    }),
    [session, loading],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AppProviders');
  return ctx;
}

/* ------------------------------------------------------------------ */
/* Tenant (current institution + this user's roles)                   */
/* ------------------------------------------------------------------ */
interface TenantValue {
  institution: Institution | null;
  institutionId: string | null;
  roles: AppRole[];
  isSuperAdmin: boolean;
  isLoading: boolean;
  hasRole: (...roles: AppRole[]) => boolean;
  refetch: () => void;
}
const TenantContext = createContext<TenantValue | null>(null);

export const tenantQueryKeys = {
  me: ['me'] as const,
  institution: (id: string | null) => ['institution', id] as const,
};

function TenantProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();

  const meQuery = useQuery({
    queryKey: tenantQueryKeys.me,
    enabled: !!user,
    queryFn: async () => {
      const [{ data: profile }, { data: roles }] = await Promise.all([
        supabase.from('profiles')
          .select('institution_id, is_super_admin')
          .eq('id', user!.id).single(),
        supabase.from('user_roles').select('role').eq('user_id', user!.id),
      ]);
      return {
        institutionId: profile?.institution_id ?? null,
        isSuperAdmin: profile?.is_super_admin ?? false,
        roles: (roles ?? []).map((r) => r.role) as AppRole[],
      };
    },
  });

  const institutionId = meQuery.data?.institutionId ?? null;

  const instQuery = useQuery({
    queryKey: tenantQueryKeys.institution(institutionId),
    enabled: !!institutionId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('institutions').select('*').eq('id', institutionId!).single();
      if (error) throw error;
      return data as Institution;
    },
  });

  const roles = meQuery.data?.roles ?? [];
  const value = useMemo<TenantValue>(
    () => ({
      institution: instQuery.data ?? null,
      institutionId,
      roles,
      isSuperAdmin: meQuery.data?.isSuperAdmin ?? false,
      isLoading: meQuery.isLoading || (!!institutionId && instQuery.isLoading),
      hasRole: (...wanted) => wanted.some((r) => roles.includes(r)),
      refetch: () => {
        meQuery.refetch();
        instQuery.refetch();
      },
    }),
    [instQuery.data, institutionId, roles, meQuery.data, meQuery.isLoading, instQuery.isLoading],
  );
  return <TenantContext.Provider value={value}>{children}</TenantContext.Provider>;
}

export function useTenant() {
  const ctx = useContext(TenantContext);
  if (!ctx) throw new Error('useTenant must be used within AppProviders');
  return ctx;
}

/* ------------------------------------------------------------------ */
/* Branding (paint the institution's identity onto the app)           */
/* ------------------------------------------------------------------ */
interface BrandingValue {
  logoUrl: string | null;
  letterheadUrl: string | null;
  primaryColor: string;
  secondaryColor: string;
}
const BrandingContext = createContext<BrandingValue | null>(null);

function BrandingProvider({ children }: { children: ReactNode }) {
  const { institution } = useTenant();
  const primary = institution?.primary_color || '#1d4ed8';
  const secondary = institution?.secondary_color || '#0f172a';

  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--brand-primary', primary);
    root.style.setProperty('--brand-secondary', secondary);
    if (institution?.name) document.title = `${institution.name} · Education ERP`;
  }, [primary, secondary, institution?.name]);

  const value = useMemo<BrandingValue>(
    () => ({
      logoUrl: institution?.logo_url ?? null,
      letterheadUrl: institution?.letterhead_url ?? null,
      primaryColor: primary,
      secondaryColor: secondary,
    }),
    [institution?.logo_url, institution?.letterhead_url, primary, secondary],
  );
  return <BrandingContext.Provider value={value}>{children}</BrandingContext.Provider>;
}

export function useBranding() {
  const ctx = useContext(BrandingContext);
  if (!ctx) throw new Error('useBranding must be used within AppProviders');
  return ctx;
}

/* ------------------------------------------------------------------ */
/* Root provider                                                      */
/* ------------------------------------------------------------------ */
export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TenantProvider>
          <BrandingProvider>{children}</BrandingProvider>
        </TenantProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

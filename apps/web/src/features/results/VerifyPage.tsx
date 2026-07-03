import { useEffect, useState } from 'react';
import { CheckCircle2, XCircle, ShieldAlert, Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { BRAND } from '../../lib/brand';

interface VerifyResult {
  valid: boolean;
  institution_name: string;
  institution_logo: string | null;
  document_type: string;
  title: string | null;
  payload: unknown;
  issued_at: string;
  revoked: boolean;
}

/** Public page reached by scanning a document's QR code: /verify/:token
 *  Pass `token` from your router; falls back to the last path segment. */
export default function VerifyPage({ token: tokenProp }: { token?: string }) {
  const token = tokenProp ?? decodeURIComponent(window.location.pathname.split('/').filter(Boolean).pop() ?? '');
  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState<VerifyResult | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true); setError(false);
      const { data, error: err } = await supabase.rpc('verify_document', { _token: token });
      if (!active) return;
      if (err) { setError(true); setResult(null); }
      else setResult((data as VerifyResult[])?.[0] ?? null);
      setLoading(false);
    })();
    return () => { active = false; };
  }, [token]);

  const ok = result && result.valid && !result.revoked;
  const typeLabel = result?.document_type?.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center p-6">
      <div className="rounded-2xl border bg-card p-8 text-center shadow-sm">
        {loading ? (
          <div className="py-8 text-muted-foreground"><Loader2 className="mx-auto h-6 w-6 animate-spin" /></div>
        ) : error || !result ? (
          <>
            <XCircle className="mx-auto h-12 w-12 text-red-500" />
            <h1 className="mt-4 text-lg font-semibold">Document not found</h1>
            <p className="mt-1 text-sm text-muted-foreground">This verification code doesn’t match any document on record.</p>
          </>
        ) : (
          <>
            {result.institution_logo && (
              <img src={result.institution_logo} alt="" className="mx-auto mb-3 h-14 w-14 rounded-md object-contain" />
            )}
            <p className="text-sm font-medium">{result.institution_name}</p>

            {ok ? (
              <>
                <CheckCircle2 className="mx-auto mt-4 h-12 w-12 text-emerald-500" />
                <h1 className="mt-3 text-lg font-semibold">Verified authentic</h1>
              </>
            ) : (
              <>
                <ShieldAlert className="mx-auto mt-4 h-12 w-12 text-amber-500" />
                <h1 className="mt-3 text-lg font-semibold">{result.revoked ? 'Document revoked' : 'Not valid'}</h1>
              </>
            )}

            <div className="mt-4 space-y-1 text-sm">
              <p><span className="text-muted-foreground">Type: </span>{typeLabel}</p>
              {result.title && <p><span className="text-muted-foreground">Title: </span>{result.title}</p>}
              <p><span className="text-muted-foreground">Issued: </span>{new Date(result.issued_at).toLocaleDateString()}</p>
            </div>
          </>
        )}
      </div>
      <p className="mt-4 text-center text-xs text-muted-foreground">Document verification · {BRAND.productShort}</p>
    </div>
  );
}

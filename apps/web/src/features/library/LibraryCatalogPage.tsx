import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, Loader2, Search, Settings, BookOpen, UserCheck } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';

import { useTenant } from '../../providers/app-providers';
import {
  useBooks, useUpsertBook, useDeleteBook, useLibrarySettings, useUpsertLibrarySettings,
  useIssueBook, useBorrowerSearch, addDays, type Borrower,
} from './library-api';
import type { LibraryBook } from '../../lib/database.types';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><Label>{label}</Label>{children}</div>;
}

/* ------------------------------ book form ----------------------------- */
function BookDialog({ open, onOpenChange, institutionId, book }: {
  open: boolean; onOpenChange: (v: boolean) => void; institutionId: string; book: LibraryBook | null;
}) {
  const upsert = useUpsertBook(institutionId);
  const blank = { title: '', author: '', isbn: '', category: '', publisher: '', year: '', total_copies: '1', description: '' };
  const [f, setF] = useState(blank);
  useEffect(() => {
    if (!open) return;
    setF(book ? {
      title: book.title, author: book.author ?? '', isbn: book.isbn ?? '', category: book.category ?? '',
      publisher: book.publisher ?? '', year: book.year ? String(book.year) : '', total_copies: String(book.total_copies), description: book.description ?? '',
    } : blank);
  }, [open, book]); // eslint-disable-line react-hooks/exhaustive-deps
  const reset = () => setF(blank);

  const submit = () => {
    if (!f.title.trim()) { toast.error('Enter a title'); return; }
    upsert.mutate({
      id: book?.id, title: f.title.trim(), author: f.author || null, isbn: f.isbn || null, category: f.category || null,
      publisher: f.publisher || null, year: f.year ? Number(f.year) : null, total_copies: Number(f.total_copies) || 1, description: f.description || null,
    }, { onSuccess: () => { toast.success('Book saved'); reset(); onOpenChange(false); }, onError: (e: Error) => toast.error(e.message) });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) reset(); onOpenChange(o); }}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{book ? 'Edit book' : 'Add book'}</DialogTitle>
          <DialogDescription>Changing total copies adjusts how many are available to borrow.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2"><Field label="Title"><Input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></Field></div>
          <Field label="Author"><Input value={f.author} onChange={(e) => setF({ ...f, author: e.target.value })} /></Field>
          <Field label="Category"><Input value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })} /></Field>
          <Field label="ISBN"><Input value={f.isbn} onChange={(e) => setF({ ...f, isbn: e.target.value })} /></Field>
          <Field label="Publisher"><Input value={f.publisher} onChange={(e) => setF({ ...f, publisher: e.target.value })} /></Field>
          <Field label="Year"><Input type="number" value={f.year} onChange={(e) => setF({ ...f, year: e.target.value })} /></Field>
          <Field label="Total copies"><Input type="number" value={f.total_copies} onChange={(e) => setF({ ...f, total_copies: e.target.value })} /></Field>
          <div className="sm:col-span-2"><Field label="Description"><Textarea rows={2} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></Field></div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={upsert.isPending}>{upsert.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ----------------------------- settings ------------------------------- */
function SettingsDialog({ open, onOpenChange, institutionId }: { open: boolean; onOpenChange: (v: boolean) => void; institutionId: string }) {
  const settings = useLibrarySettings(institutionId);
  const save = useUpsertLibrarySettings(institutionId);
  const [f, setF] = useState({ loan_period_days: '', fine_per_day: '', max_books: '' });
  useEffect(() => {
    if (open && settings.data) setF({ loan_period_days: String(settings.data.loan_period_days), fine_per_day: String(settings.data.fine_per_day), max_books: String(settings.data.max_books) });
  }, [open, settings.data]);

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) setF({ loan_period_days: '', fine_per_day: '', max_books: '' }); onOpenChange(o); }}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader><DialogTitle>Library settings</DialogTitle><DialogDescription>Defaults applied when issuing books.</DialogDescription></DialogHeader>
        <div className="space-y-3">
          <Field label="Loan period (days)"><Input type="number" value={f.loan_period_days} onChange={(e) => setF({ ...f, loan_period_days: e.target.value })} /></Field>
          <Field label="Fine per day"><Input type="number" value={f.fine_per_day} onChange={(e) => setF({ ...f, fine_per_day: e.target.value })} /></Field>
          <Field label="Max books per borrower"><Input type="number" value={f.max_books} onChange={(e) => setF({ ...f, max_books: e.target.value })} /></Field>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => save.mutate(
            { loan_period_days: Number(f.loan_period_days) || 14, fine_per_day: Number(f.fine_per_day) || 0, max_books: Number(f.max_books) || 3 },
            { onSuccess: () => { toast.success('Saved'); onOpenChange(false); }, onError: (e: Error) => toast.error(e.message) },
          )} disabled={save.isPending}>{save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------- issue -------------------------------- */
function IssueDialog({ book, onClose, institutionId, loanPeriod }: { book: LibraryBook; onClose: () => void; institutionId: string; loanPeriod: number }) {
  const issue = useIssueBook(institutionId);
  const [query, setQuery] = useState('');
  const [picked, setPicked] = useState<Borrower | null>(null);
  const [due, setDue] = useState(addDays(loanPeriod));
  const results = useBorrowerSearch(institutionId, query);

  const submit = () => {
    if (!picked) { toast.error('Choose a borrower'); return; }
    issue.mutate(
      { book_id: book.id, student_id: picked.type === 'student' ? picked.id : undefined, staff_id: picked.type === 'staff' ? picked.id : undefined, due_date: due },
      { onSuccess: () => { toast.success('Book issued'); onClose(); }, onError: (e: Error) => toast.error(e.message) },
    );
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>Issue “{book.title}”</DialogTitle><DialogDescription>{book.available_copies} of {book.total_copies} copies available.</DialogDescription></DialogHeader>
        <div className="space-y-3">
          <Field label="Borrower">
            {picked ? (
              <div className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                <span>{picked.label}<span className="ml-2 text-xs text-muted-foreground">{picked.sub}</span></span>
                <Button variant="ghost" size="sm" onClick={() => setPicked(null)}>Change</Button>
              </div>
            ) : (
              <>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input className="pl-9" placeholder="Search student or staff" value={query} onChange={(e) => setQuery(e.target.value)} />
                </div>
                {query.trim().length >= 2 && (
                  <div className="mt-1 max-h-44 space-y-1 overflow-y-auto">
                    {results.isLoading && <div className="py-2 text-center"><Loader2 className="mx-auto h-4 w-4 animate-spin" /></div>}
                    {results.data?.map((b) => (
                      <button key={`${b.type}-${b.id}`} onClick={() => { setPicked(b); setQuery(''); }}
                        className="flex w-full items-center justify-between rounded-md border px-3 py-2 text-left text-sm hover:bg-muted">
                        <span>{b.label}</span><span className="text-xs text-muted-foreground">{b.sub}</span>
                      </button>
                    ))}
                    {!results.isLoading && !results.data?.length && <p className="px-1 text-sm text-muted-foreground">No matches.</p>}
                  </div>
                )}
              </>
            )}
          </Field>
          <Field label="Due date"><Input type="date" value={due} onChange={(e) => setDue(e.target.value)} /></Field>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} disabled={issue.isPending || book.available_copies <= 0}>
            {issue.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Issue book
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* -------------------------------- page -------------------------------- */
export default function LibraryCatalogPage() {
  const { institution, institutionId, hasRole, isSuperAdmin } = useTenant();
  const canManage = isSuperAdmin || hasRole('librarian', 'institution_admin', 'principal');

  const [search, setSearch] = useState('');
  const { data: books, isLoading } = useBooks(institutionId ?? '', search);
  const del = useDeleteBook(institutionId ?? '');
  const settings = useLibrarySettings(institutionId ?? '');

  const [bookDialog, setBookDialog] = useState(false);
  const [editBook, setEditBook] = useState<LibraryBook | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [issueBook, setIssueBook] = useState<LibraryBook | null>(null);

  if (!institutionId) {
    return <div className="py-16 text-center text-sm text-muted-foreground">No institution linked to your account.</div>;
  }

  return (
    <div className="mx-auto max-w-4xl space-y-5 p-4 sm:p-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Library</h1>
          <p className="text-sm text-muted-foreground">Catalogue — {institution?.name}</p>
        </div>
        {canManage && (
          <div className="flex gap-2">
            <Button variant="outline" size="icon" title="Settings" onClick={() => setSettingsOpen(true)}><Settings className="h-4 w-4" /></Button>
            <Button onClick={() => { setEditBook(null); setBookDialog(true); }}><Plus className="mr-2 h-4 w-4" /> Add book</Button>
          </div>
        )}
      </header>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input className="pl-9" placeholder="Search title, author, ISBN, category" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      <Card>
        <CardContent className="space-y-2 pt-6">
          {isLoading && <div className="py-6 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin" /></div>}
          {!isLoading && !books?.length && <p className="text-sm text-muted-foreground">No books in the catalogue yet.</p>}
          {books?.map((b) => (
            <div key={b.id} className="flex items-start justify-between gap-3 rounded-md border px-3 py-2">
              <div className="flex min-w-0 gap-3">
                <BookOpen className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{b.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {b.author || 'Unknown author'}{b.category ? ` · ${b.category}` : ''} ·{' '}
                    <span className={b.available_copies > 0 ? 'text-emerald-600' : 'text-red-600'}>{b.available_copies}/{b.total_copies} available</span>
                  </p>
                </div>
              </div>
              {canManage && (
                <div className="flex shrink-0 gap-1">
                  <Button variant="ghost" size="icon" title="Issue" disabled={b.available_copies <= 0} onClick={() => setIssueBook(b)}><UserCheck className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="icon" title="Edit" onClick={() => { setEditBook(b); setBookDialog(true); }}><Pencil className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="icon" title="Delete" onClick={() => {
                    if (!confirm(`Delete "${b.title}"?`)) return;
                    del.mutate(b.id, { onSuccess: () => toast.success('Deleted'), onError: (e: Error) => toast.error(e.message) });
                  }}><Trash2 className="h-4 w-4" /></Button>
                </div>
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      <BookDialog open={bookDialog} onOpenChange={setBookDialog} institutionId={institutionId} book={editBook} />
      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} institutionId={institutionId} />
      {issueBook && <IssueDialog book={issueBook} onClose={() => setIssueBook(null)} institutionId={institutionId} loanPeriod={settings.data?.loan_period_days ?? 14} />}
    </div>
  );
}

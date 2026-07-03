import { useEffect } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Sessions, Classes, Programmes, useArms } from '../academics/academics-api';
import type { Scope } from './attendance-api';

export const selectClass =
  'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50';

export interface ScopeState {
  sessionId: string; classId: string; armId: string; programmeId: string; level: string;
}
export const emptyScope: ScopeState = { sessionId: '', classId: '', armId: '', programmeId: '', level: '' };

export function toScope(s: ScopeState, tertiary: boolean): Scope | null {
  if (!s.sessionId) return null;
  if (tertiary) return s.programmeId ? { sessionId: s.sessionId, programmeId: s.programmeId, level: s.level || undefined } : null;
  return s.armId ? { sessionId: s.sessionId, armId: s.armId } : null;
}

function Labelled({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><Label>{label}</Label>{children}</div>;
}

export function ScopeSelector({ institutionId, tertiary, value, onChange }: {
  institutionId: string; tertiary: boolean; value: ScopeState;
  onChange: (patch: Partial<ScopeState>) => void;
}) {
  const sessions = Sessions.useList(institutionId, { column: 'starts_on', order: false });
  const classes = Classes.useList(institutionId, { column: 'level_order' });
  const programmes = Programmes.useList(institutionId);
  const arms = useArms(value.classId || null);

  // Default to the current session once sessions load.
  useEffect(() => {
    if (!value.sessionId && sessions.data?.length) {
      const current = sessions.data.find((s: any) => s.is_current) ?? sessions.data[0];
      onChange({ sessionId: current.id });
    }
  }, [sessions.data]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <Labelled label="Session">
        <select className={selectClass} value={value.sessionId} onChange={(e) => onChange({ sessionId: e.target.value })}>
          <option value="">Select session</option>
          {sessions.data?.map((s: any) => <option key={s.id} value={s.id}>{s.name}{s.is_current ? ' (current)' : ''}</option>)}
        </select>
      </Labelled>

      {tertiary ? (
        <>
          <Labelled label="Programme">
            <select className={selectClass} value={value.programmeId} onChange={(e) => onChange({ programmeId: e.target.value })}>
              <option value="">Select programme</option>
              {programmes.data?.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </Labelled>
          <Labelled label="Level">
            <Input placeholder="e.g. 100" value={value.level} onChange={(e) => onChange({ level: e.target.value })} />
          </Labelled>
        </>
      ) : (
        <>
          <Labelled label="Class">
            <select className={selectClass} value={value.classId}
              onChange={(e) => onChange({ classId: e.target.value, armId: '' })}>
              <option value="">Select class</option>
              {classes.data?.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </Labelled>
          <Labelled label="Arm">
            <select className={selectClass} value={value.armId} disabled={!value.classId}
              onChange={(e) => onChange({ armId: e.target.value })}>
              <option value="">Select arm</option>
              {arms.data?.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </Labelled>
        </>
      )}
    </div>
  );
}

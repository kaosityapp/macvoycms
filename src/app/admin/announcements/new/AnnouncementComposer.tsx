'use client';

import { useActionState, useState } from 'react';
import { sendAnnouncement, type ActionState } from '../actions';
import { Field, FormError, SubmitButton, inputClass } from '@/components/ui';
import { RichTextEditor } from '@/components/RichTextEditor';
import { formatTime } from '@/lib/format';

type Audience = 'all' | 'location' | 'class' | 'individual';

interface ClassOpt {
  id: string;
  name: string;
  day_of_week: string;
  start_time: string;
  location_name: string;
}
interface MemberOpt {
  id: string;
  name: string;
  family: string;
}

export function AnnouncementComposer({
  locations,
  classes,
  members,
}: {
  locations: { id: string; name: string }[];
  classes: ClassOpt[];
  members: MemberOpt[];
}) {
  const [state, action] = useActionState<ActionState, FormData>(sendAnnouncement, {});
  const [audience, setAudience] = useState<Audience>('all');
  const [selectedClasses, setSelectedClasses] = useState<Set<string>>(new Set());

  const toggleClass = (id: string) =>
    setSelectedClasses((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  const allSelected = classes.length > 0 && selectedClasses.size === classes.length;
  const toggleAll = () =>
    setSelectedClasses(allSelected ? new Set() : new Set(classes.map((c) => c.id)));

  return (
    <form action={action} className="space-y-6">
      <FormError message={state.error} />

      <Field label="Subject" htmlFor="subject" required>
        <input id="subject" name="subject" required className={inputClass} />
      </Field>
      <div className="space-y-1">
        <label className="text-sm font-medium text-brand-ink">
          Message<span className="text-red-600"> *</span>
        </label>
        <RichTextEditor name="body" />
      </div>

      <fieldset className="space-y-3">
        <legend className="text-sm font-semibold text-brand-ink">Audience</legend>

        <AudienceRadio value="all" audience={audience} setAudience={setAudience} label="All students" />
        <AudienceRadio value="location" audience={audience} setAudience={setAudience} label="By location (all its classes)" />
        {audience === 'location' && (
          <select name="location_id" defaultValue="" className={`${inputClass} ml-7 max-w-sm`}>
            <option value="" disabled>
              Select a location…
            </option>
            {locations.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
        )}

        <AudienceRadio value="class" audience={audience} setAudience={setAudience} label="By class" />
        {audience === 'class' && (
          <div className="ml-7 space-y-2">
            <label className="flex items-center gap-2 text-sm font-medium text-brand-pink">
              <input type="checkbox" checked={allSelected} onChange={toggleAll} className="h-4 w-4 accent-brand-pink" />
              Select all classes
            </label>
            <div className="max-h-56 space-y-1 overflow-y-auto rounded-md border border-brand-ink/10 p-2">
              {classes.map((c) => (
                <label key={c.id} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    name="class_ids"
                    value={c.id}
                    checked={selectedClasses.has(c.id)}
                    onChange={() => toggleClass(c.id)}
                    className="h-4 w-4 accent-brand-pink"
                  />
                  {c.name} — {c.day_of_week} {formatTime(c.start_time)} · {c.location_name}
                </label>
              ))}
            </div>
          </div>
        )}

        <AudienceRadio value="individual" audience={audience} setAudience={setAudience} label="Individual dancers" />
        {audience === 'individual' && (
          <div className="ml-7 max-h-56 space-y-1 overflow-y-auto rounded-md border border-brand-ink/10 p-2">
            {members.map((m) => (
              <label key={m.id} className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="family_member_ids" value={m.id} className="h-4 w-4 accent-brand-pink" />
                {m.name} <span className="text-brand-ink/50">({m.family})</span>
              </label>
            ))}
            {members.length === 0 && <p className="text-sm text-brand-ink/50">No dancers yet.</p>}
          </div>
        )}
      </fieldset>

      <input type="hidden" name="audience_type" value={audience} />

      <div className="flex items-center gap-3">
        <SubmitButton pendingText="Sending…">Send announcement</SubmitButton>
        <span className="text-xs text-brand-ink/50">
          Saved to the in-app archive immediately; email goes out once Loops is connected.
        </span>
      </div>
    </form>
  );
}

function AudienceRadio({
  value,
  audience,
  setAudience,
  label,
}: {
  value: Audience;
  audience: Audience;
  setAudience: (a: Audience) => void;
  label: string;
}) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <input
        type="radio"
        name="audience_radio"
        checked={audience === value}
        onChange={() => setAudience(value)}
        className="h-4 w-4 accent-brand-pink"
      />
      {label}
    </label>
  );
}

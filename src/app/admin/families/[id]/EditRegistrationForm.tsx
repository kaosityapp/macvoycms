'use client';

import { useActionState } from 'react';
import { updateDancerDetails, type ActionState } from '../actions';
import { Field, FormError, FormSuccess, SubmitButton, inputClass } from '@/components/ui';

interface Props {
  memberId: string;
  familyId: string;
  dancer: {
    first_name: string;
    last_name: string;
    birthday: string | null;
    gender: string | null;
    address: string | null;
    city: string | null;
    province: string | null;
    postal_code: string | null;
    phone_number: string | null;
    phone_type: string | null;
    medical_notes: string | null;
    emergency_contact_name: string | null;
    emergency_contact_phone: string | null;
    emergency_contact_relationship: string | null;
  };
  family: {
    parent1_name: string | null;
    parent1_phone: string | null;
    parent1_email: string | null;
    parent2_name: string | null;
    parent2_phone: string | null;
    parent2_email: string | null;
  } | null;
}

export function EditRegistrationForm({ memberId, familyId, dancer, family }: Props) {
  const [state, action] = useActionState<ActionState, FormData>(updateDancerDetails, {});

  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="member_id" value={memberId} />
      <input type="hidden" name="family_id" value={familyId} />
      <FormError message={state.error} />
      <FormSuccess message={state.success} />

      <div className="grid gap-6 sm:grid-cols-2">
        <div className="space-y-3">
          <h3 className="font-semibold text-brand-ink">Dancer</h3>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <Field label="First name" htmlFor="first_name" required>
              <input id="first_name" name="first_name" required defaultValue={dancer.first_name} className={inputClass} />
            </Field>
            <Field label="Last name" htmlFor="last_name" required>
              <input id="last_name" name="last_name" required defaultValue={dancer.last_name} className={inputClass} />
            </Field>
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <Field label="Birthday" htmlFor="birthday">
              <input id="birthday" name="birthday" type="date" defaultValue={dancer.birthday ?? ''} className={inputClass} />
            </Field>
            <Field label="Gender" htmlFor="gender">
              <input id="gender" name="gender" defaultValue={dancer.gender ?? ''} className={inputClass} />
            </Field>
          </div>
          <Field label="Address" htmlFor="address">
            <input id="address" name="address" defaultValue={dancer.address ?? ''} className={inputClass} />
          </Field>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <Field label="City" htmlFor="city">
              <input id="city" name="city" defaultValue={dancer.city ?? ''} className={inputClass} />
            </Field>
            <Field label="Province" htmlFor="province">
              <input id="province" name="province" defaultValue={dancer.province ?? ''} className={inputClass} />
            </Field>
            <Field label="Postal / Zip code" htmlFor="postal_code">
              <input id="postal_code" name="postal_code" defaultValue={dancer.postal_code ?? ''} className={inputClass} />
            </Field>
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <Field label="Phone number" htmlFor="phone_number">
              <input id="phone_number" name="phone_number" defaultValue={dancer.phone_number ?? ''} className={inputClass} />
            </Field>
            <Field label="Phone type" htmlFor="phone_type">
              <select id="phone_type" name="phone_type" defaultValue={dancer.phone_type ?? ''} className={inputClass}>
                <option value="">Select…</option>
                <option value="Mobile">Mobile</option>
                <option value="Home">Home</option>
              </select>
            </Field>
          </div>
          <Field label="Medical conditions / medications / allergies" htmlFor="medical_notes">
            <textarea
              id="medical_notes"
              name="medical_notes"
              rows={2}
              defaultValue={dancer.medical_notes ?? ''}
              className={inputClass}
            />
          </Field>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <Field label="Emergency name" htmlFor="emergency_name">
              <input
                id="emergency_name"
                name="emergency_name"
                defaultValue={dancer.emergency_contact_name ?? ''}
                className={inputClass}
              />
            </Field>
            <Field label="Emergency phone" htmlFor="emergency_phone">
              <input
                id="emergency_phone"
                name="emergency_phone"
                defaultValue={dancer.emergency_contact_phone ?? ''}
                className={inputClass}
              />
            </Field>
            <Field label="Relationship" htmlFor="emergency_relationship">
              <input
                id="emergency_relationship"
                name="emergency_relationship"
                defaultValue={dancer.emergency_contact_relationship ?? ''}
                className={inputClass}
              />
            </Field>
          </div>
        </div>

        <div className="space-y-3">
          <h3 className="font-semibold text-brand-ink">Account holder</h3>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <Field label="Parent 1 name" htmlFor="parent1_name" required>
              <input
                id="parent1_name"
                name="parent1_name"
                required
                defaultValue={family?.parent1_name ?? ''}
                className={inputClass}
              />
            </Field>
            <Field label="Parent 1 phone" htmlFor="parent1_phone">
              <input
                id="parent1_phone"
                name="parent1_phone"
                defaultValue={family?.parent1_phone ?? ''}
                className={inputClass}
              />
            </Field>
          </div>
          <Field label="Login email" htmlFor="parent1_email_display" hint="Change via password reset / contact Supabase directly — not editable here.">
            <input id="parent1_email_display" value={family?.parent1_email ?? ''} disabled className={`${inputClass} bg-brand-ink/5`} />
          </Field>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <Field label="Parent 2 name" htmlFor="parent2_name">
              <input
                id="parent2_name"
                name="parent2_name"
                defaultValue={family?.parent2_name ?? ''}
                className={inputClass}
              />
            </Field>
            <Field label="Parent 2 phone" htmlFor="parent2_phone">
              <input
                id="parent2_phone"
                name="parent2_phone"
                defaultValue={family?.parent2_phone ?? ''}
                className={inputClass}
              />
            </Field>
          </div>
          <Field label="Parent 2 email" htmlFor="parent2_email">
            <input
              id="parent2_email"
              name="parent2_email"
              type="email"
              defaultValue={family?.parent2_email ?? ''}
              className={inputClass}
            />
          </Field>
        </div>
      </div>

      <SubmitButton pendingText="Saving…">Save details</SubmitButton>
    </form>
  );
}

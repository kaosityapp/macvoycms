import type { ConsentType } from '@/lib/types/database';

/**
 * Waiver / policy text shown at registration (spec §5 field 12, §3.2 consents).
 *
 * ⚠ PLACEHOLDER WORDING — replace each `text` with Debbie's real policy copy
 * before go-live. The exact string shown here is snapshotted into
 * `consents.policy_text_snapshot` at signing, so whatever is live at that
 * moment is what the family legally agreed to. Editing this file does NOT
 * change past signatures.
 */
export interface PolicyDef {
  type: ConsentType;
  title: string;
  /** Short label next to the checkbox. */
  label: string;
  /** Full text snapshotted on agreement. */
  text: string;
}

export const POLICIES: PolicyDef[] = [
  {
    type: 'liability',
    title: 'Liability Waiver',
    label: 'I agree to the Liability Waiver.',
    text: '[PLACEHOLDER] I acknowledge that Irish dance carries inherent physical risks and release MacVoy School of Irish Dance, its instructors, and venues from liability for injury sustained during classes, rehearsals, performances, or competitions.',
  },
  {
    type: 'media',
    title: 'Media Release',
    label: 'I agree to the Media Release.',
    text: '[PLACEHOLDER] I grant MacVoy School of Irish Dance permission to photograph and record the dancer and to use those images/recordings for promotional purposes without compensation.',
  },
  {
    type: 'code_of_conduct',
    title: 'Code of Conduct',
    label: 'I agree to the Code of Conduct.',
    text: '[PLACEHOLDER] The dancer and family agree to conduct themselves respectfully toward instructors, staff, fellow dancers, and venues, and to follow studio rules and directions.',
  },
  {
    type: 'attire',
    title: 'Attire / Dance Bag Policy',
    label: 'I agree to the Attire / Dance Bag Policy.',
    text: '[PLACEHOLDER] The dancer will arrive with appropriate attire, required shoes, and a labelled dance bag for each class.',
  },
  {
    type: 'costume_rental',
    title: 'Costume Rental Agreement',
    label: 'I agree to the Costume Rental Agreement.',
    text: '[PLACEHOLDER] Rented costumes remain property of MacVoy School of Irish Dance, must be returned clean and undamaged, and the family is responsible for loss or damage.',
  },
  {
    type: 'fee_cancellation',
    title: 'Fee & Cancellation Policy',
    label: 'I agree to the Fee & Cancellation Policy.',
    text: '[PLACEHOLDER] Tuition is billed per the selected payment plan. Fees are non-refundable. Stopping enrolment halts future scheduled charges but does not refund amounts already paid.',
  },
];

export const REQUIRED_CONSENT_TYPES = POLICIES.map((p) => p.type);

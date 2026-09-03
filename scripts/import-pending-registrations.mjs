// One-off import: Debbie's Microsoft Forms export (2026–2027 old registration
// form) -> pending_registrations, for the email-gated pre-filled registration
// flow. Reads Supabase creds from .env.local. Run with:
//   node scripts/import-pending-registrations.mjs "<path-to-xlsx>"
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import XLSX from 'xlsx';

const filePath = process.argv[2];
const dryRun = process.argv.includes('--dry-run');
if (!filePath) {
  console.error('Usage: node scripts/import-pending-registrations.mjs <path-to-xlsx> [--dry-run]');
  process.exit(1);
}

const env = {};
for (const line of readFileSync(new URL('../.env.local', import.meta.url), 'utf8').split('\n')) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].trim();
}
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// --- Live class IDs (Pickering Mon/Thu, Mississauga Tue) -------------------
const CLASS = {
  missBeginner1Soft: '0ffef4f2-692e-4788-a208-7b764ac73db8',
  missBeginnerSoft: '3111ba95-af6c-480c-99d6-cf73473d8194',
  missBeginnerHard: '0459a97c-1e4e-4d99-bed5-174a504ef9ce',
  missAdvancedSoft: '82f07a9a-6bb0-447f-ade8-79cae57bbef9',
  missAdvancedHard: '6f869577-0551-41b6-ba9f-8d2f1b038b52',
  missAdult: 'fc4dde33-0f79-4810-8ffd-ae8df3653a16',
  pickMonBeginnerSoft: '7fb1735e-3b4a-49b2-8de4-3790f4d80733',
  pickMonCompetitive: 'c19b9f93-9622-4a64-876b-9b46585fa7ed',
  pickMonAdultCompetitive: 'a94cd689-48cf-47f9-986d-4e3cf176ebc9',
  pickMonCeili: '32efbfea-5b40-412a-a60e-c2b7d2ae3142',
  pickThuBeginnerSoft: '7dce39e6-4979-4f42-b4c3-86f3690bb804',
  pickThuBeginnerHard: 'f3e7747b-9786-4a7c-adac-bda409a50503',
  pickThuCompetitive: '3d011931-50cd-43f8-983e-c5902add8281',
  pickThuAdult: 'd864db79-bb4b-49a3-9afc-cc96c1bd0764',
};

// Free-text description (from the old Microsoft Forms export) -> class_ids.
// Empty array = no confident current-schedule equivalent; left for Debbie to
// assign manually in admin. See conversation notes for the full mapping
// rationale (times/levels cross-checked against the live `classes` table).
const PICKERING_MAP = {
  'Adult and Advanced soft & hard shoe 6:00pm-9:00pm MONDAY and 6:45pm-10:00pm THURSDAY': [
    CLASS.pickMonCompetitive, CLASS.pickMonAdultCompetitive, CLASS.pickThuCompetitive, CLASS.pickThuAdult,
  ],
  'Adult and Advanced soft & hard shoe 6:00pm-9:00pm MONDAY': [
    CLASS.pickMonCompetitive, CLASS.pickMonAdultCompetitive,
  ],
  // Monday half matches Competitive exactly; Thursday "Advanced 5:30-6:45pm"
  // doesn't correspond to any current class (that slot is Beginner today) —
  // left unmapped per your decision.
  'Advanced soft & hard shoe 6:00pm-7:30pm MONDAY and 5:30pm-6:45pm THURSDAY': [],
  'Advanced soft & hard shoe 6:00pm-7:30pm MONDAY and 6:45pm-8:45pm THURSDAY': [
    CLASS.pickMonCompetitive, CLASS.pickThuCompetitive,
  ],
  'Adult soft & hard shoe 8:45pm-10:00pm THURSDAY': [CLASS.pickThuAdult],
  'Adult soft & hard shoe 7:30pm-9:00pm MONDAY and 8:45pm-10:00pm THURSDAY': [
    CLASS.pickMonAdultCompetitive, CLASS.pickThuAdult,
  ],
  'Beginner soft & hard shoe 5:30pm-6:45pm THURSDAY': [CLASS.pickThuBeginnerSoft, CLASS.pickThuBeginnerHard],
  'Advanced soft & hard shoe 6:45pm-8:45pm THURSDAY': [CLASS.pickThuCompetitive],
  'Beginner soft shoe 5:30pm-6:15pm THURSDAY': [CLASS.pickThuBeginnerSoft],
  'Adult and Advanced soft & hard shoe 6:45pm-10:00pm THURSDAY': [CLASS.pickThuCompetitive, CLASS.pickThuAdult],
};

const MISSISSAUGA_MAP = {
  'Adult and Advanced soft & hard shoe 7:15pm-10:00pm': [
    CLASS.missAdvancedSoft, CLASS.missAdvancedHard, CLASS.missAdult,
  ],
  'Beginner soft & hard shoe 6:00pm-7:15pm': [CLASS.missBeginnerSoft, CLASS.missBeginnerHard],
  // No current "Adult" class at this Tuesday time (Adult is 9-10pm today);
  // overlaps current Advanced Soft Shoe but level doesn't match — unmapped.
  'Adult soft shoe & hard shoe 7:15pm-8:30pm': [],
  // Doesn't align with Advanced Hard (8-9pm) or Adult (9-10pm) — unmapped.
  'Advanced soft & hard shoe 8:30pm-10:00pm': [],
  'Beginner soft shoe 6:00pm-6:45pm': [CLASS.missBeginnerSoft],
};

const REFERRAL_MAP = {
  'returning dancer': 'returning_dancer',
  'internet search': 'internet_search',
  'word of mouth': 'word_of_mouth',
  'social media': 'social_media',
  'local irish club': 'local_irish_club',
};

const MONTH_COLS = [
  { idx: 24, name: 'September', date: '2026-09-01' },
  { idx: 25, name: 'October', date: '2026-10-01' },
  { idx: 26, name: 'November', date: '2026-11-01' },
  { idx: 27, name: 'December', date: '2026-12-01' },
];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function parseBirthday(raw) {
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{2})$/.exec((raw || '').trim());
  if (!m) return null;
  const [, mo, day, yy] = m;
  const year = Number(yy) <= 26 ? 2000 + Number(yy) : 1900 + Number(yy);
  return `${year}-${mo.padStart(2, '0')}-${day.padStart(2, '0')}`;
}

function splitName(full) {
  const trimmed = (full || '').trim().replace(/\s+/g, ' ');
  const sp = trimmed.indexOf(' ');
  if (sp === -1) return { first: trimmed, last: '' };
  return { first: trimmed.slice(0, sp), last: trimmed.slice(sp + 1) };
}

// --- Read + group into family blocks (blank rows separate families) -------
const wb = XLSX.readFile(filePath);
const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, raw: false, defval: '' });
const dataRows = rows.slice(1);

const blocks = [];
let current = [];
for (const row of dataRows) {
  if (row.every((v) => v === '')) {
    if (current.length) blocks.push(current);
    current = [];
  } else {
    current.push(row);
  }
}
if (current.length) blocks.push(current);

const families = [];
const report = { totalFamilies: 0, totalDancers: 0, noClassAssigned: [], noPaymentPlan: [], recoveredEmails: [] };

for (const block of blocks) {
  // Family email = most common valid-looking parent1 email in the block
  // (recovers rows with a typo/garbage value, e.g. a name pasted into the
  // email cell, as long as a sibling row in the same block has it right).
  const emailCounts = new Map();
  for (const row of block) {
    const e = (row[6] || '').trim();
    if (EMAIL_RE.test(e)) emailCounts.set(e.toLowerCase(), (emailCounts.get(e.toLowerCase()) || 0) + 1);
  }
  const familyEmail = [...emailCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  if (!familyEmail) {
    console.warn('SKIPPING block with no valid email at all:', block.map((r) => r[0]));
    continue;
  }

  const first = block[0];
  const { first: parent1First, last: parent1Last } = splitName(first[4]);
  const parent2Name = block.find((r) => r[7])?.[7] || null;
  const referralRaw = (block.find((r) => r[14])?.[14] || '').trim().toLowerCase();

  const dancers = block.map((row) => {
    if ((row[6] || '').trim().toLowerCase() !== familyEmail) {
      report.recoveredEmails.push(`${row[0]} (block email ${familyEmail}, row had "${row[6]}")`);
    }

    // Check each location independently — a mapped Pickering pick must not
    // hide an unmapped Mississauga pick on the same row (or vice versa).
    const pickeringIds = row[16] ? PICKERING_MAP[row[16].trim()] ?? [] : null;
    const missIds = row[17] ? MISSISSAUGA_MAP[row[17].trim()] ?? [] : null;
    if (pickeringIds?.length === 0) report.noClassAssigned.push(`${row[0]} (Pickering: "${row[16]}")`);
    if (missIds?.length === 0) report.noClassAssigned.push(`${row[0]} (Mississauga: "${row[17]}")`);
    const classIds = [...(pickeringIds ?? []), ...(missIds ?? [])];

    const schedule = MONTH_COLS
      .filter(({ idx }) => row[idx] && row[idx].trim() !== '-' && row[idx].trim() !== '')
      .map(({ date }) => ({ date, amount: Number(row[MONTH_COLS.find((m) => m.date === date).idx]) }))
      .filter((i) => Number.isFinite(i.amount) && i.amount > 0);
    if (schedule.length === 0) report.noPaymentPlan.push(row[0]);
    const total = Math.round(schedule.reduce((s, i) => s + i.amount, 0) * 100) / 100;

    const { first: fName, last: lName } = splitName(row[0]);

    return {
      first_name: fName,
      last_name: lName,
      birthday: parseBirthday(row[2]) || undefined,
      gender: row[3] || undefined,
      address: (row[1] || '').replace(/\r\n/g, ', ').trim() || undefined,
      medical_notes: row[13] || undefined,
      emergency_contact_name: row[10] || undefined,
      emergency_contact_phone: row[11] || undefined,
      emergency_contact_relationship: row[12] || undefined,
      class_ids: classIds,
      plan_type: 'custom',
      total_amount: total,
      installment_schedule: schedule,
    };
  });

  families.push({
    email: familyEmail,
    parent1_name: `${parent1First} ${parent1Last}`.trim(),
    parent1_phone: first[5] || null,
    parent2_name: parent2Name,
    parent2_phone: block.find((r) => r[8])?.[8] || null,
    parent2_email: block.find((r) => r[9])?.[9] || null,
    referral_source: REFERRAL_MAP[referralRaw] || null,
    dancers,
  });
  report.totalFamilies += 1;
  report.totalDancers += dancers.length;
}

// --- Write to Supabase -------------------------------------------------
const writes = families.map((f) => ({
  email: f.email,
  parent1_name: f.parent1_name,
  parent1_phone: f.parent1_phone,
  parent2_name: f.parent2_name,
  parent2_phone: f.parent2_phone,
  parent2_email: f.parent2_email,
  referral_source: f.referral_source,
  dancers: f.dancers,
  status: 'pending',
}));

if (dryRun) {
  console.log(`DRY RUN — would import ${writes.length} families / ${report.totalDancers} dancers.`);
  console.log(JSON.stringify(writes, null, 1));
} else {
  const { data, error } = await supabase.from('pending_registrations').insert(writes).select('id, email');

  if (error) {
    console.error('IMPORT FAILED:', error);
    process.exit(1);
  }
  console.log(`Imported ${data.length} families / ${report.totalDancers} dancers.`);
}
console.log();
console.log('=== Recovered emails (typo in original row, used block email) ===');
report.recoveredEmails.forEach((r) => console.log('  ' + r));
console.log();
console.log(`=== No class assigned (${report.noClassAssigned.length}) — needs manual pick in admin ===`);
report.noClassAssigned.forEach((n) => console.log('  ' + n));
console.log();
console.log(`=== No payment plan set (${report.noPaymentPlan.length}) — all months were blank/dash ===`);
report.noPaymentPlan.forEach((n) => console.log('  ' + n));

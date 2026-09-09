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
    text: 'By clicking "agree" below, I acknowledge my understanding that there is a certain amount of risk involved in Irish dancing, and release MacVoy School of Irish Dance, its instructors, and studio locations from liability in the case of an accident, injury, communicable disease etc. to myself or my child(ren). I confirm that I, or my child(ren), am/is/are in good physical condition before participating in each class and am/is/are able to participate fully in the classes attended. I have outlined all medical conditions that MacVoy School of Irish Dance should be aware of on the completed registration form and will inform if any new symptoms or health problems arise. I understand and acknowledge that the instructors at MacVoy School of Irish Dance will be conducting classes in as safe a manner as possible.',
  },
  {
    type: 'media',
    title: 'Media Release',
    label: 'I agree to the Media Release.',
    text: 'By clicking "agree" below, I acknowledge my understanding and accept that any photos, videos, quotations or recordings taken by/on behalf of MacVoy School of Irish Dance are property of MacVoy School of Irish Dance and they may be used without compensation for promotional, educational, commercial, or instructional purposes on all mediums. By signing below, I give permission to MacVoy School of Irish Dance to use photos, videos, quotations or recordings of me or my child(ren) for the above purposes.',
  },
  {
    type: 'code_of_conduct',
    title: 'Code of Conduct',
    label: 'I agree to the Code of Conduct.',
    text: `By clicking "agree" below, as a student/parent/guardian at the MacVoy School of Irish Dance, I commit to:

Taking responsibility for my attitude by:
• Coming to each class with a positive mindset
• Trusting that my instructors and classmates have my best interest at heart

Taking responsibility for my behaviour by:
• Arriving on time to every class with proper footwear and attire, prepared to learn
• Actively participating in each and every class
• Supporting and encouraging my classmates
• Acting in a respectful, honest and supportive manner to instructor and students
• Courteously accepting feedback
• Demonstrating good sportsmanship and being gracious in victory and defeat

Taking responsibility for my own dance career by:
• Practicing at home to improve my skills, and using my practice journal
• Setting goals that push me to be better
• Living up to the commitments listed here`,
  },
  {
    type: 'attire',
    title: 'Attire / Dance Bag Policy',
    label: 'I agree to the Attire / Dance Bag Policy.',
    text: 'By clicking "agree" below, I understand that mandatory attire for class is the MacVoy School of Irish Dance t-shirt, leggings or shorts that are easy to move in (no denim or baggy pants), white Irish dance socks for females, and proper footwear. Black ballet slippers are suitable for beginners, or non-competitive dancers. Irish soft shoes are required for competitive dancers. Irish hard shoes are required for all dancers enrolled in the hard shoe class (recreational and competitive). Hair must be tied back to reduce touching the face. Dancers should always bring a full plastic water bottle with them to class. It is best to pack the dance bag with unscented hand sanitizer, bandages, bobby pins, hair elastics, skipping rope and a spare pair of socks as these always come in handy. No juice/pop, candy/gum or food, electronics or toys allowed in class. Due to serious allergies, please remember that the studio is a scent free and allergen free environment.',
  },
  {
    type: 'costume_rental',
    title: 'Costume Rental Agreement',
    label: 'I agree to the Costume Rental Agreement.',
    text: 'By clicking "agree" below, I acknowledge that school costumes and all related items are property of MacVoy School of Irish Dance, to be rented annually by dancers. Costumes are to be worn at all competitions, recitals and performances. Rented school costume consists of a skirt, cuffs, shawl and hair clip OR school dress and hair clip for girls, a cummerbund and bowtie for boys and a skirt, cuffs and shawl OR school dress for adult ladies. Costume is chosen at teachers discretion. The annual fee and form for costume rental is due early each year. If a dancer withdraws from the program, the costume and related items must be returned immediately in the same condition it was received. If there are any pieces missing or costume is not in appropriate condition, a replacement fee will be charged.',
  },
  {
    type: 'fee_cancellation',
    title: 'Fee & Cancellation Policy',
    label: 'I agree to the Fee & Cancellation Policy.',
    text: 'By clicking "agree" below, I acknowledge that MacVoy School of Irish Dance reserves the right to change class date, time, and delivery if conflicts occur (holidays, competitions, inclement weather, studio conflicts, too few dancers in a class, government regulations etc.), and will provide notice via email if this occurs. 2026-2027 dance year is from September to June ending with the recital. Commitment is required for the entire duration. Competitive dancers are required to continue with lessons throughout the summer. Proper written notice is required for withdrawal from the program. No refunds will be given on tuition payment or additional fees paid under any circumstances. Please note there are no refunds on missed classes, and that non-attendance does not constitute a withdrawal; please notify me directly if you wish to withdraw from the program. Late fees will be charged on late payments, and dancers will not be permitted to class until paid in full.',
  },
];

export const REQUIRED_CONSENT_TYPES = POLICIES.map((p) => p.type);

import { z } from 'zod';

export const CONTACT_SUBJECT_MAX_LENGTH = 120;
export const CONTACT_BODY_MAX_LENGTH = 5000;
export const CONTACT_EMAIL_MAX_LENGTH = 254;

/**
 * A visitor's message to the server administrators, sent from the landing page without an
 * account - hence the contact email. Stored by `POST /api/public/contact`, read in the
 * admin panel; the server never sends email for it.
 */
export const ContactCreateSchema = z.object({
  subject: z.string().trim().min(1, 'Subject cannot be empty').max(CONTACT_SUBJECT_MAX_LENGTH),
  body: z.string().trim().min(1, 'Message cannot be empty').max(CONTACT_BODY_MAX_LENGTH),
  contactEmail: z.string().trim().max(CONTACT_EMAIL_MAX_LENGTH).pipe(z.email()),
});
export type ContactCreate = z.infer<typeof ContactCreateSchema>;

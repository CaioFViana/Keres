# Age verification: reviewer handbook

For the people who review documents for a server's verification service. Read it
before your first item. The design behind the service is in
`docs/age_verification.md`; the procedure below is the reviewer's script, as a
checklist.

## What you decide

One question per item: **is the person in the live photo an adult, and is the
document theirs?** You approve, or you refuse with one reason code. You do not
decide the account, the content or anything else about the person.

When in doubt, refuse. A refusal is not a dead end: the person may send again,
and a different reviewer looks at it. An approval that you doubt cannot be
undone from your side.

## Before you open an item

- Items come oldest first. Claim one. Every image you open is logged (who, what,
  when). The log holds no content.
- Open only what the check needs. Do not browse other items.
- If you know the person, or have any conflict of interest, do not decide the
  item. Tell your operator.

## The check (in this order)

1. **Document whole and legible.** All four edges visible, text sharp, no glare,
   blur or finger over a field. If not, refuse `document_unreadable`.
2. **Original capture.** A photo of the physical document, taken now. Not a
   screenshot, not a photo of a screen, not a print or photocopy, not an obvious
   specimen or template, not visibly edited. If not, refuse `document_not_original`.
3. **Live photo.** A person is in front of the camera, looking at it, and their
   face matches the photo on the document. If not, refuse `face_mismatch`. A photo
   of a photo, or of a screen, in place of the live photo shows no live person:
   also `face_mismatch`.
4. **Adult.** Read the date of birth. The holder must be 18 or over on the day of
   review. If under 18, refuse `underage`.
5. **Type the document data** (see "Why you type" below): name, kind and number,
   exactly as printed, and the date of birth.
6. **Decide.** Approve only if checks 1 to 4 all pass and the data is typed. The
   service will not accept an approval for a holder under 18: if the date you type
   shows that, refuse with `underage`.

## Reason codes

| Code | Use it when | What happens next |
|---|---|---|
| `underage` | The holder is under 18 by the date of birth on the document. | No retry. The account is closed at once. |
| `document_unreadable` | A field you need cannot be read, or the image is cut, blurred or too dark. | The person may send again. |
| `document_not_original` | Screenshot, photo of a screen, print, photocopy, specimen or template, or visible editing. | The person may send again. |
| `face_mismatch` | The face in the live photo is not the one on the document, or no live person is in the photo. | The person may send again. |
| `document_reused` | Do not choose it from what you see. The server sets it when the document has already verified an account on the same server. | The person may send again. |
| `other` | Something you cannot name with a code above still makes you doubt the check. | The person may send again. |

## Specific cases

- **Suspected minor.** If the document shows under 18: `underage`, and the account
  ends. If the document says 18 or over but the person in the live photo is
  clearly not the adult on it: `face_mismatch`. If you think the person is a minor
  and cannot say how the document fits: do not approve; refuse with `other` and
  report it to your operator. Never approve on a hunch either way.
- **Doubtful document.** Doubt is a refusal. Fabricated, edited or a specimen:
  `document_not_original`. Unreadable: `document_unreadable`. Anything else you
  cannot name: `other`.
- **A document that looks reused.** You cannot check reuse from the queue, and do
  not try to search for it. The server's duplicate check refuses a document that
  already verified an account there, without your help. If the document is
  visibly someone else's (a copy of another person's identity document, or a
  photo of a third person's document): `face_mismatch` or `document_not_original`,
  whichever fits. If you recognise an image you have already seen in the queue,
  refuse with `other` and report it to your operator.

## Retries

- After a refusal the person may send again, up to the limit the operator sets
  (default 3 sendings). After that the account is closed. There is no retry after
  `underage`.
- A retry is never given to the reviewer who refused the previous sending. You
  cannot decide a retry of your own refusal. If one reaches you anyway, do not
  decide it; report it to your operator.
- A sending that expires is not a refusal. The person starts again.

## Your hands off the data

- **Never** copy, screenshot, photograph, download, print or describe an image
  outside the review screen. That includes chat, notes, tickets and e-mail.
- Do not write down names, numbers or dates of birth, not even to remember them.
- When you decide, the service destroys the images and their key. You delete
  nothing. If an image is still shown after the decision, or a decision fails,
  report it to your operator at once.

## Why you type the document data

You type the name, kind, number and date of birth for two things, and only these:

1. The service computes a commitment from the name, kind and number. The
   commitment lets the server refuse the same document on a second account,
   without holding the document.
2. The service checks the date of birth against the age rule.

The typed values are discarded when you submit. They are never stored, never
logged and never shown back to you. Type exactly what is printed: a typo weakens
the duplicate check and can make the age check wrong. Check twice before you
submit.

## Your access

- Your account is yours alone. Do not share it.
- Every image you open is logged. Your operator can review that log.
- Use the queue only for the items it gives you.

## Quick reference

- **Approve**: checks 1 to 4 pass, and the data is typed exactly.
- **Refuse**: the one code that fits best; `other` when none does.
- **Never**: copy, screenshot or write down an image or its data; decide a retry of
  your own refusal.

Report anything about data, images or access to your operator. On the official
server that is the Keres team's data protection contact, privacy@keres.me.

_"The first woman to exist. From her grand curiosity a never ending curse, as the world wont go back to what it was ever again."_

# Keres 1.10 - Pandora

_Reference only, do not commit. Covers branch `hestia` vs `master` (v1.9.0): 322 commits, 2026-10-01 → 2026-10-11, plus the terms work still in the worktree._

Now with keres.me, there is no going back. Keres feels more professional and a software with standards. This release brings payments and tiers, songs and music, scene pages, story covers, comic layouts with a page reader, the screenplay format, per-work publishing, and a full pass over menus, lists, graphs and visual consistency. Considered calling it 2.0 but Keres is still the same as before. Hopefully. Is Elpis still in that jar, I wonder...

## Update: the official server runs manual verification and hands out plans

- **Age verification now has two modes: `required` and `manual` (the new default).** `manual` has no verification service: accounts start active and unverified, and an administrator marks verified accounts by hand in the admin panel (Users), after checking the person by other means. The old `disabled` value still boots and counts as `manual`. The adults-only (+18) area works in both modes; `allowNsfw` can be switched on again.
- **Verified accounts choose to see +18 stories in the public showcase.** A switch in the profile screen, off by default, editable any time; revoking the verification turns it off. Collaboration on +18 stories still depends on verification only. Marking a story +18 on your device never blocks anything: the server only refuses to receive, publish or import it where it does not allow it.
- **The official server takes no payments.** It runs without a payment connector; plans are given by the team through the admin panel. Nothing changed in the payment code.
- **Plans on the landing page can be shown without prices.** A setting picks "for sale" (as before) or "information only": plan names and limits, no prices, nothing for sale.
- **New plan limit: max contributors per story.** Readers and writers count alike, the owner does not, and the story owner's plan pays for it. Invitations count as taken when sent; a full story answers 429 and the app says so. Empty means no limit, 0 means no collaborators.
- **Terms and privacy policy rewritten** for the official server: minors are not allowed by default, verification is manual, no payments or refunds, and no email address (contact is the form on keres.me). All four legal texts are version 1. The app re-asks when a text is newer than the one accepted, also on existing installs.

## Feature: Payments and tiers

- Servers for syncing arent free, so Keres.me gets paid plans. **Keres will always be offline first and support story creation.**
- Plans show what they include and how much you used, and the app warns before a limit.
- Payment history shows refunds, and subscriptions can be given as gifts.
- **Plans count your things, not the links between them.** Characters, scenes, chapters, locations, notes, items, tags, boards, sketches, songs and the like count. The links between them (who is in which scene, relations, values) and small parts like choices, effects and scene pages are free. Stories themselves, favorites and comments have their own rules.
- **Plans also cap comments per story.** Generous, but not infinite. The cap counts the comments on a story against the story owner's plan, and an empty cap means no limit.
- The plans a server offers now show the comment cap too: in the app, on the keres.me site and on the payment page.
- When a server refuses to take your story because of your plan, the app now says so and points to the plans, instead of a generic error.
- Keres **DOES NOT ENDORSE MONETIZATION ON SERVERS ANYMORE.** It could cause legal issues for us. We wont stop those who try it, but we do not endorse any API code usage besides for self hosting and personal uses.
	- MPL 2 is still active and always will be. This was made to help the project and official server.

## Feature: Terms of service, and deleting your account

- Keres finally has its rules written down, for the app and for each server.
- First install shows the app terms, and you can read them again anytime in App Settings.
- Creating an account shows that server's own terms first. You scroll to the end to agree, and a copy stays saved with the server so it reads offline, in the server details.
- Tired of a server? The server details screen now has Delete my account. It asks your password, switches the account off at once, and your personal data is gone within 30 days. What you wrote in other people's stories stays, credited to a removed account.
- Deleting your account also takes that server off your device, and your stories there become local ones. You can sign up or log in again on the same server later.
- Servers now keep the sign-in records the law asks for (IP address, the account, and the time of logins, sign-ups, password recovery and session renewals) for 6 months, apart from the admin activity log. The admin activity log no longer stores IP addresses, and is kept for 1 year. Admins can search and export the sign-in records, and looking at them is itself logged.
- No refunds on server charges, sorry. Store purchases follow the store's own policy.

## Feature: Age verification (accounts are 18+)

- **Offline is still free.** No gate, no document, nothing leaves your device. The rule is for **accounts on a server**.
- A server can now require that every new account proves it is 18 or older. The app sends you to that server's own verification service: you send a photo of an ID document and one live photo, a person there checks them, and the result comes back to the server. **The server and the app never see or keep the document.** Both are destroyed when the decision is made.
- Until you are approved the account stays pending and can do nothing else. A refusal can be tried again (another reviewer looks at it); a minor's account is closed. The same document cannot verify two accounts.
- A story marked adults-only (+18) can no longer sneak onto a server by import or sync when the server has no adults-only area.
- Home or LAN servers can turn it off (`AGE_VERIFICATION_MODE=disabled`). Then they have no adults-only area, no verified accounts, and say so in their terms and on their screen.
- `apps/verification` is the reference service (reviewer queue, encrypted submissions, signed events).

## Feature: Songs and music

- **Disclaimer:** Developer is not specialist in music creation. So if efforts fall short, can be used to save in universe lyrics.
- Songs are a full entity: lyrics, translation, melody, key, tempo and meter.
- The app sings them (a synthesized voice, really) with chords, and exports MIDI.
- A scene can carry its own music, and songs print in the manuscript.
- Everything advanced hides behind a Music tools switch, off until you want it. The bundled Alice example sings two public-domain songs.

## Feature: Scene pages, covers and comics

- Scenes can have pages: draw them as sketches or upload pictures.
- Stories and works can have covers: on cards, first page of books (optional), and the showcase.
- Comics lay out as a planning sheet, book openings or a flow, with double-page spreads.
- The online reader turns a comic or storyboard a page at a time, buttons, keys or swipe.

## Feature: Screenplay, Fountain and gamebooks

- Write screenplays in Fountain, with page estimates and PDF export, and import them back.
- The manuscript prints songs, music cues and page counts.
- Gamebooks paginate by scene, so "go to page N" names one scene and choices say where they lead. Alice and Beauty and the Beast show how.
- Campaigns get a Chronicle preset, a campaign pack, and one-step new sessions.

## Feature: Publish one work

- A story publishes one work (arc) at a time, and the public page groups versions by work.
- Loose scenes warn they go into every release. The publish screen warns when the server has public pages off.

## Change: Menus and navigation, reworked

- The story menu regrouped into Write, Components, World, Material and Organize and review.
- Groups remember being open or shut, per story. A shut group stays shut.
- Wider drawers on phones so nothing is cut, and the Back button (and the web one) finally behaves.
- New stories ask how to begin and whether they are adults-only (+18) up front.

## Change: Dashboard, tours, onboarding and help

- Dashboard shows works as cards, a twelve-tile story overview, and shortcuts to keep writing.
- Guided tours with a sliding balloon (before it looked bad). Also added ones for lists, forms, scenes and songs. They can be turned off.
- App Settings redone in titled groups. Help follows the menus.

## Change: Lists, search, details and gallery

- Lists search, filter and sort per story, with highlighted matches.
- Character and Scene details (and friends) split into Details, Relations and Other tabs.
- The gallery grid adapts to the screen, and pickers stopped flashing nonsense on closing.

## Change: Friends and messaging

- Friendships live per server, with lookup, requests, shared stories and conversations.
- Remove and block ask first. Messaging works for everyone.

## Change: Graphs, arcs and locations

- The first graphs Keres ever had, now looking not outdated: relation and location maps share zoom, find, legends and kinder labels.
- Arcs gain medium, author and covers. Locations are interior or exterior.

## Change: Admin, showcase and server

- Admin lists share paging and loading, with moderation tools, NSFW flagging and an activity log that names what changed.
- The showcase gates stories and covers the same way, and the site signs in token-only.
- Sending a story again after unlinking cleans the kept server data once you agree.

## Other changes

- Portuguese says "quadro" for "board" (Decided would be better to translate it after all). Counts read "Stories: N" with no plural to get wrong (one/plural system was failing on me).
- Desktop locks to one instance and shuts down cleanly. Backups, quieter logs, resilience, as closing signals from OS are being respected now.
- Server backups: the last 30 daily copies plus the first one of each month for 3 months, nothing older than about 3 months. The age verification service backs up its own data the same way (never its keys). The payment service keeps nothing of its own, so it has nothing to back up.
- The privacy policy (now version 3) and the data rules (`docs/data-governance.md`) say plainly what is kept and for how long: backups, sign-in records with IP, and the admin log without IP.
- **Smaller servers.** A story you delete is now erased from the server for good 30 days later (you can still restore it before that), and so are the stories of an account that was erased. Stories already downloaded on other devices stay there, as local copies.
- The sync history squashes harder where it weighs most: edits to scenes, sketches, boards, maps and songs older than 2 days collapse into one (the newest 3 stay). If a device stays offline for days and edits the same thing, it may now see a conflict to resolve that it would not have seen before.
- Restoring a server backup can no longer bring back an account you deleted: the server keeps a tiny separate list (account ids and dates only) and deletes those accounts again at start.
- When someone reports something as illegal, the server now keeps a copy of the reported item, and of who is responsible for it, for six months, even if it is deleted meanwhile. That is what the child-protection law (Lei 15.211, art. 27) asks. Admins can read, extend (when an authority asks) or release these copies in a new **Evidence holds** page. They are not part of "Download my data".
- New in the server details: **Download my data**. It saves everything the server holds about your account as one file, including your sign-in records and the history of your age check. Your stories are not in it, since they are already on your device.
- **Lighter desktop app.** The download is smaller: it only carries English and Portuguese now, and on Windows it drops a graphics part Keres never used.
- And more in case I forgot...

## Bugfixes

- Sync engine: some more hardening throughout, nothing the level of 1.9 update of course.
- Board, sketch and location-map rehydration fixed. Empty (name) markers allowed now.
- Tier, admin value and cancel-event math fixed; renewal dates count calendar months.
- The server details screen asked the server for the same things (plan, payments, terms) about ten times every half minute without you touching it; now it asks once.
- Server terms and privacy policy now show up in the server details even for an account made on another device, and open in the language the app is using now.
- Resetting the app is now a full reset: besides the database, media and logins, it forgets the terms and privacy policy you accepted (the welcome asks for both again), drafts, recent icons, seen messages, the music switch and the downloaded CJK font pack and song renderings. Agreeing to a legal text also needs it to stay open for 12 seconds, even when it fits the screen.
- The admin "access records read" line no longer appears just from opening the admin page; and an empty ledger setting no longer stops the server from starting.
- Exports stop excluding scenes without a chapter; pages whose picture is gone stay out on visual modes, counted.
- Could be more I forgot.

## Code small refactoring

- (Dev) Theme styles build once per palette, forms and lists share their code, soft-delete is one helper, PDFs build byte-identical from split files costing way less system resources to build.
- (Dev) The Android app finally has its real package name (`me.keres.client`), everywhere.
- (Dev) Files tidied by topic in the app, shared code, API and admin, with a guide on where new ones go (`docs/file_structure.md`). Imports use short paths now, and a test keeps it that way.
- (Dev) Starting the app no longer leaves a changed `registry.ts` behind.

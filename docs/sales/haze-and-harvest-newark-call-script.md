================================================================================
HAZE AND HARVEST — NEWARK NY — SALES CALL PLAYBOOK
Print this. Pull it up while you call.
Generated: May 2, 2026 (live API + Firestore pull)
================================================================================

## SHOP DETAILS

Shop name: Haze and Harvest
Storefront ID: ocm-14513-newark-haze-and-harvest
Address: 6740 State Route 31 E, Newark, NY 14513
Region: Finger Lakes (Wayne County — Newark, not Newark NJ)
Phone: (315) 332-8189
Website: https://hazeandharvest.com
Owner status: UNCLAIMED (you're the first to talk to them)
Followers on Canopy Trove: 0 ← live count post-bug-fix
Payment methods: Cash (per Google; no owner declaration)

Hours (live from API): OPEN 7 DAYS — strongest retail hours of any
shop in the Wayne County set
Monday 10:00 AM – 9:00 PM
Tuesday 10:00 AM – 9:00 PM
Wednesday 10:00 AM – 9:00 PM
Thursday 10:00 AM – 9:00 PM
Friday 10:00 AM – 9:00 PM
Saturday 10:00 AM – 9:00 PM ← OPEN NOW (May 2 Sat)
Sunday 10:00 AM – 6:00 PM

Best time to call:

- Any day 11:00 AM – 1:30 PM
- Or any day 6:30 – 8:00 PM (evening shift, often the owner is on
  the floor)

================================================================================
🚨🚨 PRIORITY 1 COMPLIANCE FLAG — TRIAGE BEFORE THE CALL
================================================================================

Apple just approved Canopy Trove (Pending Developer Release). If a
re-reviewer pulls /storefront-details/ocm-14513-newark-haze-and-harvest
during their next pass — say, for a metadata audit, expedited review
update, or because someone reports the listing — Haze and Harvest is
the highest-risk storefront on the platform right now.

ONE SINGLE 5★ REVIEW (Daniellett, April 17, 15 days ago) hits ALL
FOUR explicit rejected patterns from CLAUDE.md project memory:

1.  "Verified Purchase" phrasing
2.  Specific product name: "Orange Cream Pop"
    (this is LITERALLY the example used in CLAUDE.md as the
    rejected-pattern illustration — quote: "specific cannabis
    product names ('Orange Cream Pop', 'moon rocks', etc.)")
3.  Specific product name #2: "moon rocks"
    (LITERALLY the second example from CLAUDE.md)
4.  "energy was high"
    (LITERALLY the third example from CLAUDE.md — quote: "'energy
    was high' (cannabis-connotation in context)")
5.  "Fast checkout" tag (dead tag we removed in PR #14, this
    review predates the removal so it still surfaces)

This is the worst-case combination of every Apple 1.4.3 trip wire
we've documented, in one review.

ACTION ITEM (do BEFORE the call, ideally before clicking Release):

- Soft-hide review id `review-bb8c60c3-bc91-40b0-ae4e-cf950870b52d`
  in the admin console until the body can be moderated. The 5-star
  rating is fine; the body needs to lose the four flagged phrases
  AND the Fast-checkout tag.
- If you want a backfill script that strips the dead "Fast checkout"
  tag from ALL existing reviews and flags review bodies containing
  the rejected patterns for owner moderation, that's the same script
  I floated for Coughie Shop / Twisted Cannabis FLX. Worth shipping
  this week.

================================================================================
🚨 PRIORITY 2 — THE BRAND-NEW 1★ REVIEW
================================================================================

April 29 (3 days ago), an anonymous reviewer left a 1★ review:

"This shop is an absolute joke. From empty, out of stock cases, to
uneducated staff. You'll be lucky to get the products that you
actually ordered, and you'll be even more lucky if they're
actually in the package, and not expired. Save your time, save
your money, and go to a different place where you will actually
receive customer service!"

This is BAD for the shop and also bad for us:

For the shop:

- It's their newest review, which is the first thing customers see
  when they open the storefront page
- Combined with the older 5★, average rating dropped from 5.0 to 3.0
- No owner reply — the silence amplifies the damage
- Customer #100 today sees "shop is an absolute joke" with no
  defense and writes off the place

For us (compliance angle):

- "products that you actually ordered" implies in-app ordering
- "in the package" implies delivery / curbside pickup fulfillment
- Both phrases describe features Canopy Trove DOES NOT HAVE
- A casual reader (or Apple reviewer) would assume we offer
  ordering, which puts us back in 1.4.3 territory
- The reviewer is bashing the SHOP but using language that paints
  US as a marketplace

ACTION (pre-call, low-effort):

- Leave the review in place (it's an honest customer voice and we
  shouldn't censor 1-star reviews — that's its own trust problem)
- BUT prioritize getting the owner claimed today so they can reply
  publicly. The owner reply is the actual fix here.

================================================================================
YOUR UNFAIR ADVANTAGE
================================================================================

Different from Coughie Shop / Victory Road Farm — there's no owner
named in the safe text of these reviews. So you can't open with
"Hey, is Renee around?" the way you could with Coughie.

What you CAN open with: real, specific pain.

The hook is: "you have a brand-new 1-star review with no reply. Every
customer who finds your shop on our app sees that as the first
impression. Two minutes to claim and you can defuse it."

That's a stronger pitch than the Coughie / Victory "you have a 5-star
review nobody told you about" pitch — there's URGENCY here, not just
opportunity.

## NO SAFE-TO-READ QUOTE THIS TIME

Daniellett's 5★ is unusable on the call (and in any owner reply)
because of the compliance landmines. The 1★ doesn't name names. So
skip the quote-reading move from the other two playbooks. Lead with
the urgency angle instead.

================================================================================
THE 90-SECOND OPENER
================================================================================

When they answer:

"Hey, this is Rozell from Canopy Trove — the licensed NY dispensary
discovery app. I'm not selling anything yet, I'm calling because Haze
and Harvest just picked up a brand-new 1-star review on our app three
days ago, and there's no owner reply. Whoever owns the shop's online
presence is going to want to see this and respond before the next
50 customers who find you on our app see a silent storefront and a
1-star headline. Got 90 seconds?"

If they put you through to a manager / owner:

"Hey, the situation: April 29, an anonymous customer left a 1-star
review of Haze and Harvest on our app calling out empty cases,
out-of-stock items, and product issues. It's harsh, it's specific,
and right now nobody from your shop has replied. That review is the
first thing every new customer sees on your storefront page on Canopy
Trove.

Two minutes to claim your listing and you can post a public reply
under that review. The reply does more for new customers than the
review does — it shows you saw it, you care, and you're addressing
it. Want to do it now while we're on the phone?"

GOAL: present the FIX, not the complaint. The owner already knows
their shop has issues. What they don't know is that there's a public
unanswered 1-star sitting in front of every new customer.

================================================================================
THE NUMBERS (USE IF THEY ASK "WHAT'S THE VALUE")
================================================================================

In the LAST 30 DAYS on Canopy Trove (April 2 – May 2 2026, queried
live from Firestore analytics_daily_storefront_metrics):

- 901 times your shop card showed up in customer search results
- 52 customers opened your full storefront page (5.8% CTR — low,
  the unanswered 1★ is part of why)
- 13 customers tapped "Go Now" to navigate to the shop
- 1 website tap (April 19)
- 0 phone taps
- 0 menu taps (no menu URL on file)
- 2 reviews submitted (April 17 + April 29)

Trailing 7 days alone:

- 142 card impressions
- 10 page opens
- 0 Go Now taps ← zero navigation intent in the last week
- 0 website taps

Wayne County peer comparison (same impression volume, ~900/mo):
HAZE+HARVEST COUGHIE VICTORY
Impressions: 901 901 900
Page opens / CTR: 52 (5.8%) 190 (21%) 58 (6.4%)
Go Now taps: 13 168 18
Reviews: 2 (1★ + 5★) 1 (5★) 1 (5★)
Avg rating: 3.0 5.0 5.0
Owner reply: NONE NONE NONE
Website tap rate: ~0.1% of imp N/A 0%

What changes the moment they claim:

- They reply to the 1★ publicly (kills the silent-storefront problem)
- They reply to the 5★ publicly (after we moderate the body — see
  Priority 1 above)
- They get the OCM-verified badge (auto-pulled from NY state public
  records)
- They can keep hours updated, upload photos, add menu link
- All FREE.

================================================================================
WHAT YOU'RE ASKING THEM TO DO TODAY (ON THIS CALL)
================================================================================

Step 1: CLAIM THE LISTING. Free. Takes 60 seconds.

Tell them:

"Two minutes. Download Canopy Trove from the App Store. Profile →
Owner Portal → Claim My Shop. Search 'Haze' — your Newark listing
pops up. We'll call this same number you're on right now and read
you a 6-digit code. You type it in, you own the listing. Then we
write the response to that 1-star review together while we're still
on the call."

Step 2 (CRITICAL — do it on the call): WRITE THE 1★ REPLY WITH THEM

Suggested template they can edit:

"Thanks for the honest feedback — it stings, but it's the kind
of feedback we need. We've been working on inventory accuracy
and staff training and we hear you. If you're willing to give
us another shot, ask for [name] when you come in and the first
item is on us. — [Owner first name], Haze and Harvest"

Coach them: don't argue. Don't excuse. Don't say "we're sorry you
felt that way." Acknowledge → state the action → invite them back.
That reply will be visible to every future customer.

================================================================================
LIKELY OBJECTIONS + YOUR RESPONSES
================================================================================

## OBJECTION: "We don't take online reviews seriously"

RESPONSE:
"Totally fair — but the customer who reads your storefront page
tomorrow doesn't know that. They see a 1-star with no reply and
assume it's true. The reply isn't for the 1-star reviewer; it's for
customer #100 who's deciding whether to drive to Newark."

## OBJECTION: "How do we know it's a real customer?"

RESPONSE:
"You don't, and you don't have to. Your reply doesn't have to confirm
or deny their experience. It just has to show you read it and you
care. That alone moves the needle for the next reader."

## OBJECTION: "We already have a Google rating"

RESPONSE:
"Sure, and that 1-star isn't on Google — it's only on Canopy Trove.
Our app users find you through us, not Google. The two reputations
are separate. You're claiming a free listing on a platform where
you have an unanswered 1-star, that's all."

## OBJECTION: "Just delete the review for us"

RESPONSE:
"I can't, and you don't want me to. The minute owners can pay to
delete bad reviews, the platform loses all credibility. What you CAN
do is reply publicly and turn it into a positive — every other
review platform works the same way. This is leverage, not a problem."

## OBJECTION: "How much does this cost?"

RESPONSE:
(reuse Coughie / Victory playbook answer — claiming + replying is
free forever, paid tiers are for promos / featured / AI tools)

## OBJECTION: "Send me an email"

RESPONSE:
"Two minutes right now is faster than reading my email. Let's do it
on the call — if it doesn't make sense midway you hang up on me."

================================================================================
THE CLOSE
================================================================================

When they're 80% there:

"Open your phone right now. App Store, search 'Canopy Trove',
download. I'll wait."

← Wait silently.

"Got the app? Profile at the bottom right. Tap Owner Portal, then
Claim My Shop. Search 'Haze' — your Newark listing pops up."

"It's gonna ask for your name, business name, email, password. Once
you tap Confirm, this phone — (315) 332-8189 — will ring within 10
seconds. Listen for a 6-digit code, type it in the app, you're in."

"Now go to Reviews. You'll see the 1-star at the top. Tap Reply.
Type the response we wrote together. Hit publish. That's done."

"While you're in there, upload 3 photos — shop front, interior,
budtender area. Add your menu link from hazeandharvest.com. That
last bit will jump your CTR — right now you're at 5.8%, peers in
the area run 6-21%."

================================================================================
AFTER THEY CLAIM (FOLLOW UP WITHIN 24 HOURS)
================================================================================

Send a text or email:

"Great talking with you today. You're now the verified owner of Haze
and Harvest on Canopy Trove. Three quick things this week:

(1) Reply to BOTH reviews if you haven't (1★ and 5★)
(2) Upload 3-4 photos of the shop
(3) Add your menu link from hazeandharvest.com

Once you're settled in (a couple weeks), let's talk Growth tier
($149/mo). For a shop carrying a recent 1★, the photos + featured
slots from Growth are how you re-anchor the visual impression of
your listing. We can revisit when you're ready.

— Rozell"

================================================================================
QUICK-REFERENCE CALL CARD
================================================================================

NUMBER TO DIAL: (315) 332-8189
SHOP NAME: Haze and Harvest
LOCATION: Newark, NY (Wayne County, Finger Lakes region)
WEBSITE: hazeandharvest.com (already on file)
HOURS: 7 days/week, 10am-9pm Mon-Sat, 10am-6pm Sun

OPENER ANGLE: "Brand new 1-star review with no reply, sitting in
front of every new customer."

NO SAFE QUOTE: Both reviews carry compliance risk; do NOT read them
aloud. The 1★ pitch is the pain point; the 5★ stays
in moderation queue.

REVIEW STATE: Apr 17: 5★ Daniellett (compliance hold-back)
Apr 29: 1★ anonymous (open, no reply)
Avg rating: 3.0

30-DAY STATS: 901 imp · 52 opens (5.8% CTR) · 13 Go Now · 0 phone
7-DAY STATS: 142 imp · 10 opens · 0 Go Now · 0 website
PEAK DAYS: Apr 5-10 (week before the 5★)

ASK: Claim listing — FREE — 60 seconds — on the call
HOOK: "Reply to the 1-star together right now."
UPGRADE LATER: Growth tier $149/mo, photos + featured for visual
re-anchoring (revisit 2-3 weeks)

================================================================================
AUDIT NOTES (for you, not for the call)
================================================================================

Compliance — URGENT:

- Daniellett's 5★ review hits FOUR explicit rejected patterns from
  CLAUDE.md ("Orange Cream Pop", "moon rocks", "energy was high",
  "Verified Purchase") plus the dead "Fast checkout" tag. This is
  the most-flagged review on the platform that I'm aware of.
- The 1★ implies ordering / delivery features the app doesn't
  offer ("products that you actually ordered", "in the package")
  — secondary 1.4.3 hazard if a reviewer reads it as describing
  Canopy Trove's functionality.
- Action: ship the dead-tag scrubber + rejected-pattern flagging
  script ASAP. This is the strongest case so far for prioritizing
  it before the next Apple submission.

Daniellett pattern (now 3 shops):

- Apr 7: 5★ Coughie Shop, Wolcott
- Apr 8: 5★ Victory Road Farm, Red Creek
- Apr 17: 5★ Haze and Harvest, Newark
  She reviews ~weekly, always Wayne County / Finger Lakes shops, always
  5-star, always with the same Verified-Purchase + product-name shape.
  Her body language is consistent enough that the rejected-pattern
  backfill script will catch all three of her reviews in one pass.

Activity timeline (last 30 days, queried live):

April 2-4 : 17 / 23 / 9 imp (quiet)
April 5 : 98 imp · 0 opens · 3 Go Now ← surge week begins
April 6 : 87 imp · 2 opens · 2 Go Now
April 7 : 90 imp · 1 open · 1 Go Now
April 8 : 93 imp · 5 opens
April 9-10: 33 / 83 imp
April 11 : 45 imp · 1 open · 1 Go Now
April 12-16: 5-19 imp/day
April 17 : 14 imp · 4 opens · 1 Go Now · Daniellett's 5★ submitted
April 18-19: 21 / 21 imp · ONLY website tap of the month (Apr 19)
April 20-28: 10-23 imp/day, low engagement
April 29 : 53 imp · 4 opens · 1★ review submitted (anonymous)
April 30 : 15 imp · 0 opens
May 1 : 19 imp · 1 open
May 2 (today): 15 imp · 2 opens

Static snapshot (May 2, 2026):

- Hours look correct (7-day operation, late-evening close)
- Phone live (315) 332-8189
- Owner claim: NONE
- Followers: 0 (new live-compute fix is in production as of today;
  number is genuine zero, not a bug artifact)
- Product scans: not queried this run (assume 0)

================================================================================
GO GET THEM. — May 2, 2026
================================================================================

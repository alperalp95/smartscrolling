# FTUE Research Note

> Date: 2026-04-16
> Status: Prepared after controlled rollback of the first FTUE implementation

---

## Why We Are Re-evaluating FTUE

The first FTUE implementation matched the product direction in theory, but in practice it introduced instability in the web preview:

- global modal and persisted state complexity increased
- auth/session initialization and FTUE timing became coupled
- debugging became harder because the app no longer had a clean "pre-FTUE" baseline

Because of that, FTUE is being revisited as a research-first feature instead of a quick UI layer.

---

## Product Principles From Research

Based on current onboarding guidance from product-led growth sources:

1. **Reduce time-to-value**
   FTUE should help the user reach the first meaningful value fast, not delay it with a heavy gate.

2. **Use progressive onboarding**
   The first session should not try to teach everything. Core value comes first, then secondary prompts later.

3. **Personalize after intent**
   Interest selection, daily goals, and notification preferences should come after the user signals intent, not before.

4. **Do not block the primary path**
   The app must still render and function if FTUE state fails, storage is empty, or auth/session init is slow.

5. **Prefer route-level guidance over root-level blockers**
   A root-global modal is risky in web preview and harder to debug. Safer alternatives are inline cards, route banners, and feature prompts.

---

## Recommended FTUE Strategy For SmartScrolling

### Phase A - Safe Entry

Do this first:

- no root-global FTUE modal on web
- app opens directly to feed
- show lightweight inline entry card at the top of feed
- offer two clear paths:
  - explore the feed
  - open the free anchor book

Why:

- preserves value-first product direction
- keeps the app clickable even if FTUE state fails
- makes debugging easier because the main route is still the main route

### Phase B - Intent-Based Nudge

After the user does one meaningful action:

- first save
- first AI question
- first book open

show a small prompt, not a full takeover:

- "Want a more tailored experience?"
- "Choose a few interests"

Why:

- aligns with progressive onboarding
- happens after value is understood

### Phase C - Progressive Profiling

Only after successful auth:

1. Interest selection
2. Daily goal
3. Notification preference

Why:

- profile enrichment should follow intent, not precede it
- avoids turning FTUE into a long questionnaire

---

## Technical Guardrails For The Next Implementation

These are mandatory before FTUE is reintroduced:

1. FTUE must not block app render
2. FTUE must not be required for navigation
3. FTUE must have a full no-op fallback path
4. Web should use inline or route-level FTUE first
5. Root-level modal should only return after web stability is proven
6. FTUE state and auth/session state must stay decoupled

---

## Concrete Reimplementation Plan

### Step 1

Create a feed-top inline FTUE banner instead of a root modal.

### Step 2

Track only one simple state:

- `has_dismissed_ftue_banner`

No routing side effects yet.

### Step 3

Add two CTA buttons:

- `Feed'de Kal`
- `Serbest Kitabi Ac`

These should only navigate when clicked.

### Step 4

After web and mobile stability is confirmed, add a second-stage prompt for interest selection.

### Step 5

Only then reconnect FTUE intent to onboarding/profile logic.

---

## Decision

SmartScrolling should keep a **value-first FTUE**, but the implementation should be:

- **inline before modal**
- **progressive before comprehensive**
- **route-level before root-level**
- **debuggable before clever**

---

## Reference Links

- Amplitude / onboarding and activation thinking: https://amplitude.com/
- Userpilot / app adoption and segmentation guidance: https://userpilot.com/blog/app-adoption/
- Userpilot / onboarding best practices overview: https://userpilot.com/blog/user-onboarding/

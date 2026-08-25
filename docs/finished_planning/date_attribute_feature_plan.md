# Plan: a Date Picker for custom attributes (`AttributeType.DATE`)

Base branch: `ouroboros`. The feature following `AttributeType.ENTITY`, already implemented.

## 1. The problem

`AttributeType.DATE` is today a free `TextInput` with the placeholder `YYYY-MM-DD`
(`AttributeValueInput.tsx`). There is no date picker anywhere in the app. The consequences:

- nothing guarantees the format, so the Detail screen shows what the user typed, raw;
- the Story Analysis check uses `Date.parse`, which accepts far too much;
- there is no way to record a time.

## 2. The central invariant: the date has **no time zone**

The concern raised — "a time zone difference messing with times internal to the story" — is
solved by **storing no time zone at all**. The value is a *floating* civil date: `15/01/2024 10:30`
is 15/01/2024 10:30 in Brasília, in Tokyo and in London, because it is a time **internal to the
story**, not an instant in real time.

That is why **no** time zone field is added to the Story. It would be counterproductive: any
conversion between the story's time zone and the system's reintroduces exactly the shift we
want to avoid. The system's time zone is taken into account in a single way — by being kept out of
the way:

| Trap | How it is avoided |
|---|---|
| `new Date('2024-01-15')` is interpreted as UTC and renders **14/01** at UTC-3 | The value is never parsed by `new Date(string)`. The parser is a regex that extracts the components. |
| `new Date(y, m, d)` uses the local time zone and can slip at daylight-saving boundaries | Dates are built with `Date.UTC(...)` and read with `getUTC*`. |
| `Date.UTC(15, 0, 1)` becomes **1915** (the two-digit year trap) | An explicit `setUTCFullYear(year)` after construction. |
| `toLocaleDateString()` without `timeZone` uses the device's time zone | Every formatting call passes `timeZone: 'UTC'`. |
| Formatting following the **system**'s locale and not the app's | The language comes from `i18n.language`, never from the device. |

The only point where the system's time zone legitimately enters is the picker's "Today" button and the
initial month when opening with no value — "today" for the person writing is their own local date.

## 3. The canonical format

Storage remains plain text in `AttributeValue.value` (§`attributeValueCodec.ts`),
as requested. Two forms, and the format is **self-describing**:

- date only: `YYYY-MM-DD`
- date + time: `YYYY-MM-DDTHH:mm`

No `Z` suffix, no offset, no seconds. Whether there is a time is decided **per value**, not per
field: an "include time" switch inside the picker, and the rendering infers it from the string's
format. That avoids a new column on `StorySchemaField` (which would cost a SQLite +
Postgres migration + a sync handler + export/import) and keeps full compatibility with free-text
values already written.

> The alternative not chosen: a `dateIncludesTime` column on the field, forcing every value
> of that attribute into the same form. It is more predictable for a schema system, but it costs the whole
> online migration chain. If it turns out to be preferable, it is additive — the canonical format does not change.

The year goes from 1 to 9999, zero-padded. Impossible dates (30/02) are rejected by a round trip.

## 4. Layers

### 4.1 `packages/shared/utils/attributeDateValue.ts` (new)

Pure functions, no React, testable in shared's vitest:

| Function | Role |
|---|---|
| `parseAttributeDate(raw)` | A strict regex + calendar validation → `{year, month, day, hour, minute}` or `null`. `hour/minute` `null` = date only |
| `formatAttributeDate(parts)` | components → the canonical string |
| `isValidAttributeDate(raw)` | `parseAttributeDate(raw) !== null` |
| `attributeDateWeekday(parts)` | 0–6, through `Date.UTC` + `getUTCDay()` — immune to time zones |
| `toUtcDate(parts)` | A `Date` in UTC, to feed `Intl` |
| `formatAttributeDateForDisplay(raw, language)` | A localized string with the day of the week (and the time, if there is one), or `null` if it does not parse |

`formatAttributeDateForDisplay` uses `Intl.DateTimeFormat(language, { weekday: 'long', year,
month: 'long', day, [hour, minute], timeZone: 'UTC', hourCycle })` over the UTC date. With
`timeZone: 'UTC'` + a date built in UTC, the output is identical in any time zone. `Intl` is already
used in the app (`EntityMetadata`, `OperationLogListItem`), but there is a `try/catch` falling back to the
canonical string if the runtime has no ICU.

### 4.2 The picker (client)

`components/common/inputs/DatePickerInput/` — the same pair as the ColorPicker:

- **`DatePickerInput.tsx`**: a calendar icon + a read-only `TextInput` showing the **already
  formatted** value (not the canonical one), opening a `ResponsiveModal`. The structure is copied from
  `ColorPickerInput`, including `commonInputStyles.customComponentInput`.
- **`DatePickerModal.tsx`**: the modal's content, with state of its own, confirming on "Select"
  (the value only comes out on confirm, as in the ColorPicker).

The modal's layout, from the top down:

1. **A header with the day of the week** — "Wednesday, 15 January 2024 10:30", in the app's
   language. It is the "show the day of the week at the top" requirement and serves as a preview of what the Detail will
   show.
2. `‹ month ›` navigation + a typable year field (stories set in the year 1342 or 7000 are normal).
3. A weekday header, abbreviated in the app's language (derived from `Intl`, not written
   by hand).
4. The month's grid. The selected day highlighted; empty cells before the 1st.
5. An **"include time"** switch (`ThemedSwitch`). On, it reveals two numeric `HH:mm` fields,
   clamped.
6. "Today" and "Clear".
7. "Cancel" / "Select".

An invalid or legacy initial value (old free text) is not destroyed on opening: the modal starts
in today's month with no selection, and the old value is only replaced if the person confirms.

### 4.3 How it appears in the story

`CustomAttributeDetailFields.formatValueForDisplay` gains the DATE branch, calling
`formatAttributeDateForDisplay(raw, i18n.language)`:

- `2024-01-15` → **"segunda-feira, 15 de janeiro de 2024"** (pt) / "Monday, January 15, 2024" (en)
- `2024-01-15T10:30` → **"segunda-feira, 15 de janeiro de 2024 10:30"**
- an unparseable legacy value → the raw string, breaking nothing

The language = the application's language (`i18n.language`), never the device's. As a free
consequence, the comments' `contentSnapshot` comes to hold the formatted date, not the raw ISO.

### 4.4 Other points

| File | Change |
|---|---|
| `AttributeValueInput.tsx` | `case DATE` → `DatePickerInput` (it also applies to the "default value" in `StorySchemaFieldFormScreen`, which goes through here) |
| `AdvancedSearchModal.tsx` | `case 'date'` → `DatePickerInput` instead of `TextInput`. Safe: no **native** field is `type: 'date'` in `entityFields.ts`, so that case is only reached through a custom attribute |
| `utils/storyAnalysisChecks.ts` | invalid = `!isValidAttributeDate(raw) && Number.isNaN(Date.parse(raw))`. The `Date.parse` stays as a second chance **on purpose**: without it, every free-text value written before this feature would become a new warning all at once |
| `utils/attributeSearchPredicate.ts` | **no change** — `LIKE %value%` over the canonical format matches a prefix (`2024-01` finds the whole of January), which is the useful behaviour |
| `locales/{en,pt}.json` | the picker's new keys |

Deliberately **out**: `EntityService` (the operation log) and `GlobalSearchService` (the snippet)
carry on showing the canonical value. `2024-01-15T10:30` is readable, and formatting it there would require
loading a language inside the service layer.

## 5. Tests

- `packages/shared/test/utils/attributeDateValue.test.ts`: strict parsing (accepts/rejects),
  30/02 rejected, round trip, a two-digit year not becoming 19xx, the correct day of the week,
  **and the test that matters: formatting the same value with `TZ=UTC`, `TZ=America/Sao_Paulo` and
  `TZ=Asia/Tokyo` gives exactly the same string**.
- `apps/client/test/components/DatePickerModal.test.tsx`: it opens on the right month, selects a day,
  turns the time on and emits `T10:30`, "Clear" emits `null`, a legacy value does not disappear on opening.

## 6. Risks

1. **`Intl` without full ICU** in some runtime → month/day names in English or an error. Covered
   by a `try/catch` with a fallback to the canonical string.
2. **Years > 9999** are not representable in the canonical format. If very long-term stories
   turn out to be a real case, the format has to change before there is written data.
3. **Legacy free-text values** carry on existing and are displayed raw. There is no automatic
   migration: guessing whether "01/02/2024" is the 1st of February or the 2nd of January is impossible.

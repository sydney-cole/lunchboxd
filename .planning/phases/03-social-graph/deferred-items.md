# Deferred Items — Phase 03 Social Graph

## Pre-existing test failures (out of scope — discovered during 03-01)

These failures existed before Phase 03 began and are not caused by 03-01 changes.

### restaurants.test.ts — MEAL-03 failure
- Test: "should accept mealType homemade with no restaurantId"
- File: apps/web/__tests__/restaurants.test.ts:22
- Issue: reviewSchema is rejecting a valid homemade input — likely a rating field requirement mismatch in Zod v4

### reviews.test.ts — REVW-02, REVW-04, REVW-05 failures
- REVW-02: "should accept note up to 2000 characters" — safeParse fails despite valid input
- REVW-04: "should accept tags as array of strings" — safeParse fails on valid tags array  
- REVW-05: "should accept mealDate in YYYY-MM-DD format" — safeParse fails on valid date

These 4 pre-existing failures require investigation of reviewSchema behavior with Zod v4. Not introduced by Phase 03 changes.

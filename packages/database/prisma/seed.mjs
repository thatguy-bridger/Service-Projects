#!/usr/bin/env node
// Realistic Sandy/Draper/Utah households + stops at a chosen scale.
// SPEC.md §21 Phase 0: "npm run seed -- --stops 1000 produces a usable
// dataset" and §16.3: "build the seed script first... and load-test at
// 100, 1,000 and 5,000 stops."
//
// Plain JS against the generated Prisma client — no ts-node/tsx
// dependency needed for a script that only ever runs via `node`.
// @faker-js/faker is a devDependency only, never imported by app code:
// zero production bundle cost.
//
// Usage: node prisma/seed.mjs --stops 1000
//        npm run seed --workspace=packages/database -- --stops 1000

import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { faker } from "@faker-js/faker";

const prisma = new PrismaClient();

// Real (approximate) bounding boxes for the areas SPEC.md §22.1 names as
// the actual service area: "mainly Salt Lake County, Sandy, Draper,
// White City, Cottonwood Heights." Coordinates are hand-picked
// approximations of each city's residential extent, not sourced from a
// GIS layer — good enough for load-testing the map and route builder,
// not for real geocoding. Real geocoding is UGRC, per SPEC.md §9, which
// needs a developer key this environment doesn't have.
const AREAS = [
  { city: "Sandy", zip: "84070", latMin: 40.545, latMax: 40.605, lngMin: -111.915, lngMax: -111.83 },
  { city: "Sandy", zip: "84094", latMin: 40.545, latMax: 40.605, lngMin: -111.915, lngMax: -111.83 },
  { city: "Draper", zip: "84020", latMin: 40.48, latMax: 40.545, lngMin: -111.9, lngMax: -111.79 },
  { city: "White City", zip: "84088", latMin: 40.565, latMax: 40.59, lngMin: -111.86, lngMax: -111.83 },
  { city: "Cottonwood Heights", zip: "84121", latMin: 40.6, latMax: 40.64, lngMin: -111.83, lngMax: -111.78 },
];

const PLACEMENT_NOTES = [
  "Left of the driveway",
  "By the mailbox",
  "Next to the front step",
  "Behind the fence, gate's unlocked",
  null,
  null,
  null,
];

const ACCESS_NOTES = [
  "Dog in the yard",
  "Gate code needed — see notes",
  "Sprinklers run early morning",
  "Steep driveway, park on the street",
  null,
  null,
  null,
  null,
];

function randInRange(min, max) {
  return min + Math.random() * (max - min);
}

function randomAddress() {
  const area = faker.helpers.arrayElement(AREAS);
  const houseNumber = faker.number.int({ min: 100, max: 9999 });
  const street = faker.location.street();
  return {
    addressLine: `${houseNumber} ${street}, ${area.city}, UT ${area.zip}`,
    city: area.city,
    zip: area.zip,
    lat: randInRange(area.latMin, area.latMax),
    lng: randInRange(area.lngMin, area.lngMax),
  };
}

function parseStopCount() {
  const idx = process.argv.indexOf("--stops");
  const raw = idx >= 0 ? process.argv[idx + 1] : "100";
  const n = parseInt(raw, 10);
  if (!Number.isFinite(n) || n <= 0) {
    throw new Error(`--stops must be a positive integer, got: ${raw}`);
  }
  return n;
}

async function main() {
  const stopCount = parseStopCount();
  console.log(`Seeding ${stopCount} households + stops (Sandy/Draper/White City/Cottonwood Heights)...`);

  const org = await prisma.organization.upsert({
    where: { slug: "rounds-seed-org" },
    update: {},
    create: {
      name: "Rounds Seed Org (Salt Lake County)",
      slug: "rounds-seed-org",
      branding: {},
      settings: {},
    },
  });

  // Clean reseed: wipe this org's previously seeded category/events/stops/
  // households instead of accumulating duplicates on repeated runs.
  const previousEvents = await prisma.event.findMany({ where: { orgId: org.id }, select: { id: true } });
  const previousEventIds = previousEvents.map((e) => e.id);
  if (previousEventIds.length > 0) {
    await prisma.subscriptionEvent.deleteMany({ where: { eventId: { in: previousEventIds } } });
    await prisma.stop.deleteMany({ where: { eventId: { in: previousEventIds } } });
    await prisma.event.deleteMany({ where: { id: { in: previousEventIds } } });
  }
  await prisma.subscription.deleteMany({ where: { household: { orgId: org.id } } });
  await prisma.household.deleteMany({ where: { orgId: org.id } });
  await prisma.category.deleteMany({ where: { orgId: org.id } });

  // SPEC.md §4.2's default holiday list, dated for real using standard US
  // federal-holiday-style rules (see apps/rounds/src/lib/holidays.ts for
  // the canonical TS version this mirrors — duplicated here in plain JS
  // since this script intentionally has no build step). $12/holiday
  // matches the flag-signup mockup's price exactly.
  const SEASON_YEAR = 2027;
  function nthWeekdayOfMonth(year, monthIndex0, weekday, n) {
    const first = new Date(Date.UTC(year, monthIndex0, 1));
    const offset = (weekday - first.getUTCDay() + 7) % 7;
    return new Date(Date.UTC(year, monthIndex0, 1 + offset + (n - 1) * 7));
  }
  function lastWeekdayOfMonth(year, monthIndex0, weekday) {
    const lastDayNum = new Date(Date.UTC(year, monthIndex0 + 1, 0)).getUTCDate();
    const last = new Date(Date.UTC(year, monthIndex0, lastDayNum));
    const offset = (last.getUTCDay() - weekday + 7) % 7;
    return new Date(Date.UTC(year, monthIndex0, lastDayNum - offset));
  }
  const MONDAY = 1;
  const HOLIDAYS = [
    { key: "presidents_day", name: "Presidents Day", date: nthWeekdayOfMonth(SEASON_YEAR, 1, MONDAY, 3) },
    { key: "memorial_day", name: "Memorial Day", date: lastWeekdayOfMonth(SEASON_YEAR, 4, MONDAY) },
    { key: "flag_day", name: "Flag Day", date: new Date(Date.UTC(SEASON_YEAR, 5, 14)) },
    { key: "independence_day", name: "Independence Day", date: new Date(Date.UTC(SEASON_YEAR, 6, 4)) },
    { key: "pioneer_day", name: "Pioneer Day", date: new Date(Date.UTC(SEASON_YEAR, 6, 24)) },
    { key: "labor_day", name: "Labor Day", date: nthWeekdayOfMonth(SEASON_YEAR, 8, MONDAY, 1) },
    { key: "veterans_day", name: "Veterans Day", date: new Date(Date.UTC(SEASON_YEAR, 10, 11)) },
  ];

  const category = await prisma.category.create({
    data: {
      orgId: org.id,
      name: `${SEASON_YEAR} Flag Events`,
      slug: `${SEASON_YEAR}-flag-events`,
    },
  });
  const HOLIDAY_PRICE_CENTS = 1200;

  const FLAG_SETOUT_MODULES = {
    publicSignupForm: true,
    subscriptionSourcedStops: true,
    territoryFillOrCsvStops: false,
    stripePayment: true,
    householdSelfService: true,
    placementNotes: true,
    expectsSomeoneToAnswer: false,
    photoOnVisit: false,
    itemCountOnVisit: false,
    amountCollectedOnVisit: false,
  };
  const FLAG_SETOUT_OUTCOMES = [
    { key: "placed", disposition: "SUCCESS" },
    { key: "could_not_place", disposition: "FAILED" },
    { key: "skipped_by_request", disposition: "NEUTRAL" },
  ];

  const holidayEvents = [];
  for (const h of HOLIDAYS) {
    const serviceStartsAt = new Date(h.date);
    serviceStartsAt.setUTCHours(12); // 6am Mountain (UTC-6 in July) as a nominal start
    const serviceEndsAt = new Date(serviceStartsAt);
    serviceEndsAt.setUTCHours(serviceStartsAt.getUTCHours() + 4);
    const ev = await prisma.event.create({
      data: {
        orgId: org.id,
        categoryId: category.id,
        kind: "FLAG_SETOUT",
        name: `${h.name} ${SEASON_YEAR} — Flag Set-Out`,
        slug: `${h.key}-${SEASON_YEAR}`,
        status: "OPEN",
        priceCents: HOLIDAY_PRICE_CENTS,
        serviceStartsAt,
        serviceEndsAt,
        timezone: "America/Denver",
        modules: FLAG_SETOUT_MODULES,
        outcomeSet: { outcomes: FLAG_SETOUT_OUTCOMES },
        createdBy: "seed-script",
      },
    });
    holidayEvents.push({ ...h, event: ev });
  }

  console.log(`Created category ${category.name} with ${holidayEvents.length} holiday events.`);

  // Seeded stops attach to Pioneer Day — SPEC.md's own worked example
  // ("Admin opens the Memorial Day event") and the beachhead this org
  // picked (§22 round 3: "Flag setup... exercises the whole chain").
  const event = holidayEvents.find((h) => h.key === "pioneer_day").event;

  const BATCH = 500;
  let created = 0;
  while (created < stopCount) {
    const batchSize = Math.min(BATCH, stopCount - created);

    const households = Array.from({ length: batchSize }, () => {
      const addr = randomAddress();
      return {
        id: randomUUID(),
        orgId: org.id,
        contactName: faker.person.fullName(),
        contactEmail: faker.internet.email(),
        contactPhone: faker.phone.number(),
        addressInput: addr.addressLine,
        address: { city: addr.city, state: "UT", zip: addr.zip },
        lat: addr.lat,
        lng: addr.lng,
        geocodeConfidence: 0.95,
        geocodeSource: "seed",
        placementNote: faker.helpers.arrayElement(PLACEMENT_NOTES),
        accessNotes: faker.helpers.arrayElement(ACCESS_NOTES),
      };
    });

    await prisma.household.createMany({ data: households });

    const stops = households.map((h) => ({
      id: randomUUID(),
      eventId: event.id,
      source: "SUBSCRIPTION",
      householdId: h.id,
      status: "UNASSIGNED",
      lat: h.lat,
      lng: h.lng,
      addressLine: h.addressInput,
      placementNote: h.placementNote,
      accessNotes: h.accessNotes,
    }));

    await prisma.stop.createMany({ data: stops });

    created += batchSize;
    console.log(`  ${created}/${stopCount}`);
  }

  console.log(`Done. Organization: ${org.slug} · Event: ${event.slug} · Stops: ${stopCount}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

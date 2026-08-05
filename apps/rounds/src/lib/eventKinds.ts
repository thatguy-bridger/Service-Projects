import type { EventKind } from "@service-projects/database";

/** SPEC.md §2.1's module matrix, as data. An admin can override any
 * module on any event — this is only the kind's sensible default. */
export interface ModuleMatrix {
  publicSignupForm: boolean;
  subscriptionSourcedStops: boolean;
  territoryFillOrCsvStops: boolean;
  stripePayment: boolean | "optional";
  householdSelfService: boolean;
  placementNotes: boolean;
  expectsSomeoneToAnswer: boolean;
  photoOnVisit: boolean | "optional";
  itemCountOnVisit: boolean;
  amountCollectedOnVisit: boolean;
}

export const MODULE_DEFAULTS: Record<EventKind, ModuleMatrix> = {
  FLAG_SETOUT: {
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
  },
  FLAG_PICKUP: {
    publicSignupForm: false,
    subscriptionSourcedStops: true,
    territoryFillOrCsvStops: false,
    stripePayment: false,
    householdSelfService: true,
    placementNotes: true,
    expectsSomeoneToAnswer: false,
    photoOnVisit: false,
    itemCountOnVisit: false,
    amountCollectedOnVisit: false,
  },
  FLYER_DELIVERY: {
    publicSignupForm: false,
    subscriptionSourcedStops: false,
    territoryFillOrCsvStops: true,
    stripePayment: false,
    householdSelfService: false,
    placementNotes: false,
    expectsSomeoneToAnswer: false,
    photoOnVisit: false,
    itemCountOnVisit: false,
    amountCollectedOnVisit: false,
  },
  FUNDRAISER: {
    publicSignupForm: true,
    subscriptionSourcedStops: false,
    territoryFillOrCsvStops: true,
    stripePayment: "optional",
    householdSelfService: false,
    placementNotes: false,
    expectsSomeoneToAnswer: true,
    photoOnVisit: false,
    itemCountOnVisit: false,
    amountCollectedOnVisit: true,
  },
  PICKUP_COLLECTION: {
    publicSignupForm: false,
    subscriptionSourcedStops: false,
    territoryFillOrCsvStops: true,
    stripePayment: false,
    householdSelfService: false,
    placementNotes: false,
    expectsSomeoneToAnswer: true,
    photoOnVisit: "optional",
    itemCountOnVisit: true,
    amountCollectedOnVisit: false,
  },
};

export type Disposition = "SUCCESS" | "NEUTRAL" | "FAILED";
export interface Outcome {
  key: string;
  disposition: Disposition;
}

/** SPEC.md §2.1: "the visit outcome set is defined per kind, not
 * globally." Every outcome maps to one of three dispositions so
 * progress bars and dashboards work across kinds without special-casing. */
export const OUTCOME_SETS: Record<EventKind, Outcome[]> = {
  FLAG_SETOUT: [
    { key: "placed", disposition: "SUCCESS" },
    { key: "could_not_place", disposition: "FAILED" },
    { key: "skipped_by_request", disposition: "NEUTRAL" },
  ],
  FLAG_PICKUP: [
    { key: "collected", disposition: "SUCCESS" },
    { key: "not_found", disposition: "FAILED" },
    { key: "left_in_place", disposition: "NEUTRAL" },
  ],
  FLYER_DELIVERY: [
    { key: "delivered", disposition: "SUCCESS" },
    { key: "no_access", disposition: "FAILED" },
    { key: "refused", disposition: "NEUTRAL" },
  ],
  FUNDRAISER: [
    { key: "donated", disposition: "SUCCESS" },
    { key: "pledged", disposition: "SUCCESS" },
    { key: "not_home", disposition: "NEUTRAL" },
    { key: "declined", disposition: "FAILED" },
  ],
  PICKUP_COLLECTION: [
    { key: "collected", disposition: "SUCCESS" },
    { key: "nothing_out", disposition: "NEUTRAL" },
    { key: "not_home", disposition: "NEUTRAL" },
  ],
};

export function moduleDefaultsFor(kind: EventKind): ModuleMatrix {
  return MODULE_DEFAULTS[kind];
}

export function outcomeSetFor(kind: EventKind): Outcome[] {
  return OUTCOME_SETS[kind];
}

import type { Role } from "@service-projects/database";

export const ROLES: Role[] = ["OWNER", "ADMIN", "COORDINATOR", "VOLUNTEER", "PREVIEWER"];

export interface Capability {
  id: string;
  label: string;
  roles: Role[];
  /** Role -> footnote, for access that's real but conditional rather than a flat yes. */
  conditional?: Partial<Record<Role, string>>;
}

// The single source of truth for both enforcement (requireRole, the
// scoped query helpers) and the capability card every onboarding tour
// ends on (SPEC.md §3.4, §15). Generating both from one table is the
// point — the capability card can never drift from what the code
// actually allows, because there's only one table to drift from.
export const PERMISSIONS: Capability[] = [
  { id: "event.manage", label: "Create / edit event", roles: ["OWNER", "ADMIN"] },
  { id: "form.manage", label: "Build / publish form", roles: ["OWNER", "ADMIN"] },
  {
    id: "stops.generateFromSubscriptions",
    label: "Generate stops from subscriptions",
    roles: ["OWNER", "ADMIN", "COORDINATOR"],
  },
  { id: "stops.import", label: "Import CSV / fill territory", roles: ["OWNER", "ADMIN", "COORDINATOR"] },
  {
    id: "stops.viewContactDetails",
    label: "View stops with contact details",
    roles: ["OWNER", "ADMIN", "COORDINATOR"],
  },
  { id: "stops.editAddress", label: "Edit a stop's address", roles: ["OWNER", "ADMIN", "COORDINATOR"] },
  { id: "route.manage", label: "Create / edit route", roles: ["OWNER", "ADMIN", "COORDINATOR"] },
  { id: "route.assignVolunteers", label: "Assign volunteers", roles: ["OWNER", "ADMIN", "COORDINATOR"] },
  {
    id: "route.viewAssigned",
    label: "View assigned route",
    roles: ["OWNER", "ADMIN", "COORDINATOR", "VOLUNTEER"],
  },
  { id: "stops.viewUnassigned", label: "View unassigned stops", roles: ["OWNER", "ADMIN", "COORDINATOR"] },
  {
    id: "visit.record",
    label: "Record a visit",
    roles: ["OWNER", "ADMIN", "COORDINATOR", "VOLUNTEER"],
  },
  {
    id: "stops.addInField",
    label: "Add a house in the field",
    roles: ["OWNER", "ADMIN", "COORDINATOR", "VOLUNTEER"],
  },
  {
    id: "household.viewContact",
    label: "See household contact details",
    roles: ["OWNER", "ADMIN", "COORDINATOR"],
    conditional: { VOLUNTEER: "Only for fields an admin has marked visible to volunteers." },
  },
  { id: "payments.view", label: "View subscriptions / payments", roles: ["OWNER", "ADMIN"] },
  { id: "payments.refundOrMarkPaid", label: "Refund / mark paid manually", roles: ["OWNER", "ADMIN"] },
  { id: "renewal.send", label: "Send a renewal campaign", roles: ["OWNER", "ADMIN"] },
  { id: "copy.edit", label: "Edit UI copy", roles: ["OWNER", "ADMIN"] },
  { id: "branding.edit", label: "Edit branding", roles: ["OWNER", "ADMIN"] },
  { id: "layout.edit", label: "Edit layout blocks", roles: ["OWNER", "ADMIN"] },
  { id: "keys.issueVolunteerOrCoordinator", label: "Issue volunteer / coordinator key", roles: ["OWNER", "ADMIN"] },
  { id: "keys.issueAdmin", label: "Issue admin key", roles: ["OWNER"] },
  { id: "data.export", label: "Export data", roles: ["OWNER", "ADMIN"] },
  { id: "audit.view", label: "View audit log", roles: ["OWNER", "ADMIN"] },
  {
    id: "users.manageRoles",
    label: "Add / change a user's role",
    roles: ["OWNER", "ADMIN"],
    conditional: { ADMIN: "Cannot grant the Owner role — only an existing Owner can." },
  },
  {
    id: "public.browseAndRedeem",
    label: "Browse public events · redeem a key",
    roles: ["OWNER", "ADMIN", "COORDINATOR", "VOLUNTEER", "PREVIEWER"],
  },
];

export function can(role: Role | null | undefined, capabilityId: string): boolean {
  if (!role) return false;
  const capability = PERMISSIONS.find((c) => c.id === capabilityId);
  return !!capability && capability.roles.includes(role);
}

export interface CapabilityCardEntry {
  id: string;
  label: string;
  granted: boolean;
  note?: string;
}

/** Drives the capability card under the account menu — SPEC.md §3.4. */
export function capabilityCard(role: Role): CapabilityCardEntry[] {
  return PERMISSIONS.map((capability) => ({
    id: capability.id,
    label: capability.label,
    granted: capability.roles.includes(role),
    note: capability.conditional?.[role],
  }));
}

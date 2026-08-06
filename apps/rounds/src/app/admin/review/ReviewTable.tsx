"use client";

import { DataTable, type DataTableColumn } from "@service-projects/ui";
import { markReviewedBulkAction } from "./actions";

export interface ReviewHousehold {
  id: string;
  contactName: string;
  addressInput: string;
  needsReviewReason: string | null;
  createdAt: Date;
}

const columns: DataTableColumn<ReviewHousehold>[] = [
  { key: "contactName", label: "Name", getValue: (r) => r.contactName },
  { key: "addressInput", label: "Address", getValue: (r) => r.addressInput },
  { key: "needsReviewReason", label: "Reason", getValue: (r) => r.needsReviewReason ?? "" },
  { key: "createdAt", label: "Submitted", getValue: (r) => new Date(r.createdAt).toLocaleDateString() },
];

// This queue is system-generated (a signup lands here automatically,
// never added by hand), so there's no "Add row" here -- "Delete
// selected data" doubles as "mark reviewed": clearing a household off
// this queue without deleting the household itself. Full editing of a
// household's own fields still happens on its Library detail page,
// linked per row.
export function ReviewTable({ households }: { households: ReviewHousehold[] }) {
  return (
    <DataTable<ReviewHousehold>
      rows={households}
      columns={columns}
      csvFilenamePrefix="review-queue"
      emptyMessage="Nothing needs review."
      onDeleteSelected={(ids) => markReviewedBulkAction(ids)}
      deleteLabel="Mark reviewed"
    />
  );
}

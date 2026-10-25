import { Lab_warehouseitemslab_category } from "@/generated/models/Lab_warehouseitemsModel";
import { Lab_warehousetransactionslab_transactiontype } from "@/generated/models/Lab_warehousetransactionsModel";

const toOptionMetadata = (labels: Record<number, string>) =>
  Object.entries(labels).map(([value, label]) => ({ Value: Number(value), Label: label, Color: "" }));

export const categoryOptionMetadata = toOptionMetadata(Lab_warehouseitemslab_category);
export const transactionTypeOptionMetadata = toOptionMetadata(Lab_warehousetransactionslab_transactiontype);
export const statusOptions = [
  { Value: 0, Label: "Active", Color: "#107C10" },
  { Value: 1, Label: "Inactive", Color: "#C50F1F" },
];

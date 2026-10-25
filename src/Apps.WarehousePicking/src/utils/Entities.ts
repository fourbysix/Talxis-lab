import { registerEntities, type HostEntity } from "@/providers/pcf-host";

export const warehouseEntities: HostEntity[] = [
  {
    logicalName: "lab_warehouseitem",
    displayName: "Warehouse Item",
    primaryIdAttribute: "lab_warehouseitemid",
    primaryNameAttribute: "lab_name",
    formPath: (id) => `/items/${id}`,
  },
  {
    logicalName: "lab_warehouselocation",
    displayName: "Warehouse Location",
    primaryIdAttribute: "lab_warehouselocationid",
    primaryNameAttribute: "lab_name",
  },
  {
    logicalName: "lab_warehousetransaction",
    displayName: "Warehouse Transaction",
    primaryIdAttribute: "lab_warehousetransactionid",
    primaryNameAttribute: "lab_name",
  },
];

registerEntities(...warehouseEntities);

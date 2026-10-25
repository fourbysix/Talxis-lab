import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button, MessageBar, MessageBarBody, Spinner, Title1 } from "@fluentui/react-components";
import type { IColumn } from "@talxis/client-libraries";
import { Lab_warehouseitemsService } from "@/generated/services/Lab_warehouseitemsService";
import { Lab_warehouselocationsService } from "@/generated/services/Lab_warehouselocationsService";
import type { Lab_warehouseitems } from "@/generated/models/Lab_warehouseitemsModel";
import type { Lab_warehouselocations } from "@/generated/models/Lab_warehouselocationsModel";
import { RecordFormDialog } from "@/components/RecordFormDialog";
import type { FormField } from "@/components/RecordFormFields";
import { RecordGrid } from "@/components/RecordGrid";
import { useToast } from "@/hooks/use-toast";
import { categoryOptionMetadata } from "@/utils/OptionSets";
import { errorText, servicePayload, serviceResult } from "@/utils/ServicePayload";
import { toNumber } from "@/utils/RecordValues";

const columns: IColumn[] = [
  { name: "lab_name", displayName: "Name", dataType: "SingleLine.Text", isPrimary: true, visualSizeFactor: 220 },
  { name: "lab_sku", displayName: "SKU", dataType: "SingleLine.Text", visualSizeFactor: 130 },
  { name: "lab_availablequantity", displayName: "Available Quantity", dataType: "Whole.None", visualSizeFactor: 140 },
  {
    name: "lab_category",
    displayName: "Category",
    dataType: "OptionSet",
    visualSizeFactor: 140,
    metadata: { OptionSet: categoryOptionMetadata } as IColumn["metadata"],
  },
  { name: "location", displayName: "Location", dataType: "SingleLine.Text", visualSizeFactor: 160 },
];

const fields: FormField[] = [
  { column: { name: "lab_name", displayName: "Name", dataType: "SingleLine.Text", isPrimary: true }, required: true },
  { column: { name: "lab_sku", displayName: "SKU", dataType: "SingleLine.Text" }, required: true },
  { column: { name: "lab_availablequantity", displayName: "Available Quantity", dataType: "Whole.None" }, required: true },
  {
    column: {
      name: "lab_category",
      displayName: "Category",
      dataType: "OptionSet",
      metadata: { OptionSet: categoryOptionMetadata } as IColumn["metadata"],
    },
    required: true,
  },
  { column: { name: "lab_locationid", displayName: "Location", dataType: "SingleLine.Text" }, lookupEntity: "lab_warehouselocation" },
];

export default function WarehouseItemsPage() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);

  const itemsQuery = useQuery({
    queryKey: ["warehouseItems"],
    queryFn: async () => {
      const result = await serviceResult(Lab_warehouseitemsService.getAll({
        select: ["lab_warehouseitemid", "lab_name", "lab_sku", "lab_availablequantity", "lab_category", "_lab_locationid_value"],
        orderBy: ["lab_name asc"],
      }));
      return result.data ?? [];
    },
  });

  const locationsQuery = useQuery({
    queryKey: ["warehouseLocations"],
    queryFn: async () => {
      const result = await serviceResult(Lab_warehouselocationsService.getAll({
        select: ["lab_warehouselocationid", "lab_name"],
        orderBy: ["lab_name asc"],
      }));
      return result.data ?? [];
    },
  });

  const locationRecords = useMemo(
    () => (locationsQuery.data ?? []).map((location: Lab_warehouselocations) => ({
      id: location.lab_warehouselocationid,
      name: location.lab_name,
    })),
    [locationsQuery.data]
  );

  const rows = useMemo(() => {
    if (!itemsQuery.data) return undefined;
    const names = new Map(locationRecords.map((location) => [location.id, location.name]));
    return itemsQuery.data.map((item: Lab_warehouseitems) => ({
      ...item,
      lab_availablequantity: toNumber(item.lab_availablequantity),
      lab_category: toNumber(item.lab_category),
      location: names.get(item._lab_locationid_value ?? "") ?? "",
    }));
  }, [itemsQuery.data, locationRecords]);

  const createMutation = useMutation({
    mutationFn: async (values: Record<string, unknown>) => serviceResult(Lab_warehouseitemsService.create(servicePayload({
      lab_name: values.lab_name,
      lab_sku: values.lab_sku,
      lab_availablequantity: String(values.lab_availablequantity),
      lab_category: Number(values.lab_category),
      ...(values.lab_locationid
        ? { "lab_locationid@odata.bind": `/lab_warehouselocations(${String(values.lab_locationid)})` }
        : {}),
    }))),
    onSuccess: async () => {
      await queryClient.invalidateQueries();
      toast.success("Item created successfully");
    },
    onError: (error) => toast.error(errorText(error)),
  });

  return (
    <section>
      <header className="page-heading">
        <div>
          <Title1>Warehouse Items</Title1>
          <p>Find items and view quantity on hand.</p>
        </div>
        <Button appearance="primary" onClick={() => setDialogOpen(true)}>New item</Button>
      </header>
      {itemsQuery.error && <MessageBar intent="error"><MessageBarBody>{errorText(itemsQuery.error)}</MessageBarBody></MessageBar>}
      {locationsQuery.error && <MessageBar intent="error"><MessageBarBody>{errorText(locationsQuery.error)}</MessageBarBody></MessageBar>}
      {(itemsQuery.isLoading || locationsQuery.isLoading) && <Spinner label="Loading warehouse items" />}
      <RecordGrid rows={rows} columns={columns} entityName="lab_warehouseitem" />
      <RecordFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        title="New warehouse item"
        entityName="lab_warehouseitem"
        fields={fields}
        lookupRecords={{ lab_locationid: locationRecords }}
        onCreate={(values) => createMutation.mutateAsync(values)}
        pending={createMutation.isPending}
      />
    </section>
  );
}

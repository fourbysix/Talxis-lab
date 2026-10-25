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
import { errorText, servicePayload, serviceResult } from "@/utils/ServicePayload";
import { toNumber } from "@/utils/RecordValues";

const columns: IColumn[] = [
  { name: "lab_name", displayName: "Name", dataType: "SingleLine.Text", isPrimary: true, visualSizeFactor: 200 },
  { name: "lab_address", displayName: "Address", dataType: "SingleLine.Text", visualSizeFactor: 240 },
  { name: "lab_capacity", displayName: "Capacity", dataType: "Whole.None", visualSizeFactor: 110 },
  { name: "itemCount", displayName: "Items", dataType: "Whole.None", visualSizeFactor: 90 },
];

const fields: FormField[] = [
  { column: { name: "lab_name", displayName: "Name", dataType: "SingleLine.Text", isPrimary: true }, required: true },
  { column: { name: "lab_address", displayName: "Address", dataType: "SingleLine.Text" }, required: true },
  { column: { name: "lab_capacity", displayName: "Capacity", dataType: "Whole.None" }, required: true },
];

export default function LocationsPage() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);

  const locationsQuery = useQuery({
    queryKey: ["warehouseLocationsList"],
    queryFn: async () => {
      const result = await serviceResult(Lab_warehouselocationsService.getAll({
        select: ["lab_warehouselocationid", "lab_name", "lab_address", "lab_capacity"],
        orderBy: ["lab_name asc"],
      }));
      return result.data ?? [];
    },
  });

  const itemsQuery = useQuery({
    queryKey: ["itemsByLocation"],
    queryFn: async () => {
      const result = await serviceResult(Lab_warehouseitemsService.getAll({
        select: ["lab_warehouseitemid", "_lab_locationid_value"],
      }));
      return result.data ?? [];
    },
  });

  const rows = useMemo(() => {
    if (!locationsQuery.data) return undefined;
    const counts = new Map<string, number>();
    (itemsQuery.data ?? []).forEach((item: Lab_warehouseitems) => {
      if (item._lab_locationid_value) {
        counts.set(item._lab_locationid_value, (counts.get(item._lab_locationid_value) ?? 0) + 1);
      }
    });
    return locationsQuery.data.map((location: Lab_warehouselocations) => ({
      ...location,
      lab_capacity: toNumber(location.lab_capacity),
      itemCount: counts.get(location.lab_warehouselocationid) ?? 0,
    }));
  }, [locationsQuery.data, itemsQuery.data]);

  const createMutation = useMutation({
    mutationFn: async (values: Record<string, unknown>) => serviceResult(Lab_warehouselocationsService.create(servicePayload({
      lab_name: values.lab_name,
      lab_address: values.lab_address,
      lab_capacity: String(values.lab_capacity),
      lab_isactive: true,
    }))),
    onSuccess: async () => {
      await queryClient.invalidateQueries();
      toast.success("Location created successfully");
    },
    onError: (error) => toast.error(errorText(error)),
  });

  return (
    <section>
      <header className="page-heading">
        <div>
          <Title1>Locations</Title1>
          <p>Warehouse locations and the number of items at each location.</p>
        </div>
        <Button appearance="primary" onClick={() => setDialogOpen(true)}>New location</Button>
      </header>
      {locationsQuery.error && <MessageBar intent="error"><MessageBarBody>{errorText(locationsQuery.error)}</MessageBarBody></MessageBar>}
      {itemsQuery.error && <MessageBar intent="error"><MessageBarBody>{errorText(itemsQuery.error)}</MessageBarBody></MessageBar>}
      {(locationsQuery.isLoading || itemsQuery.isLoading) && <Spinner label="Loading locations" />}
      <RecordGrid rows={rows} columns={columns} entityName="lab_warehouselocation" />
      <RecordFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        title="New location"
        entityName="lab_warehouselocation"
        fields={fields}
        onCreate={(values) => createMutation.mutateAsync(values)}
        pending={createMutation.isPending}
      />
    </section>
  );
}

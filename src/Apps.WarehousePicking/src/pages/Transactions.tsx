import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button, MessageBar, MessageBarBody, Spinner, Title1 } from "@fluentui/react-components";
import type { IColumn } from "@talxis/client-libraries";
import { Lab_warehouseitemsService } from "@/generated/services/Lab_warehouseitemsService";
import { Lab_warehousetransactionsService } from "@/generated/services/Lab_warehousetransactionsService";
import type { Lab_warehouseitems } from "@/generated/models/Lab_warehouseitemsModel";
import type { Lab_warehousetransactions } from "@/generated/models/Lab_warehousetransactionsModel";
import { RecordFormDialog } from "@/components/RecordFormDialog";
import type { FormField } from "@/components/RecordFormFields";
import { RecordGrid } from "@/components/RecordGrid";
import { useToast } from "@/hooks/use-toast";
import { transactionTypeOptionMetadata } from "@/utils/OptionSets";
import { errorText, servicePayload, serviceResult } from "@/utils/ServicePayload";
import { toNumber } from "@/utils/RecordValues";

const transactionTypeMetadata = { OptionSet: transactionTypeOptionMetadata } as IColumn["metadata"];
const columns: IColumn[] = [
  { name: "lab_name", displayName: "Name", dataType: "SingleLine.Text", isPrimary: true, visualSizeFactor: 220 },
  { name: "item", displayName: "Item", dataType: "SingleLine.Text", visualSizeFactor: 200 },
  { name: "lab_quantity", displayName: "Quantity", dataType: "Whole.None", visualSizeFactor: 110 },
  { name: "lab_transactiontype", displayName: "Type", dataType: "OptionSet", visualSizeFactor: 130, metadata: transactionTypeMetadata },
  { name: "lab_transactiondate", displayName: "Date", dataType: "DateAndTime.DateAndTime", visualSizeFactor: 180 },
];

const fields: FormField[] = [
  { column: { name: "lab_name", displayName: "Name", dataType: "SingleLine.Text", isPrimary: true }, required: true },
  { column: { name: "lab_itemid", displayName: "Warehouse Item", dataType: "SingleLine.Text" }, required: true, lookupEntity: "lab_warehouseitem" },
  { column: { name: "lab_quantity", displayName: "Quantity", dataType: "Whole.None" }, required: true },
  { column: { name: "lab_transactiontype", displayName: "Transaction Type", dataType: "OptionSet", metadata: transactionTypeMetadata }, required: true },
];

export default function TransactionsPage() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);

  const transactionsQuery = useQuery({
    queryKey: ["allTransactions"],
    queryFn: async () => {
      const result = await serviceResult(Lab_warehousetransactionsService.getAll({
        select: ["lab_warehousetransactionid", "lab_name", "lab_quantity", "lab_transactiontype", "lab_transactiondate", "_lab_itemid_value"],
        orderBy: ["lab_transactiondate desc"],
      }));
      return result.data ?? [];
    },
  });

  const itemsQuery = useQuery({
    queryKey: ["warehouseItemsLookup"],
    queryFn: async () => {
      const result = await serviceResult(Lab_warehouseitemsService.getAll({
        select: ["lab_warehouseitemid", "lab_name"],
        orderBy: ["lab_name asc"],
      }));
      return result.data ?? [];
    },
  });

  const itemRecords = useMemo(
    () => (itemsQuery.data ?? []).map((item: Lab_warehouseitems) => ({ id: item.lab_warehouseitemid, name: item.lab_name })),
    [itemsQuery.data]
  );
  const itemNames = useMemo(
    () => new Map(itemRecords.map((item) => [item.id, item.name])),
    [itemRecords]
  );
  const rows = useMemo(
    () => transactionsQuery.data?.map((transaction: Lab_warehousetransactions) => ({
      ...transaction,
      lab_quantity: toNumber(transaction.lab_quantity),
      lab_transactiontype: toNumber(transaction.lab_transactiontype),
      item: itemNames.get(transaction._lab_itemid_value ?? "") ?? "",
    })),
    [transactionsQuery.data, itemNames]
  );

  const createMutation = useMutation({
    mutationFn: async (values: Record<string, unknown>) => serviceResult(Lab_warehousetransactionsService.create(servicePayload({
      lab_name: values.lab_name,
      lab_quantity: String(values.lab_quantity),
      lab_transactiontype: Number(values.lab_transactiontype),
      lab_transactiondate: new Date().toISOString(),
      "lab_itemid@odata.bind": `/lab_warehouseitems(${String(values.lab_itemid)})`,
    }))),
    onSuccess: async () => {
      await queryClient.invalidateQueries();
      toast.success("Transaction created successfully");
    },
    onError: (error) => toast.error(errorText(error)),
  });

  return (
    <section>
      <header className="page-heading">
        <div>
          <Title1>Transactions</Title1>
          <p>All stock movements, newest first.</p>
        </div>
        <Button appearance="primary" onClick={() => setDialogOpen(true)}>New transaction</Button>
      </header>
      {transactionsQuery.error && <MessageBar intent="error"><MessageBarBody>{errorText(transactionsQuery.error)}</MessageBarBody></MessageBar>}
      {itemsQuery.error && <MessageBar intent="error"><MessageBarBody>{errorText(itemsQuery.error)}</MessageBarBody></MessageBar>}
      {(transactionsQuery.isLoading || itemsQuery.isLoading) && <Spinner label="Loading transactions" />}
      <RecordGrid rows={rows} columns={columns} entityName="lab_warehousetransaction" />
      <RecordFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        title="New transaction"
        entityName="lab_warehousetransaction"
        fields={fields}
        lookupRecords={{ lab_itemid: itemRecords }}
        onCreate={(values) => createMutation.mutateAsync(values)}
        pending={createMutation.isPending}
      />
    </section>
  );
}

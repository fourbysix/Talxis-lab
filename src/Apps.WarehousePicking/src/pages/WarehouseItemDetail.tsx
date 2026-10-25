import { useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button, Card, MessageBar, MessageBarBody, Spinner, Title1, Title3 } from "@fluentui/react-components";
import type { IColumn } from "@talxis/client-libraries";
import { Lab_warehouseitemsService } from "@/generated/services/Lab_warehouseitemsService";
import { Lab_productsService } from "@/generated/services/Lab_productsService";
import { Lab_warehousetransactionsService } from "@/generated/services/Lab_warehousetransactionsService";
import type { Lab_warehousetransactions } from "@/generated/models/Lab_warehousetransactionsModel";
import { BarcodeScanDialog } from "@/components/BarcodeScanDialog";
import { LinkedProductImage } from "@/components/LinkedProductImage";
import { RecordFormDialog } from "@/components/RecordFormDialog";
import type { FormField } from "@/components/RecordFormFields";
import { RecordGrid } from "@/components/RecordGrid";
import { useToast } from "@/hooks/use-toast";
import { transactionTypeOptionMetadata } from "@/utils/OptionSets";
import { errorText, servicePayload, serviceResult } from "@/utils/ServicePayload";
import { toNumber } from "@/utils/RecordValues";

const transactionTypeMetadata = { OptionSet: transactionTypeOptionMetadata } as IColumn["metadata"];
const transactionColumns: IColumn[] = [
  { name: "lab_name", displayName: "Name", dataType: "SingleLine.Text", isPrimary: true, visualSizeFactor: 220 },
  { name: "lab_quantity", displayName: "Quantity", dataType: "Whole.None", visualSizeFactor: 110 },
  { name: "lab_transactiontype", displayName: "Type", dataType: "OptionSet", visualSizeFactor: 130, metadata: transactionTypeMetadata },
  { name: "lab_transactiondate", displayName: "Date", dataType: "DateAndTime.DateAndTime", visualSizeFactor: 180 },
];

const transactionFields: FormField[] = [
  { column: { name: "lab_name", displayName: "Name", dataType: "SingleLine.Text", isPrimary: true }, required: true },
  { column: { name: "lab_quantity", displayName: "Quantity", dataType: "Whole.None" }, required: true },
  { column: { name: "lab_transactiontype", displayName: "Transaction Type", dataType: "OptionSet", metadata: transactionTypeMetadata }, required: true },
];

type MovementType = "inbound" | "outbound";
const movementValues: Record<MovementType, number> = { inbound: 100000000, outbound: 100000001 };

export default function WarehouseItemDetailPage() {
  const { id } = useParams<{ id: string }>();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [movementType, setMovementType] = useState<MovementType>("outbound");
  const [transactionError, setTransactionError] = useState<string>();

  const itemQuery = useQuery({
    queryKey: ["warehouseItem", id],
    queryFn: async () => {
      const result = await serviceResult(Lab_warehouseitemsService.get(id!));
      return result.data;
    },
    enabled: !!id,
  });
  const item = itemQuery.data;
  const linkedProductId = item?._lab_productid_value;
  const linkedProductQuery = useQuery({
    queryKey: ["linkedProduct", linkedProductId],
    queryFn: async () => {
      const result = await serviceResult(Lab_productsService.get(linkedProductId!));
      return result.data;
    },
    enabled: !!linkedProductId,
  });

  const transactionsQuery = useQuery({
    queryKey: ["itemTransactions", id],
    queryFn: async () => {
      const result = await serviceResult(Lab_warehousetransactionsService.getAll({
        select: ["lab_warehousetransactionid", "lab_name", "lab_quantity", "lab_transactiontype", "lab_transactiondate"],
        filter: `_lab_itemid_value eq '${id}'`,
        orderBy: ["lab_transactiondate desc"],
      }));
      return result.data ?? [];
    },
    enabled: !!id,
  });

  const rows = useMemo(
    () => transactionsQuery.data?.map((transaction: Lab_warehousetransactions) => ({
      ...transaction,
      lab_quantity: toNumber(transaction.lab_quantity),
      lab_transactiontype: toNumber(transaction.lab_transactiontype),
    })),
    [transactionsQuery.data]
  );
  const transactionDefaults = useMemo(
    () => ({ lab_transactiontype: movementValues[movementType] }),
    [movementType]
  );

  const createMutation = useMutation({
    mutationFn: async (values: Record<string, unknown>) => serviceResult(Lab_warehousetransactionsService.create(servicePayload({
      lab_name: values.lab_name,
      lab_quantity: String(values.lab_quantity),
      lab_transactiontype: Number(values.lab_transactiontype),
      lab_transactiondate: new Date().toISOString(),
      "lab_itemid@odata.bind": `/lab_warehouseitems(${id})`,
    }))),
    onSuccess: async () => {
      setTransactionError(undefined);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["warehouseItem", id] }),
        queryClient.invalidateQueries({ queryKey: ["itemTransactions", id] }),
        queryClient.invalidateQueries({ queryKey: ["warehouseItems"] }),
        queryClient.invalidateQueries({ queryKey: ["allTransactions"] }),
        queryClient.invalidateQueries({ queryKey: ["itemsByLocation"] }),
      ]);
      toast.success("Transaction recorded successfully");
    },
    onError: (error) => setTransactionError(errorText(error)),
  });

  const openMovement = (type: MovementType) => {
    setMovementType(type);
    setTransactionError(undefined);
    setDialogOpen(true);
  };

  if (itemQuery.isLoading) return <Spinner label="Loading item" />;
  if (itemQuery.error) return <MessageBar intent="error"><MessageBarBody>{errorText(itemQuery.error)}</MessageBarBody></MessageBar>;
  if (!item) return <MessageBar intent="error"><MessageBarBody>Warehouse item not found.</MessageBarBody></MessageBar>;

  return (
    <section>
      <header className="page-heading">
        <div>
          <Title1>{item.lab_name}</Title1>
          <p>{item.lab_sku}</p>
        </div>
        <div className="action-row">
          <Button appearance="primary" onClick={() => openMovement("outbound")}>Pick stock</Button>
          <Button onClick={() => openMovement("inbound")}>Receive stock</Button>
          <BarcodeScanDialog
            itemId={item.lab_warehouseitemid}
            currentProductId={linkedProductId}
            onLinked={() => void queryClient.invalidateQueries({ queryKey: ["warehouseItem", id] })}
          />
        </div>
      </header>

      {transactionError && <MessageBar intent="error"><MessageBarBody>{transactionError}</MessageBarBody></MessageBar>}
      {transactionsQuery.error && <MessageBar intent="error"><MessageBarBody>{errorText(transactionsQuery.error)}</MessageBarBody></MessageBar>}

      <Card className="item-summary">
        <div><Title3>Quantity on hand</Title3><strong>{item.lab_availablequantity}</strong></div>
        <div><span>Category</span><strong>{item.lab_categoryname ?? "Not set"}</strong></div>
        <div><span>Location</span><strong>{item.lab_locationidname ?? "Not set"}</strong></div>
      </Card>
      {linkedProductQuery.error && <MessageBar intent="error"><MessageBarBody>{errorText(linkedProductQuery.error)}</MessageBarBody></MessageBar>}
      {linkedProductQuery.data && (
        <Card className="item-summary">
          <LinkedProductImage productId={linkedProductQuery.data.lab_productid} />
          <div><Title3>Linked product</Title3><strong>{linkedProductQuery.data.lab_name}</strong></div>
          <div><span>EAN</span><strong>{linkedProductQuery.data.lab_ean}</strong></div>
        </Card>
      )}

      <Title3>Transactions</Title3>
      {transactionsQuery.isLoading && <Spinner label="Loading item transactions" />}
      <RecordGrid rows={rows} columns={transactionColumns} entityName="lab_warehousetransaction" />

      <RecordFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        title={movementType === "outbound" ? "Pick stock" : "Receive stock"}
        entityName="lab_warehousetransaction"
        fields={transactionFields}
        defaults={transactionDefaults}
        onCreate={(values) => createMutation.mutateAsync(values)}
        pending={createMutation.isPending}
      />
    </section>
  );
}

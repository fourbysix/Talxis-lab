import { useMemo } from "react";
import {
  Button,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
} from "@fluentui/react-components";
import { RecordForm } from "@/components/RecordForm";
import { RecordFormFields, type FormField } from "@/components/RecordFormFields";
import type { LookupRecord } from "@/components/RecordLookup";

type RecordFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  entityName: string;
  fields: FormField[];
  lookupRecords?: Record<string, LookupRecord[]>;
  defaults?: Record<string, unknown>;
  onCreate: (values: Record<string, unknown>) => Promise<unknown>;
  pending?: boolean;
};

export function RecordFormDialog({
  open,
  onOpenChange,
  title,
  entityName,
  fields,
  lookupRecords,
  defaults,
  onCreate,
  pending,
}: RecordFormDialogProps) {
  const columns = useMemo(() => fields.map((field) => field.column), [fields]);

  return (
    <Dialog open={open} onOpenChange={(_, data) => onOpenChange(data.open)}>
      <DialogSurface>
        {open && (
          <RecordForm
            entityName={entityName}
            columns={columns}
            defaults={defaults}
            onSave={onCreate}
            onSaved={() => onOpenChange(false)}
          >
            <DialogBody>
              <DialogTitle>{title}</DialogTitle>
              <DialogContent>
                <RecordFormFields fields={fields} lookupRecords={lookupRecords} />
              </DialogContent>
              <DialogActions>
                <Button type="button" appearance="secondary" onClick={() => onOpenChange(false)}>
                  Cancel
                </Button>
                <Button type="submit" appearance="primary" disabled={pending}>
                  {pending ? "Saving..." : "Save"}
                </Button>
              </DialogActions>
            </DialogBody>
          </RecordForm>
        )}
      </DialogSurface>
    </Dialog>
  );
}

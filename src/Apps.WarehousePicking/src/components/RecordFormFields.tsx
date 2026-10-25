import { Form, useField } from "@talxis/base-controls";
import type { IColumn } from "@talxis/client-libraries";
import { RequiredLevelEnum } from "@talxis/client-metadata";
import { RecordLookup, type LookupRecord } from "@/components/RecordLookup";

export type FormField = {
  column: IColumn;
  required?: boolean;
  lookupEntity?: string;
  testId?: string;
};

type RecordFormFieldsProps = {
  fields: FormField[];
  lookupRecords?: Record<string, LookupRecord[]>;
};

export function RecordFormFields({ fields, lookupRecords = {} }: RecordFormFieldsProps) {
  return (
    <Form.Section showLabel={false} showBar={false}>
      <Form.Column>
        {fields.map(({ column, required, lookupEntity, testId }) => {
          const level = required ? RequiredLevelEnum.ApplicationRequired : RequiredLevelEnum.None;
          return (
            <Form.Field key={column.name} name={column.name} requiredLevel={level}>
              <Form.Cell requiredLevel={level}>
                <div data-testid={testId ?? `field-${column.name.replace(/^[^_]+_/, "")}`}>
                  {lookupEntity ? (
                    <Form.Control
                      components={{
                        onRenderControl: () => (
                          <LookupFieldControl
                            entityName={lookupEntity}
                            records={lookupRecords[column.name] ?? []}
                            required={required}
                          />
                        ),
                      }}
                    />
                  ) : (
                    <Form.Control />
                  )}
                </div>
              </Form.Cell>
            </Form.Field>
          );
        })}
      </Form.Column>
    </Form.Section>
  );
}

function LookupFieldControl({
  entityName,
  records,
  required,
}: {
  entityName: string;
  records: LookupRecord[];
  required?: boolean;
}) {
  const field = useField();
  return (
    <RecordLookup
      entityName={entityName}
      records={records}
      value={field?.getValue() ?? ""}
      onChange={(id) => field?.setValue(id || null)}
      required={required}
    />
  );
}

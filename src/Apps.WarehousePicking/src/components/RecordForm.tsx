import { useEffect, useMemo, useRef, type FormEvent, type ReactNode } from "react";
import { Form, useForm, type IFormStrategy } from "@talxis/base-controls";
import type { IColumn } from "@talxis/client-libraries";
import { getEntity } from "@/providers/pcf-host";

type RecordFormProps = {
  entityName: string;
  columns: IColumn[];
  defaults?: Record<string, unknown>;
  onSave: (values: Record<string, unknown>) => Promise<unknown>;
  onSaved?: () => void;
  children: ReactNode;
};

export function RecordForm({ entityName, columns, defaults, onSave, onSaved, children }: RecordFormProps) {
  const entity = getEntity(entityName);
  if (!entity) throw new Error(`RecordForm: '${entityName}' isn't registered`);
  const onSaveRef = useRef(onSave);
  onSaveRef.current = onSave;

  const strategy = useMemo<IFormStrategy>(
    () => ({
      onLoad: async () => ({
        columns,
        data: { [entity.primaryIdAttribute]: crypto.randomUUID() },
        metadata: {
          PrimaryIdAttribute: entity.primaryIdAttribute,
          PrimaryNameAttribute: entity.primaryNameAttribute,
        },
      }),
      onSave: async ({ recordId, updatedData }) => {
        try {
          await onSaveRef.current(updatedData);
          return { recordId, success: true, fields: [] };
        } catch {
          return { recordId, success: false, fields: [] };
        }
      },
    }),
    [columns, entity]
  );

  return (
    <Form.Root strategy={strategy} onAfterSave={({ success }) => success && onSaved?.()}>
      <FormBody defaults={defaults}>{children}</FormBody>
    </Form.Root>
  );
}

function FormBody({ children, defaults }: { children: ReactNode; defaults?: Record<string, unknown> }) {
  const form = useForm();

  useEffect(() => {
    for (const [name, value] of Object.entries(defaults ?? {})) {
      if (value !== undefined && value !== "") form.getField(name).setValue(value);
    }
  }, [defaults, form]);

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    (document.activeElement as HTMLElement | null)?.blur?.();
    setTimeout(() => void form.save(), 0);
  };

  return <form onSubmit={onSubmit}>{children}</form>;
}

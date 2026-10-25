import { useMemo } from "react";
import { Lookup, usePcfContext, type ILookupProperty } from "@talxis/base-controls";
import { getEntity } from "@/providers/pcf-host";

export type LookupRecord = { id: string; name: string };

type RecordLookupProps = {
  entityName: string;
  records: LookupRecord[];
  value: string;
  onChange: (id: string) => void;
  required?: boolean;
};

const noViews = async () => [];

export function RecordLookup({ entityName, records, value, onChange, required }: RecordLookupProps) {
  const context = usePcfContext();
  const displayName = getEntity(entityName)?.displayName ?? entityName;
  const selected = records.find((record) => record.id === value);
  const attributes = useMemo(() => ({ Targets: [entityName], DisplayName: displayName }), [entityName, displayName]);
  const lookupValue: ILookupProperty = {
    raw: selected ? [{ entityType: entityName, id: selected.id, name: selected.name }] : [],
    attributes,
    getAllViews: noViews,
  };

  return (
    <Lookup
      context={context}
      parameters={{
        value: lookupValue,
        IsInlineNewEnabled: { raw: false },
        EnableNavigation: { raw: false },
      }}
      onSearch={async (_entityNames, query) => {
        const text = (query ?? "").toLowerCase();
        return records
          .filter((record) => record.name.toLowerCase().includes(text))
          .slice(0, 25)
          .map((record) => ({ entityType: entityName, id: record.id, name: record.name }));
      }}
      onNotifyOutputChanged={(outputs) => onChange(outputs.value?.[0]?.id ?? "")}
      onOverrideComponentProps={(props) => ({
        ...props,
        inputProps: { ...props.inputProps, "aria-required": required || undefined },
        pickerCalloutProps: { ...props.pickerCalloutProps, hidden: !!selected },
      })}
    />
  );
}

import { useEffect, useState } from "react";
import { Grid, usePcfContext } from "@talxis/base-controls";
import { Dataset, MemoryDataProvider, type IColumn, type IRawRecord } from "@talxis/client-libraries";
import { getEntity } from "@/providers/pcf-host";

type RecordGridProps = {
  rows: IRawRecord[] | undefined;
  columns: IColumn[];
  entityName: string;
};

export function RecordGrid({ rows, columns, entityName }: RecordGridProps) {
  const context = usePcfContext();
  const entity = getEntity(entityName);
  if (!entity) throw new Error(`RecordGrid: '${entityName}' isn't registered`);

  const [dataset] = useState(() => {
    const metadata = {
      LogicalName: entity.logicalName,
      PrimaryIdAttribute: entity.primaryIdAttribute,
      PrimaryNameAttribute: entity.primaryNameAttribute,
    };
    const data = new Dataset(new MemoryDataProvider({ dataSource: [], metadata }));
    data.setColumns(columns);
    data.setInterceptor("onOpenDatasetItem", (reference) =>
      context.navigation.openForm({ entityName: entity.logicalName, entityId: reference.id.guid })
    );
    return data;
  });

  useEffect(() => {
    if (rows) {
      dataset.setDataSource(rows);
      void dataset.refresh();
    }
  }, [dataset, rows]);

  return (
    <Grid
      context={context}
      parameters={{
        Grid: dataset,
        SelectableRows: { raw: "none" },
        EnableNavigation: { raw: !!entity.formPath },
        EnableOptionSetColors: { raw: true },
      }}
    />
  );
}

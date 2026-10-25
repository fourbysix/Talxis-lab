import { Lab_productsService } from "@/generated/services/Lab_productsService";
import type { Product } from "@/generated/models/OpenFoodFactsModel";
import { servicePayload, serviceResult } from "@/utils/ServicePayload";

export async function ensureProductRecord(ean: string, product: Product): Promise<string> {
  const existing = await serviceResult(Lab_productsService.getAll({
    select: ["lab_productid"],
    filter: `lab_ean eq '${ean}'`,
    top: 1,
  }));
  const existingId = existing.data?.[0]?.lab_productid;
  if (existingId) return existingId;

  await serviceResult(Lab_productsService.create(servicePayload({
    lab_name: product.name || ean,
    lab_ean: ean,
    lab_brand: product.brand,
    lab_quantity: product.quantity,
    lab_imageurl: product.imageUrl,
    lab_lastsyncedon: new Date().toISOString(),
  })));

  const created = await serviceResult(Lab_productsService.getAll({
    select: ["lab_productid"],
    filter: `lab_ean eq '${ean}'`,
    top: 1,
  }));
  const createdId = created.data?.[0]?.lab_productid;
  if (!createdId) throw new Error("Product was created but could not be found by its barcode");
  return createdId;
}

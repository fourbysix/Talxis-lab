import { useEffect, useState } from "react";
import { getClient } from "@microsoft/power-apps/data";
import { dataSourcesInfo } from "../../.power/schemas/appschemas/dataSourcesInfo";
import { bytesToDataUrl } from "@/utils/Binary";
import { useStyles } from "@/styles/LinkedProductImage.styles";

const client = getClient(dataSourcesInfo);

export function LinkedProductImage({ productId }: { productId: string }) {
  const styles = useStyles();
  const [imageUrl, setImageUrl] = useState<string>();

  useEffect(() => {
    let cancelled = false;
    setImageUrl(undefined);

    void client.downloadFileFromRecord("lab_products", productId, "lab_productimage").then((result) => {
      if (cancelled || !result.success || !result.data?.length) return;
      setImageUrl(bytesToDataUrl(result.data, "image/jpeg"));
    });

    return () => {
      cancelled = true;
    };
  }, [productId]);

  if (!imageUrl) return null;
  return <img src={imageUrl} alt="" className={styles.image} />;
}

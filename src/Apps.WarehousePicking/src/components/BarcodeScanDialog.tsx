import { useCallback, useEffect, useRef, useState } from "react";
import { BrowserMultiFormatReader } from "@zxing/browser";
import {
  Button,
  Card,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
  Field,
  Input,
  MessageBar,
  MessageBarBody,
  Spinner,
  Text,
} from "@fluentui/react-components";
import { BarcodeScannerRegular } from "@fluentui/react-icons";
import { getClient } from "@microsoft/power-apps/data";
import { dataSourcesInfo } from "../../.power/schemas/appschemas/dataSourcesInfo";
import { Lab_warehouseitemsService } from "@/generated/services/Lab_warehouseitemsService";
import { OpenFoodFactsService } from "@/generated/services/OpenFoodFactsService";
import type { Product } from "@/generated/models/OpenFoodFactsModel";
import { useToast } from "@/hooks/use-toast";
import { eanError } from "@/utils/Barcode";
import { bytesToDataUrl, toBytes } from "@/utils/Binary";
import { ensureProductRecord } from "@/utils/BarcodeLookup";
import { errorText, servicePayload, serviceResult } from "@/utils/ServicePayload";
import { useStyles } from "@/styles/BarcodeScanDialog.styles";

const client = getClient(dataSourcesInfo);

type BarcodeScanDialogProps = {
  itemId: string;
  currentProductId?: string;
  onLinked: () => void;
};

export function BarcodeScanDialog({ itemId, currentProductId, onLinked }: BarcodeScanDialogProps) {
  const styles = useStyles();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [barcode, setBarcode] = useState("");
  const [product, setProduct] = useState<Product>();
  const [previewImage, setPreviewImage] = useState<string>();
  const [imageBytes, setImageBytes] = useState<Uint8Array>();
  const [error, setError] = useState<string>();
  const [cameraError, setCameraError] = useState<string>();
  const [lookingUp, setLookingUp] = useState(false);
  const [linking, setLinking] = useState(false);
  const [videoElement, setVideoElement] = useState<HTMLVideoElement | null>(null);
  const scanHandled = useRef(false);
  const validationMessage = eanError(barcode);

  const lookup = useCallback(async (value: string) => {
    if (!value || eanError(value)) return;
    setLookingUp(true);
    setError(undefined);
    setProduct(undefined);
    setPreviewImage(undefined);
    setImageBytes(undefined);
    try {
      const result = await OpenFoodFactsService.GetProductByBarcode(value);
      if (!result.success || !result.data) {
        const message = result.error?.message ?? "";
        setError(/404|not found/i.test(message) ? "No product found for this barcode" : errorText(message || "Product lookup failed"));
        return;
      }

      setProduct(result.data);
      if (!result.data.imageUrl) return;

      const imageResult = await OpenFoodFactsService.GetProductImage(result.data.imageUrl);
      if (!imageResult.success || !imageResult.data) return;
      const bytes = toBytes(imageResult.data);
      if (!bytes?.length) return;
      setImageBytes(bytes);
      setPreviewImage(bytesToDataUrl(bytes, "image/jpeg"));
    } catch (lookupError) {
      setError(errorText(lookupError));
    } finally {
      setLookingUp(false);
    }
  }, []);

  useEffect(() => {
    if (!open || !videoElement) return;

    let cancelled = false;
    let controls: { stop: () => void } | undefined;
    setCameraError(undefined);
    const reader = new BrowserMultiFormatReader();
    void reader.decodeFromVideoDevice(undefined, videoElement, (result, decodeError, scannerControls) => {
      controls = scannerControls;
      if (cancelled || scanHandled.current) return;
      if (!result) {
        if (decodeError && decodeError.name !== "NotFoundException") {
          setCameraError(`Camera scan failed: ${decodeError.message}. You can still type the barcode.`);
        }
        return;
      }
      const value = result.getText();
      if (eanError(value)) return;
      scanHandled.current = true;
      setBarcode(value);
      void lookup(value);
    }).then((scannerControls) => {
      controls = scannerControls;
      if (cancelled) scannerControls.stop();
    }).catch((cameraFailure: unknown) => {
      if (!cancelled) setCameraError(`Camera unavailable: ${errorText(cameraFailure)}. You can still type the barcode.`);
    });

    return () => {
      cancelled = true;
      controls?.stop();
    };
  }, [open, videoElement, lookup]);

  const reset = () => {
    setOpen(false);
    setBarcode("");
    setProduct(undefined);
    setPreviewImage(undefined);
    setImageBytes(undefined);
    setError(undefined);
    setCameraError(undefined);
    scanHandled.current = false;
  };

  const linkProduct = async () => {
    if (!product || !barcode) return;
    setLinking(true);
    setError(undefined);
    try {
      const productId = await ensureProductRecord(barcode, product);
      await serviceResult(Lab_warehouseitemsService.update(itemId, servicePayload({
        "lab_productid@odata.bind": `/lab_products(${productId})`,
        lab_barcode: barcode,
      })));

      let imageSaveError: string | undefined;
      if (product.imageUrl) {
        if (!imageBytes?.length) {
          imageSaveError = "The product image could not be downloaded.";
        } else {
          try {
            const upload = await client.uploadFileToRecord(
              "lab_products",
              productId,
              "lab_productimage",
              `${barcode}.jpg`,
              imageBytes
            );
            if (!upload.success) imageSaveError = errorText(upload.error?.message ?? "Image upload failed");
          } catch (uploadError) {
            imageSaveError = errorText(uploadError);
          }
        }
      }

      onLinked();
      if (imageSaveError) {
        toast.error(`Product linked, but its image failed to save: ${imageSaveError}`);
      } else {
        toast.success("Product linked to item");
      }
      reset();
    } catch (linkError) {
      setError(`Failed to link product: ${errorText(linkError)}`);
    } finally {
      setLinking(false);
    }
  };

  return (
    <>
      <Button
        appearance="outline"
        icon={<BarcodeScannerRegular />}
        data-testid="scan-barcode-button"
        onClick={() => {
          scanHandled.current = false;
          setOpen(true);
        }}
      >
        {currentProductId ? "Rescan Barcode" : "Scan Barcode"}
      </Button>
      <Dialog open={open} onOpenChange={(_, data) => data.open ? setOpen(true) : reset()}>
        <DialogSurface>
          <DialogBody>
            <DialogTitle>Scan Product Barcode</DialogTitle>
            <DialogContent className={styles.content}>
              <video ref={setVideoElement} className={styles.video} muted autoPlay playsInline />
              {cameraError && <MessageBar intent="warning"><MessageBarBody>{cameraError}</MessageBarBody></MessageBar>}
              <Field
                label="EAN / UPC barcode"
                validationState={validationMessage ? "error" : "none"}
                validationMessage={validationMessage}
              >
                <div className={styles.barcodeRow}>
                  <Input
                    className={styles.barcodeInput}
                    value={barcode}
                    placeholder="e.g. 3017620422003"
                    data-testid="scan-ean-input"
                    onChange={(_, data) => {
                      setBarcode(data.value);
                      setError(undefined);
                    }}
                  />
                  <Button
                    appearance="primary"
                    data-testid="scan-lookup-button"
                    disabled={!barcode || !!validationMessage || lookingUp}
                    onClick={() => void lookup(barcode)}
                  >
                    {lookingUp ? <Spinner size="tiny" /> : "Look Up"}
                  </Button>
                </div>
              </Field>
              {error && <MessageBar intent="error"><MessageBarBody>{error}</MessageBarBody></MessageBar>}
              {product && (
                <Card className={styles.product}>
                  {previewImage && <img src={previewImage} alt={product.name ?? barcode} className={styles.image} />}
                  <div className={styles.productText}>
                    <Text weight="semibold" data-testid="scan-product-name">{product.name || "Unknown product"}</Text>
                    <Text size={200}>{[product.brand, product.quantity].filter(Boolean).join(" · ")}</Text>
                  </div>
                </Card>
              )}
            </DialogContent>
            <DialogActions>
              <Button appearance="secondary" onClick={reset}>Cancel</Button>
              <Button
                appearance="primary"
                data-testid="scan-link-button"
                disabled={!product || lookingUp || linking}
                onClick={() => void linkProduct()}
              >
                {linking ? <Spinner size="tiny" /> : "Link to Item"}
              </Button>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>
    </>
  );
}

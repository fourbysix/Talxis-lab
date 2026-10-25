import { makeStyles, tokens } from "@fluentui/react-components";

export const useStyles = makeStyles({
  content: {
    display: "flex",
    flexDirection: "column",
    gap: tokens.spacingVerticalL,
  },
  video: {
    width: "100%",
    aspectRatio: "16 / 9",
    backgroundColor: "black",
    borderRadius: tokens.borderRadiusMedium,
    border: `${tokens.strokeWidthThin} solid ${tokens.colorNeutralStroke2}`,
  },
  barcodeRow: {
    display: "flex",
    gap: tokens.spacingHorizontalS,
  },
  barcodeInput: {
    flex: 1,
  },
  product: {
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    gap: tokens.spacingHorizontalL,
  },
  image: {
    width: "64px",
    height: "64px",
    flexShrink: 0,
    objectFit: "contain",
    borderRadius: tokens.borderRadiusSmall,
  },
  productText: {
    display: "flex",
    flexDirection: "column",
  },
});

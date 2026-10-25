import { createBrowserRouter } from "react-router-dom";
import Layout from "@/pages/_layout";
import WarehouseItemsPage from "@/pages/WarehouseItems";
import WarehouseItemDetailPage from "@/pages/WarehouseItemDetail";
import TransactionsPage from "@/pages/Transactions";
import LocationsPage from "@/pages/Locations";
import NotFoundPage from "@/pages/not-found";
import "@/utils/Entities";
import { setHostNavigate } from "@/providers/pcf-host";

// IMPORTANT: Do not remove or modify the code below!
// Normalize basename when hosted in Power Apps
const BASENAME = new URL(".", location.href).pathname;
if (location.pathname.endsWith("/index.html")) {
  history.replaceState(null, "", BASENAME + location.search + location.hash);
}

export const router = createBrowserRouter([
  {
    path: "/",
    element: <Layout />,
    errorElement: <NotFoundPage />,
    children: [
      { index: true, element: <WarehouseItemsPage /> },
      { path: "items/:id", element: <WarehouseItemDetailPage /> },
      { path: "transactions", element: <TransactionsPage /> },
      { path: "locations", element: <LocationsPage /> },
    ],
  },
], {
  basename: BASENAME,
});

setHostNavigate((path) => router.navigate(path));

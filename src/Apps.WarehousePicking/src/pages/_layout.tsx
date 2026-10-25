import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { Tab, TabList, Title2 } from "@fluentui/react-components";

export default function Layout() {
  const location = useLocation();
  const navigate = useNavigate();
  const selected = location.pathname.startsWith("/transactions")
    ? "transactions"
    : location.pathname.startsWith("/locations")
      ? "locations"
      : "items";

  return (
    <div className="app-shell">
      <header className="app-header">
        <Title2>Warehouse Picking</Title2>
        <TabList
          selectedValue={selected}
          onTabSelect={(_, data) => navigate(`/${data.value === "items" ? "" : data.value}`)}
        >
          <Tab value="items">Items</Tab>
          <Tab value="transactions">Transactions</Tab>
          <Tab value="locations">Locations</Tab>
        </TabList>
      </header>
      <main className="app-content"><Outlet /></main>
    </div>
  );
}

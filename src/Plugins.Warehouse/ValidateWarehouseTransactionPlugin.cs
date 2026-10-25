using Microsoft.Xrm.Sdk;
using Microsoft.Xrm.Sdk.Query;
using TALXIS.DevKit.Build.Dataverse.Plugin;

namespace Plugins.Warehouse
{
    [PluginStep("Create", "lab_warehousetransaction", PluginStage.PreValidation)]
    public class ValidateWarehouseTransactionPlugin : PluginBase
    {
        public ValidateWarehouseTransactionPlugin(string unsecureConfiguration, string secureConfiguration)
        {
        }

        protected override void OnExecute()
        {
            if (!(_context.InputParameters.Contains("Target") &&
                  _context.InputParameters["Target"] is Entity target) ||
                target.LogicalName != "lab_warehousetransaction")
            {
                return;
            }

            if (!target.Contains("lab_quantity") ||
                !target.Contains("lab_itemid") ||
                !target.Contains("lab_transactiontype"))
            {
                return;
            }

            var transactionType = (OptionSetValue)target["lab_transactiontype"];
            if (transactionType.Value != 100000001)
            {
                return;
            }

            try
            {
                var quantity = (int)target["lab_quantity"];
                var itemReference = (EntityReference)target["lab_itemid"];
                var item = _organizationService.Retrieve(
                    "lab_warehouseitem",
                    itemReference.Id,
                    new ColumnSet("lab_availablequantity"));
                var available = item.Contains("lab_availablequantity")
                    ? (int)item["lab_availablequantity"]
                    : 0;

                if (quantity > available)
                {
                    throw new InvalidPluginExecutionException(
                        $"Not enough product in stock. Available: {available}, requested: {quantity}.");
                }
            }
            catch (InvalidPluginExecutionException)
            {
                throw;
            }
            catch (System.Exception exception)
            {
                _tracingService.Trace(
                    "ValidateWarehouseTransactionPlugin failed: {0}",
                    exception);
                throw;
            }
        }
    }
}

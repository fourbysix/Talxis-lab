// Custom code for this connector - implements Microsoft's "Script : ScriptBase" contract.
// Docs: https://learn.microsoft.com/en-us/connectors/custom-connectors/write-code
//
// A few things worth knowing before you write this:
// - Only ONE script file is supported per connector - branch on this.Context.OperationId
//   below if different operations need different handling.
// - Runs on .NET Standard 2.0 with a LIMITED set of namespaces available (see the doc above
//   for the full list) - notably System.Net.Http, System.Text.RegularExpressions,
//   Newtonsoft.Json(.Linq), and Microsoft.Extensions.Logging. Anything outside that list
//   won't compile when the connector is deployed, even if it compiles locally.
// - Execution must finish within 2 minutes; the compiled script can't exceed 1 MB.
// - Always call this.Context.SendAsync(...) to reach the backend - never HttpClient directly.

using System.Net.Http;
using System;
using System.Net;
using System.Threading.Tasks;
using Newtonsoft.Json.Linq;

public class Script : ScriptBase
{
    private const string UserAgent = "TALXIS-Lab-WarehousePicking/1.0 (+https://github.com/TALXIS/lab)";

    public override async Task<HttpResponseMessage> ExecuteAsync()
    {
        if (this.Context.OperationId == "GetProductByBarcode")
        {
            this.Context.Request.Headers.TryAddWithoutValidation("User-Agent", UserAgent);
            var response = await this.Context.SendAsync(this.Context.Request, this.CancellationToken)
                .ConfigureAwait(false);

            if (!response.IsSuccessStatusCode)
            {
                return response;
            }

            var body = JObject.Parse(await response.Content.ReadAsStringAsync().ConfigureAwait(false));
            if (body["status"] == null || body["status"].ToString() != "1")
            {
                return new HttpResponseMessage(HttpStatusCode.NotFound)
                {
                    Content = CreateJsonContent("{\"message\":\"No product found for this barcode\"}")
                };
            }

            var product = body["product"];
            var flattenedProduct = new JObject
            {
                ["ean"] = body["code"]?.ToString() ?? "",
                ["name"] = product?["product_name"]?.ToString() ?? "",
                ["brand"] = product?["brands"]?.ToString() ?? "",
                ["quantity"] = product?["quantity"]?.ToString() ?? "",
                ["imageUrl"] = product?["image_url"]?.ToString() ?? ""
            };

            response.Content = CreateJsonContent(flattenedProduct.ToString());
            return response;
        }

        if (this.Context.OperationId == "GetProductImage")
        {
            var imageUrl = GetQueryParameter(this.Context.Request.RequestUri.Query, "imageUrl");
            if (String.IsNullOrWhiteSpace(imageUrl))
            {
                return new HttpResponseMessage(HttpStatusCode.BadRequest)
                {
                    Content = CreateJsonContent("{\"message\":\"imageUrl query parameter is required\"}")
                };
            }

            Uri imageUri;
            if (!Uri.TryCreate(imageUrl, UriKind.Absolute, out imageUri)
                || imageUri.Scheme != Uri.UriSchemeHttps
                || imageUri.Host != "images.openfoodfacts.org"
                || imageUri.Port != 443)
            {
                return new HttpResponseMessage(HttpStatusCode.BadRequest)
                {
                    Content = CreateJsonContent("{\"message\":\"imageUrl must be an Open Food Facts image URL\"}")
                };
            }

            var imageRequest = new HttpRequestMessage(HttpMethod.Get, imageUri);
            imageRequest.Headers.TryAddWithoutValidation("User-Agent", UserAgent);
            return await this.Context.SendAsync(imageRequest, this.CancellationToken)
                .ConfigureAwait(false);
        }

        return new HttpResponseMessage(HttpStatusCode.BadRequest)
        {
            Content = CreateJsonContent("{\"message\":\"Unsupported operation\"}")
        };
    }

    private static string GetQueryParameter(string query, string name)
    {
        foreach (var segment in query.TrimStart('?').Split('&'))
        {
            var parts = segment.Split(new[] { '=' }, 2);
            var key = Uri.UnescapeDataString(parts[0].Replace("+", " "));
            if (String.Equals(key, name, StringComparison.Ordinal))
            {
                return parts.Length == 2
                    ? Uri.UnescapeDataString(parts[1].Replace("+", " "))
                    : null;
            }
        }

        return null;
    }
}

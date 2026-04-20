using System.Net;
using System.Security.Cryptography.X509Certificates;

var backend = Environment.GetEnvironmentVariable("KTP_BACKEND_URL") ?? "http://127.0.0.1:8010";
var certPath = Environment.GetEnvironmentVariable("KTP_HTTPS_PFX");
var certPassword = Environment.GetEnvironmentVariable("KTP_HTTPS_PFX_PASSWORD") ?? string.Empty;
var listenUrl = Environment.GetEnvironmentVariable("KTP_HTTPS_LISTEN") ?? "https://127.0.0.1:8443";

if (string.IsNullOrWhiteSpace(certPath) || !File.Exists(certPath))
{
    throw new InvalidOperationException("KTP_HTTPS_PFX must point to an existing PFX file.");
}

var certificate = new X509Certificate2(
    certPath,
    certPassword,
    X509KeyStorageFlags.Exportable | X509KeyStorageFlags.EphemeralKeySet
);

var builder = WebApplication.CreateBuilder(args);
builder.WebHost.ConfigureKestrel(options =>
{
    var uri = new Uri(listenUrl);
    options.Listen(IPAddress.Parse(uri.Host), uri.Port, listen =>
    {
        listen.UseHttps(certificate);
    });
});

builder.Services.AddHttpClient("proxy").ConfigurePrimaryHttpMessageHandler(() => new SocketsHttpHandler
{
    UseCookies = false,
    AllowAutoRedirect = false,
    AutomaticDecompression = DecompressionMethods.All,
});

var app = builder.Build();
var httpClientFactory = app.Services.GetRequiredService<IHttpClientFactory>();

app.Map("/{**path}", async context =>
{
    var client = httpClientFactory.CreateClient("proxy");
    var target = backend.TrimEnd('/') + context.Request.Path + context.Request.QueryString;
    using var message = new HttpRequestMessage(new HttpMethod(context.Request.Method), target);

    foreach (var header in context.Request.Headers)
    {
        if (!message.Headers.TryAddWithoutValidation(header.Key, header.Value.ToArray()))
        {
            message.Content ??= new StreamContent(context.Request.Body);
            message.Content.Headers.TryAddWithoutValidation(header.Key, header.Value.ToArray());
        }
    }

    if (context.Request.ContentLength > 0 || context.Request.Headers.ContainsKey("Transfer-Encoding"))
    {
        message.Content = new StreamContent(context.Request.Body);
        foreach (var header in context.Request.Headers)
        {
            message.Content.Headers.TryAddWithoutValidation(header.Key, header.Value.ToArray());
        }
    }

    using var response = await client.SendAsync(message, HttpCompletionOption.ResponseHeadersRead, context.RequestAborted);
    context.Response.StatusCode = (int)response.StatusCode;

    foreach (var header in response.Headers)
    {
        context.Response.Headers[header.Key] = header.Value.ToArray();
    }

    foreach (var header in response.Content.Headers)
    {
        context.Response.Headers[header.Key] = header.Value.ToArray();
    }

    context.Response.Headers.Remove("transfer-encoding");
    await response.Content.CopyToAsync(context.Response.Body);
});

await app.RunAsync();

using System.Text.Json;
using KeyTrialPro.Sdk;

const string softwareName = "测试微信支付3";
const string productId = "testp3";
const string serverUrl = "https://key.462030.xyz";
const string appKey = "05eabfa0d3d5dfcb5a11829da9cebde2";
const string defaultCardKey = "5436-SKDB-E6NP-EWRR";
const string certPin = "29db02907c53989a408e70270d65d001a7e2e3ecf779287c9f46f4eedfdb9026";

var cardKey = args.Length > 0
    ? args[0]
    : Environment.GetEnvironmentVariable("KTP_TEST_CARD_KEY") ?? defaultCardKey;

Environment.SetEnvironmentVariable("KTP_TEST_FINGERPRINT_MODE", "python-reference");
Environment.SetEnvironmentVariable("KTP_TEST_PRIMARY_MAC", "66:63:39:34:35:38");

var client = new KeyTrialClient(productId, serverUrl, appKey, certPin);

using var fingerprint = client.CollectFingerprint();
using var activation = client.Activate(cardKey);
using var verification = client.Verify();

var activationSuccess = ReadBool(activation.RootElement, "success");
var verificationSuccess = ReadBool(verification.RootElement, "success");
var verificationStatus = ReadNestedString(verification.RootElement, "data", "status");
var expiresAt = FirstNonEmpty(
    ReadNestedString(verification.RootElement, "data", "expiresAt"),
    ReadNestedString(activation.RootElement, "data", "expiresAt"));
var expirationState = string.IsNullOrWhiteSpace(expiresAt) ? "no_expiration" : "expires_at_utc";

var summary = new
{
    softwareName,
    productId,
    serverUrl,
    cardKey,
    testFingerprintMode = Environment.GetEnvironmentVariable("KTP_TEST_FINGERPRINT_MODE"),
    testPrimaryMac = Environment.GetEnvironmentVariable("KTP_TEST_PRIMARY_MAC"),
    machineId = ReadString(fingerprint.RootElement, "machineId"),
    activationSuccess,
    verificationSuccess,
    verificationStatus,
    expiresAt,
    expirationState,
    fingerprint = JsonSerializer.Deserialize<object>(fingerprint.RootElement.GetRawText()),
    activation = JsonSerializer.Deserialize<object>(activation.RootElement.GetRawText()),
    verification = JsonSerializer.Deserialize<object>(verification.RootElement.GetRawText()),
};

Console.WriteLine(JsonSerializer.Serialize(summary, new JsonSerializerOptions
{
    WriteIndented = true,
}));

if (!activationSuccess || !verificationSuccess || string.IsNullOrWhiteSpace(verificationStatus))
{
    Environment.ExitCode = 1;
}

static bool ReadBool(JsonElement element, string propertyName)
{
    if (element.TryGetProperty(propertyName, out var property) && property.ValueKind == JsonValueKind.True)
    {
        return true;
    }

    return false;
}

static string? ReadString(JsonElement element, string propertyName)
{
    if (!element.TryGetProperty(propertyName, out var property) || property.ValueKind != JsonValueKind.String)
    {
        return null;
    }

    return property.GetString();
}

static string? ReadNestedString(JsonElement element, string parentProperty, string childProperty)
{
    if (!element.TryGetProperty(parentProperty, out var parent) || parent.ValueKind != JsonValueKind.Object)
    {
        return null;
    }

    return ReadString(parent, childProperty);
}

static string? FirstNonEmpty(params string?[] candidates)
{
    foreach (var candidate in candidates)
    {
        if (!string.IsNullOrWhiteSpace(candidate))
        {
            return candidate;
        }
    }

    return null;
}

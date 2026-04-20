using System.Text;
using System.Text.Json;

namespace KeyTrialPro.Sdk;

public sealed class KeyTrialClient
{
    public KeyTrialClient(string productId, string serverUrl, string appKey, string certPins)
    {
        var options = new NativeMethods.KtpInitOptions
        {
            ProductId = productId,
            ServerUrl = serverUrl,
            AppKey = appKey,
            CertPins = certPins,
        };

        var status = NativeMethods.KtpInit(ref options);
        if (status != 0)
        {
            throw new InvalidOperationException(GetLastError());
        }
    }

    public JsonDocument CollectFingerprint() => CallJson(NativeMethods.KtpCollectFingerprintJson);

    public JsonDocument RequestChallenge() => CallJson(NativeMethods.KtpRequestChallengeJson);

    public JsonDocument Activate(string cardKey) => CallJson((buffer, size) => NativeMethods.KtpActivateLicenseJson(cardKey, buffer, size));

    public JsonDocument Verify() => CallJson(NativeMethods.KtpVerifyLicenseJson);

    public JsonDocument Heartbeat() => CallJson(NativeMethods.KtpHeartbeatJson);

    public JsonDocument StartTrial() => CallJson(NativeMethods.KtpStartTrialJson);

    public JsonDocument GetTrialStatus() => CallJson(NativeMethods.KtpGetTrialStatusJson);

    public JsonDocument RequestRebind(string reason) => CallJson((buffer, size) => NativeMethods.KtpRequestRebindJson(reason, buffer, size));

    public string GetLastError()
    {
        var buffer = new StringBuilder(512);
        NativeMethods.KtpGetLastError(buffer, buffer.Capacity);
        return buffer.ToString();
    }

    private static JsonDocument CallJson(Func<StringBuilder, int, int> nativeCall)
    {
        var buffer = new StringBuilder(2048);
        var status = nativeCall(buffer, buffer.Capacity);
        if (status != 0)
        {
            throw new InvalidOperationException($"Native call failed with status {status}");
        }

        return JsonDocument.Parse(buffer.ToString());
    }
}

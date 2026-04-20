using System.Runtime.InteropServices;
using System.Text;

namespace KeyTrialPro.Sdk;

internal static class NativeMethods
{
    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Ansi)]
    internal struct KtpInitOptions
    {
        public string ProductId;
        public string ServerUrl;
        public string AppKey;
        public string CertPins;
    }

    [DllImport("keytrialpro_sdk.dll", CallingConvention = CallingConvention.StdCall, CharSet = CharSet.Ansi)]
    internal static extern int KtpInit(ref KtpInitOptions options);

    [DllImport("keytrialpro_sdk.dll", CallingConvention = CallingConvention.StdCall, CharSet = CharSet.Ansi)]
    internal static extern int KtpCollectFingerprintJson(StringBuilder buffer, int bufferSize);

    [DllImport("keytrialpro_sdk.dll", CallingConvention = CallingConvention.StdCall, CharSet = CharSet.Ansi)]
    internal static extern int KtpRequestChallengeJson(StringBuilder buffer, int bufferSize);

    [DllImport("keytrialpro_sdk.dll", CallingConvention = CallingConvention.StdCall, CharSet = CharSet.Ansi)]
    internal static extern int KtpActivateLicenseJson(string cardKey, StringBuilder buffer, int bufferSize);

    [DllImport("keytrialpro_sdk.dll", CallingConvention = CallingConvention.StdCall, CharSet = CharSet.Ansi)]
    internal static extern int KtpVerifyLicenseJson(StringBuilder buffer, int bufferSize);

    [DllImport("keytrialpro_sdk.dll", CallingConvention = CallingConvention.StdCall, CharSet = CharSet.Ansi)]
    internal static extern int KtpHeartbeatJson(StringBuilder buffer, int bufferSize);

    [DllImport("keytrialpro_sdk.dll", CallingConvention = CallingConvention.StdCall, CharSet = CharSet.Ansi)]
    internal static extern int KtpStartTrialJson(StringBuilder buffer, int bufferSize);

    [DllImport("keytrialpro_sdk.dll", CallingConvention = CallingConvention.StdCall, CharSet = CharSet.Ansi)]
    internal static extern int KtpGetTrialStatusJson(StringBuilder buffer, int bufferSize);

    [DllImport("keytrialpro_sdk.dll", CallingConvention = CallingConvention.StdCall, CharSet = CharSet.Ansi)]
    internal static extern int KtpRequestRebindJson(string reason, StringBuilder buffer, int bufferSize);

    [DllImport("keytrialpro_sdk.dll", CallingConvention = CallingConvention.StdCall, CharSet = CharSet.Ansi)]
    internal static extern int KtpGetLastError(StringBuilder buffer, int bufferSize);
}


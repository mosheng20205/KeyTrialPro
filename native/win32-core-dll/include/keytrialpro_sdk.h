#ifndef KEYTRIALPRO_SDK_H
#define KEYTRIALPRO_SDK_H

#ifdef _WIN32
#  ifdef KEYTRIALPRO_SDK_EXPORTS
#    define KTP_API __declspec(dllexport)
#  else
#    define KTP_API __declspec(dllimport)
#  endif
#  define KTP_CALL __stdcall
#else
#  define KTP_API
#  define KTP_CALL
#endif

#ifdef __cplusplus
extern "C" {
#endif

typedef enum KtpStatusCode {
    KTP_STATUS_OK = 0,
    KTP_STATUS_INVALID_ARGUMENT = 1,
    KTP_STATUS_BUFFER_TOO_SMALL = 2,
    KTP_STATUS_INTERNAL_ERROR = 3
} KtpStatusCode;

typedef struct KtpInitOptions {
    const char* product_id;
    const char* server_url;
    const char* app_key;
    const char* cert_pins;
} KtpInitOptions;

typedef struct KtpRuntimeState {
    char machine_id[65];
    char last_error[256];
    int initialized;
} KtpRuntimeState;

KTP_API int KTP_CALL KtpInit(const KtpInitOptions* options);
KTP_API int KTP_CALL KtpCollectFingerprintJson(char* buffer, int buffer_size);
KTP_API int KTP_CALL KtpRequestChallengeJson(char* buffer, int buffer_size);
KTP_API int KTP_CALL KtpActivateLicenseJson(const char* card_key, char* buffer, int buffer_size);
KTP_API int KTP_CALL KtpVerifyLicenseJson(char* buffer, int buffer_size);
KTP_API int KTP_CALL KtpHeartbeatJson(char* buffer, int buffer_size);
KTP_API int KTP_CALL KtpStartTrialJson(char* buffer, int buffer_size);
KTP_API int KTP_CALL KtpGetTrialStatusJson(char* buffer, int buffer_size);
KTP_API int KTP_CALL KtpRequestRebindJson(const char* reason, char* buffer, int buffer_size);
KTP_API int KTP_CALL KtpGetLastError(char* buffer, int buffer_size);

#ifdef __cplusplus
}
#endif

#endif


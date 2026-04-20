#define NOMINMAX
#include "keytrialpro_sdk.h"

#include <windows.h>
#include <bcrypt.h>
#include <wininet.h>
#include <winhttp.h>
#include <iphlpapi.h>
#include <tlhelp32.h>
#include <winreg.h>
#include <wincrypt.h>

#include <algorithm>
#include <cctype>
#include <cwctype>
#include <cstring>
#include <ctime>
#include <sstream>
#include <string>
#include <vector>

#pragma comment(lib, "winhttp.lib")
#pragma comment(lib, "wininet.lib")
#pragma comment(lib, "iphlpapi.lib")
#pragma comment(lib, "bcrypt.lib")
#pragma comment(lib, "crypt32.lib")

namespace {

struct FingerprintContext {
    std::string cpu_serial;
    std::string system_disk_id;
    std::string baseboard_serial;
    std::string bios_version;
    std::string gpu_uuid;
    std::string primary_mac;
    std::string os_version;
    std::string boot_uptime_seconds;
    bool anti_debug = false;
    bool anti_vm = false;
    bool anti_hook = false;
    bool code_integrity_ok = true;
    bool suspicious_modules = false;
    std::string suspicious_module_names;
};

KtpRuntimeState g_state{};
HMODULE g_module_handle = nullptr;
std::string g_product_id = "unset";
std::string g_server_url = "unset";
std::string g_app_key;
std::string g_cert_pins;
std::string g_expected_text_hash;
std::string g_last_challenge_id;
std::string g_last_challenge_value;

bool http_post_json(const std::string& url, const std::string& body, std::string& response);
bool internet_post_json(const std::string& url, const std::string& body, std::string& response);
void set_error(const std::string& message);
std::string hex_encode(const std::vector<unsigned char>& bytes);
std::string sha256_hex(const std::string& data);
std::string trim_ascii(std::string value);
void CALLBACK winhttp_status_callback(HINTERNET, DWORD_PTR, DWORD, LPVOID, DWORD);

int copy_string(const std::string& value, char* buffer, int buffer_size) {
    if (buffer == nullptr || buffer_size <= 0) {
        return KTP_STATUS_INVALID_ARGUMENT;
    }

    if (static_cast<int>(value.size()) + 1 > buffer_size) {
        return KTP_STATUS_BUFFER_TOO_SMALL;
    }

    std::memset(buffer, 0, static_cast<size_t>(buffer_size));
    std::memcpy(buffer, value.c_str(), value.size());
    return KTP_STATUS_OK;
}

std::string current_error() {
    return std::string(g_state.last_error);
}

std::wstring utf8_to_wide(const std::string& value) {
    if (value.empty()) {
        return L"";
    }

    const int size = MultiByteToWideChar(CP_UTF8, 0, value.c_str(), -1, nullptr, 0);
    std::wstring wide(static_cast<size_t>(size), L'\0');
    MultiByteToWideChar(CP_UTF8, 0, value.c_str(), -1, wide.data(), size);
    if (!wide.empty() && wide.back() == L'\0') {
        wide.pop_back();
    }
    return wide;
}

std::string wide_to_utf8(const std::wstring& value) {
    if (value.empty()) {
        return "";
    }

    const int size = WideCharToMultiByte(CP_UTF8, 0, value.c_str(), -1, nullptr, 0, nullptr, nullptr);
    std::string utf8(static_cast<size_t>(size), '\0');
    WideCharToMultiByte(CP_UTF8, 0, value.c_str(), -1, utf8.data(), size, nullptr, nullptr);
    if (!utf8.empty() && utf8.back() == '\0') {
        utf8.pop_back();
    }
    return utf8;
}

std::string format_last_error(const std::string& prefix, DWORD error_code = GetLastError()) {
    LPWSTR message_buffer = nullptr;
    const DWORD size = FormatMessageW(
        FORMAT_MESSAGE_ALLOCATE_BUFFER | FORMAT_MESSAGE_FROM_SYSTEM | FORMAT_MESSAGE_IGNORE_INSERTS,
        nullptr,
        error_code,
        MAKELANGID(LANG_NEUTRAL, SUBLANG_DEFAULT),
        reinterpret_cast<LPWSTR>(&message_buffer),
        0,
        nullptr
    );

    std::string message = prefix + " (code=" + std::to_string(error_code) + ")";
    if (size > 0 && message_buffer != nullptr) {
        message += ": " + trim_ascii(wide_to_utf8(message_buffer));
        LocalFree(message_buffer);
    }
    return message;
}

std::string describe_secure_failure(DWORD flags) {
    std::vector<std::string> failures;
#ifdef WINHTTP_CALLBACK_STATUS_FLAG_CERT_REV_FAILED
    if ((flags & WINHTTP_CALLBACK_STATUS_FLAG_CERT_REV_FAILED) != 0) failures.emplace_back("cert_rev_failed");
#endif
#ifdef WINHTTP_CALLBACK_STATUS_FLAG_INVALID_CERT
    if ((flags & WINHTTP_CALLBACK_STATUS_FLAG_INVALID_CERT) != 0) failures.emplace_back("invalid_cert");
#endif
#ifdef WINHTTP_CALLBACK_STATUS_FLAG_CERT_REVOKED
    if ((flags & WINHTTP_CALLBACK_STATUS_FLAG_CERT_REVOKED) != 0) failures.emplace_back("cert_revoked");
#endif
#ifdef WINHTTP_CALLBACK_STATUS_FLAG_INVALID_CA
    if ((flags & WINHTTP_CALLBACK_STATUS_FLAG_INVALID_CA) != 0) failures.emplace_back("invalid_ca");
#endif
#ifdef WINHTTP_CALLBACK_STATUS_FLAG_CERT_CN_INVALID
    if ((flags & WINHTTP_CALLBACK_STATUS_FLAG_CERT_CN_INVALID) != 0) failures.emplace_back("cert_cn_invalid");
#endif
#ifdef WINHTTP_CALLBACK_STATUS_FLAG_CERT_DATE_INVALID
    if ((flags & WINHTTP_CALLBACK_STATUS_FLAG_CERT_DATE_INVALID) != 0) failures.emplace_back("cert_date_invalid");
#endif
#ifdef WINHTTP_CALLBACK_STATUS_FLAG_SECURITY_CHANNEL_ERROR
    if ((flags & WINHTTP_CALLBACK_STATUS_FLAG_SECURITY_CHANNEL_ERROR) != 0) failures.emplace_back("security_channel_error");
#endif

    if (failures.empty()) {
        return "unknown_secure_failure";
    }

    std::ostringstream stream;
    for (size_t index = 0; index < failures.size(); ++index) {
        if (index > 0) {
            stream << ",";
        }
        stream << failures[index];
    }
    return stream.str();
}

std::string trim_ascii(std::string value) {
    while (!value.empty() && std::isspace(static_cast<unsigned char>(value.front()))) {
        value.erase(value.begin());
    }
    while (!value.empty() && std::isspace(static_cast<unsigned char>(value.back()))) {
        value.pop_back();
    }
    return value;
}

std::string lower_ascii(std::string value) {
    std::transform(value.begin(), value.end(), value.begin(), [](unsigned char ch) {
        return static_cast<char>(std::tolower(ch));
    });
    return value;
}

std::string get_env(const char* key) {
    char buffer[512] = {0};
    const DWORD length = GetEnvironmentVariableA(key, buffer, sizeof(buffer));
    return length == 0 ? "" : std::string(buffer, buffer + length);
}

std::string read_registry_string(HKEY hive, const wchar_t* subkey, const wchar_t* value_name) {
    HKEY handle = nullptr;
    if (RegOpenKeyExW(hive, subkey, 0, KEY_READ | KEY_WOW64_64KEY, &handle) != ERROR_SUCCESS) {
        return "";
    }

    DWORD type = 0;
    DWORD size = 0;
    if (RegQueryValueExW(handle, value_name, nullptr, &type, nullptr, &size) != ERROR_SUCCESS || (type != REG_SZ && type != REG_MULTI_SZ)) {
        RegCloseKey(handle);
        return "";
    }

    std::vector<wchar_t> buffer(size / sizeof(wchar_t) + 1, L'\0');
    if (RegQueryValueExW(handle, value_name, nullptr, &type, reinterpret_cast<LPBYTE>(buffer.data()), &size) != ERROR_SUCCESS) {
        RegCloseKey(handle);
        return "";
    }

    RegCloseKey(handle);
    return wide_to_utf8(buffer.data());
}

std::string get_computer_name() {
    char name[MAX_COMPUTERNAME_LENGTH + 1] = {0};
    DWORD size = MAX_COMPUTERNAME_LENGTH + 1;
    return GetComputerNameA(name, &size) ? std::string(name, size) : "";
}

std::string get_system_drive_serial() {
    const auto system_drive = get_env("SystemDrive");
    if (system_drive.empty()) {
        return "";
    }

    DWORD serial_number = 0;
    if (!GetVolumeInformationA((system_drive + "\\").c_str(), nullptr, 0, &serial_number, nullptr, nullptr, nullptr, 0)) {
        return "";
    }

    std::ostringstream stream;
    stream << std::hex << serial_number;
    return stream.str();
}

std::string get_primary_mac() {
    ULONG size = 0;
    if (GetAdaptersInfo(nullptr, &size) != ERROR_BUFFER_OVERFLOW || size == 0) {
        return "";
    }

    std::vector<unsigned char> buffer(size);
    auto* adapter_info = reinterpret_cast<IP_ADAPTER_INFO*>(buffer.data());
    if (GetAdaptersInfo(adapter_info, &size) != NO_ERROR) {
        return "";
    }

    for (auto* current = adapter_info; current != nullptr; current = current->Next) {
        if (current->AddressLength == 0) {
            continue;
        }

        std::ostringstream stream;
        for (UINT i = 0; i < current->AddressLength; ++i) {
            if (i > 0) {
                stream << ":";
            }
            stream.width(2);
            stream.fill('0');
            stream << std::hex << static_cast<int>(current->Address[i]);
        }
        return stream.str();
    }

    return "";
}

std::string get_os_version() {
    return read_registry_string(HKEY_LOCAL_MACHINE, L"SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion", L"ProductName");
}

std::string get_bios_version() {
    auto bios = read_registry_string(HKEY_LOCAL_MACHINE, L"HARDWARE\\DESCRIPTION\\System\\BIOS", L"BIOSVersion");
    if (!bios.empty()) {
        return bios;
    }
    return read_registry_string(HKEY_LOCAL_MACHINE, L"HARDWARE\\DESCRIPTION\\System\\BIOS", L"SystemVersion");
}

std::string json_escape(const std::string& input) {
    std::string out;
    out.reserve(input.size());
    for (const char ch : input) {
        switch (ch) {
            case '\\': out += "\\\\"; break;
            case '"': out += "\\\""; break;
            case '\n': out += "\\n"; break;
            case '\r': out += "\\r"; break;
            case '\t': out += "\\t"; break;
            default: out += ch; break;
        }
    }
    return out;
}

bool detect_vm() {
    const auto bios = get_bios_version();
    auto lower = bios;
    std::transform(lower.begin(), lower.end(), lower.begin(), [](unsigned char ch) {
        return static_cast<char>(std::tolower(ch));
    });
    return lower.find("virtualbox") != std::string::npos ||
           lower.find("vmware") != std::string::npos ||
           lower.find("hyper-v") != std::string::npos;
}

std::string current_module_text_hash() {
    if (g_module_handle == nullptr) {
        return "";
    }

    const auto* base = reinterpret_cast<const unsigned char*>(g_module_handle);
    const auto* dos = reinterpret_cast<const IMAGE_DOS_HEADER*>(base);
    if (dos->e_magic != IMAGE_DOS_SIGNATURE) {
        return "";
    }

    const auto* nt = reinterpret_cast<const IMAGE_NT_HEADERS*>(base + dos->e_lfanew);
    if (nt->Signature != IMAGE_NT_SIGNATURE) {
        return "";
    }

    const auto* section = IMAGE_FIRST_SECTION(nt);
    for (unsigned short index = 0; index < nt->FileHeader.NumberOfSections; ++index, ++section) {
        const std::string name(reinterpret_cast<const char*>(section->Name), strnlen(reinterpret_cast<const char*>(section->Name), sizeof(section->Name)));
        if (name == ".text") {
            const auto* text_base = base + section->VirtualAddress;
            const size_t text_size = static_cast<size_t>(section->Misc.VirtualSize);
            return sha256_hex(std::string(reinterpret_cast<const char*>(text_base), text_size));
        }
    }

    return "";
}

bool detect_code_integrity_violation() {
    if (g_expected_text_hash.empty()) {
        return false;
    }

    return current_module_text_hash() != g_expected_text_hash;
}

bool has_inline_hook(const char* module_name, const char* proc_name) {
    const HMODULE module = GetModuleHandleA(module_name) != nullptr ? GetModuleHandleA(module_name) : LoadLibraryA(module_name);
    if (module == nullptr) {
        return false;
    }

    const auto* proc = reinterpret_cast<const unsigned char*>(GetProcAddress(module, proc_name));
    if (proc == nullptr) {
        return false;
    }

    if (proc[0] == 0xE9 || proc[0] == 0xE8 || proc[0] == 0xCC || proc[0] == 0xC3) {
        return true;
    }

    if (proc[0] == 0xFF && (proc[1] == 0x25 || proc[1] == 0x15)) {
        return true;
    }

#if defined(_M_X64)
    if (proc[0] == 0x48 && proc[1] == 0xB8) {
        return true;
    }
#endif

    return false;
}

bool detect_api_hooks() {
    return has_inline_hook("kernel32.dll", "IsDebuggerPresent") ||
           has_inline_hook("kernel32.dll", "CheckRemoteDebuggerPresent") ||
           has_inline_hook("winhttp.dll", "WinHttpSendRequest") ||
           has_inline_hook("ntdll.dll", "NtQueryInformationProcess");
}

std::string detect_suspicious_modules() {
    const HANDLE snapshot = CreateToolhelp32Snapshot(TH32CS_SNAPMODULE | TH32CS_SNAPMODULE32, GetCurrentProcessId());
    if (snapshot == INVALID_HANDLE_VALUE) {
        return "";
    }

    MODULEENTRY32W entry{};
    entry.dwSize = sizeof(entry);
    std::vector<std::string> hits;
    const std::vector<std::string> suspicious_tokens = {
        "x64dbg", "x32dbg", "ollydbg", "ida", "scylla", "frida", "easyhook", "cheatengine", "dbgcore", "titanhide"
    };

    if (Module32FirstW(snapshot, &entry)) {
        do {
            const auto lowered = lower_ascii(wide_to_utf8(entry.szModule));
            for (const auto& token : suspicious_tokens) {
                if (lowered.find(token) != std::string::npos) {
                    hits.push_back(lowered);
                    break;
                }
            }
        } while (Module32NextW(snapshot, &entry));
    }

    CloseHandle(snapshot);

    if (hits.empty()) {
        return "";
    }

    std::ostringstream stream;
    for (size_t index = 0; index < hits.size(); ++index) {
        if (index > 0) {
            stream << ",";
        }
        stream << hits[index];
    }
    return stream.str();
}

std::vector<std::string> configured_pins() {
    std::vector<std::string> pins;
    std::stringstream stream(g_cert_pins);
    std::string item;
    while (std::getline(stream, item, ',')) {
        item = lower_ascii(trim_ascii(item));
        if (!item.empty()) {
            pins.push_back(item);
        }
    }
    return pins;
}

bool verify_tls_pin(HINTERNET request) {
    const auto pins = configured_pins();
    if (pins.empty()) {
        set_error("TLS pinning requires at least one configured SHA-256 certificate pin.");
        return false;
    }

    PCCERT_CONTEXT context = nullptr;
    DWORD context_length = sizeof(context);
    if (!WinHttpQueryOption(request, WINHTTP_OPTION_SERVER_CERT_CONTEXT, &context, &context_length) || context == nullptr) {
        set_error("Unable to read the server certificate context for TLS pinning.");
        return false;
    }

    DWORD hash_length = 0;
    CertGetCertificateContextProperty(context, CERT_SHA256_HASH_PROP_ID, nullptr, &hash_length);
    std::vector<unsigned char> hash_bytes(hash_length);
    const bool ok = CertGetCertificateContextProperty(context, CERT_SHA256_HASH_PROP_ID, hash_bytes.data(), &hash_length) == TRUE;
    CertFreeCertificateContext(context);

    if (!ok) {
        set_error("Unable to compute the server certificate SHA-256 pin.");
        return false;
    }

    const auto pin = lower_ascii(hex_encode(hash_bytes));
    const bool match = std::find(pins.begin(), pins.end(), pin) != pins.end();
    if (!match) {
        set_error("TLS pin mismatch for the server certificate.");
    }
    return match;
}

bool verify_tls_pin_chain(PCCERT_CHAIN_CONTEXT chain_context) {
    const auto pins = configured_pins();
    if (pins.empty()) {
        set_error("TLS pinning requires at least one configured SHA-256 certificate pin.");
        return false;
    }

    if (chain_context == nullptr || chain_context->cChain == 0 || chain_context->rgpChain[0]->cElement == 0) {
        set_error("Unable to read the server certificate chain for TLS pinning.");
        return false;
    }

    PCCERT_CONTEXT certificate = chain_context->rgpChain[0]->rgpElement[0]->pCertContext;
    if (certificate == nullptr) {
        set_error("Unable to read the leaf certificate for TLS pinning.");
        return false;
    }

    DWORD hash_length = 0;
    CertGetCertificateContextProperty(certificate, CERT_SHA256_HASH_PROP_ID, nullptr, &hash_length);
    std::vector<unsigned char> hash_bytes(hash_length);
    if (!CertGetCertificateContextProperty(certificate, CERT_SHA256_HASH_PROP_ID, hash_bytes.data(), &hash_length)) {
        set_error("Unable to compute the server certificate SHA-256 pin.");
        return false;
    }

    const auto pin = lower_ascii(hex_encode(hash_bytes));
    const bool match = std::find(pins.begin(), pins.end(), pin) != pins.end();
    if (!match) {
        set_error("TLS pin mismatch for the server certificate.");
    }
    return match;
}

FingerprintContext collect_fingerprint() {
    FingerprintContext context;
    context.cpu_serial = get_env("PROCESSOR_IDENTIFIER");
    context.system_disk_id = get_system_drive_serial();
    context.baseboard_serial = read_registry_string(HKEY_LOCAL_MACHINE, L"SOFTWARE\\Microsoft\\Cryptography", L"MachineGuid");
    context.bios_version = get_bios_version();
    context.gpu_uuid = "";
    context.primary_mac = get_primary_mac();
    context.os_version = get_os_version();
    context.boot_uptime_seconds = std::to_string(GetTickCount64() / 1000ULL);
    BOOL remote_debugger = FALSE;
    CheckRemoteDebuggerPresent(GetCurrentProcess(), &remote_debugger);
    context.anti_debug = IsDebuggerPresent() == TRUE || remote_debugger == TRUE;
    context.anti_vm = detect_vm();
    context.anti_hook = detect_api_hooks();
    context.code_integrity_ok = !detect_code_integrity_violation();
    context.suspicious_module_names = detect_suspicious_modules();
    context.suspicious_modules = !context.suspicious_module_names.empty();
    return context;
}

std::string fingerprint_to_json(const FingerprintContext& fingerprint) {
    std::ostringstream stream;
    stream << "{"
           << "\"cpuSerial\":\"" << json_escape(fingerprint.cpu_serial) << "\","
           << "\"systemDiskId\":\"" << json_escape(fingerprint.system_disk_id) << "\","
           << "\"baseboardSerial\":\"" << json_escape(fingerprint.baseboard_serial) << "\","
           << "\"biosVersion\":\"" << json_escape(fingerprint.bios_version) << "\","
           << "\"gpuUuid\":\"" << json_escape(fingerprint.gpu_uuid) << "\","
           << "\"primaryMac\":\"" << json_escape(fingerprint.primary_mac) << "\","
           << "\"osVersion\":\"" << json_escape(fingerprint.os_version) << "\","
           << "\"bootUptimeSeconds\":\"" << json_escape(fingerprint.boot_uptime_seconds) << "\","
           << "\"antiDebug\":" << (fingerprint.anti_debug ? "true" : "false") << ","
           << "\"antiVm\":" << (fingerprint.anti_vm ? "true" : "false") << ","
           << "\"antiHook\":" << (fingerprint.anti_hook ? "true" : "false") << ","
           << "\"codeIntegrityOk\":" << (fingerprint.code_integrity_ok ? "true" : "false") << ","
           << "\"suspiciousModules\":" << (fingerprint.suspicious_modules ? "true" : "false") << ","
           << "\"suspiciousModuleNames\":\"" << json_escape(fingerprint.suspicious_module_names) << "\""
           << "}";
    return stream.str();
}

std::string make_machine_id(const FingerprintContext& fingerprint) {
    const auto raw = fingerprint.cpu_serial + "|" + fingerprint.system_disk_id + "|" + fingerprint.baseboard_serial + "|" + fingerprint.primary_mac;
    const auto digest = std::hash<std::string>{}(raw);
    std::ostringstream stream;
    stream << std::hex << digest;
    return stream.str();
}

std::string api_path(const char* relative) {
    return g_server_url + relative;
}

bool is_loopback_host(const std::wstring& host) {
    auto lowered = host;
    std::transform(lowered.begin(), lowered.end(), lowered.begin(), [](wchar_t ch) {
        return static_cast<wchar_t>(towlower(ch));
    });
    return lowered == L"127.0.0.1" || lowered == L"localhost";
}

bool is_loopback_host(const std::string& host) {
    return lower_ascii(host) == "127.0.0.1" || lower_ascii(host) == "localhost";
}

std::string hex_encode(const std::vector<unsigned char>& bytes) {
    static constexpr char kHex[] = "0123456789abcdef";
    std::string hex;
    hex.reserve(bytes.size() * 2);
    for (unsigned char byte : bytes) {
        hex.push_back(kHex[(byte >> 4) & 0x0F]);
        hex.push_back(kHex[byte & 0x0F]);
    }
    return hex;
}

std::string current_timestamp() {
    return std::to_string(static_cast<long long>(time(nullptr)));
}

std::string random_nonce() {
    unsigned char bytes[12] = {0};
    BCryptGenRandom(nullptr, bytes, sizeof(bytes), BCRYPT_USE_SYSTEM_PREFERRED_RNG);
    return hex_encode(std::vector<unsigned char>(bytes, bytes + sizeof(bytes)));
}

std::string bcrypt_digest_hex(const std::string& data, bool use_hmac, const std::string& secret = "") {
    BCRYPT_ALG_HANDLE algorithm = nullptr;
    BCRYPT_HASH_HANDLE hash = nullptr;
    DWORD object_length = 0;
    DWORD hash_length = 0;
    DWORD result = 0;
    std::vector<unsigned char> object_buffer;
    std::vector<unsigned char> hash_buffer;

    const ULONG flags = use_hmac ? BCRYPT_ALG_HANDLE_HMAC_FLAG : 0;
    if (BCryptOpenAlgorithmProvider(&algorithm, BCRYPT_SHA256_ALGORITHM, nullptr, flags) != 0) {
        return "";
    }

    if (BCryptGetProperty(algorithm, BCRYPT_OBJECT_LENGTH, reinterpret_cast<PUCHAR>(&object_length), sizeof(object_length), &result, 0) != 0 ||
        BCryptGetProperty(algorithm, BCRYPT_HASH_LENGTH, reinterpret_cast<PUCHAR>(&hash_length), sizeof(hash_length), &result, 0) != 0) {
        BCryptCloseAlgorithmProvider(algorithm, 0);
        return "";
    }

    object_buffer.resize(object_length);
    hash_buffer.resize(hash_length);

    const PUCHAR secret_buffer = use_hmac ? reinterpret_cast<PUCHAR>(const_cast<char*>(secret.data())) : nullptr;
    const ULONG secret_length = use_hmac ? static_cast<ULONG>(secret.size()) : 0;
    if (BCryptCreateHash(algorithm, &hash, object_buffer.data(), object_length, secret_buffer, secret_length, 0) != 0) {
        BCryptCloseAlgorithmProvider(algorithm, 0);
        return "";
    }

    if (BCryptHashData(hash, reinterpret_cast<PUCHAR>(const_cast<char*>(data.data())), static_cast<ULONG>(data.size()), 0) != 0 ||
        BCryptFinishHash(hash, hash_buffer.data(), hash_length, 0) != 0) {
        BCryptDestroyHash(hash);
        BCryptCloseAlgorithmProvider(algorithm, 0);
        return "";
    }

    BCryptDestroyHash(hash);
    BCryptCloseAlgorithmProvider(algorithm, 0);
    return hex_encode(hash_buffer);
}

std::string sha256_hex(const std::string& data) {
    return bcrypt_digest_hex(data, false);
}

std::string hmac_sha256_hex(const std::string& secret, const std::string& data) {
    return bcrypt_digest_hex(data, true, secret);
}

std::string normalized_fingerprint_subject(const FingerprintContext& fingerprint) {
    auto normalize = [](const std::string& value) {
        std::string lowered = value;
        std::transform(lowered.begin(), lowered.end(), lowered.begin(), [](unsigned char ch) {
            return static_cast<char>(std::tolower(ch));
        });
        return lowered;
    };

    return normalize(fingerprint.cpu_serial) + "|" +
           normalize(fingerprint.system_disk_id) + "|" +
           normalize(fingerprint.baseboard_serial) + "|" +
           normalize(fingerprint.bios_version) + "|" +
           normalize(fingerprint.gpu_uuid) + "|" +
           normalize(fingerprint.primary_mac);
}

std::string signature_subject(const FingerprintContext& fingerprint) {
    return sha256_hex(normalized_fingerprint_subject(fingerprint));
}

std::string extract_json_string(const std::string& payload, const std::string& key) {
    const auto key_token = "\"" + key + "\"";
    const auto key_pos = payload.find(key_token);
    if (key_pos == std::string::npos) {
        return "";
    }

    const auto colon_pos = payload.find(':', key_pos + key_token.size());
    if (colon_pos == std::string::npos) {
        return "";
    }

    const auto first_quote = payload.find('"', colon_pos + 1);
    if (first_quote == std::string::npos) {
        return "";
    }

    const auto second_quote = payload.find('"', first_quote + 1);
    if (second_quote == std::string::npos) {
        return "";
    }

    return payload.substr(first_quote + 1, second_quote - first_quote - 1);
}

std::string build_signed_body(const std::string& subject, const std::string& extra_fields) {
    const auto timestamp = current_timestamp();
    const auto nonce = random_nonce();
    const auto payload = g_product_id + "|" + timestamp + "|" + nonce + "|" + subject;
    const auto signature = hmac_sha256_hex(g_app_key, payload);

    std::ostringstream stream;
    stream << "{"
           << "\"productId\":\"" << json_escape(g_product_id) << "\","
           << "\"appKey\":\"" << json_escape(g_app_key) << "\","
           << "\"timestamp\":\"" << timestamp << "\","
           << "\"nonce\":\"" << nonce << "\","
           << "\"signature\":\"" << signature << "\"";

    if (!extra_fields.empty()) {
        stream << "," << extra_fields;
    }

    stream << "}";
    return stream.str();
}

bool request_challenge_internal(const FingerprintContext& fingerprint, std::string& response) {
    const auto subject = signature_subject(fingerprint);
    const auto body = build_signed_body(subject, "\"sdkVersion\":\"native-0.3\",\"machineContext\":" + fingerprint_to_json(fingerprint));
    if (!http_post_json(api_path("/api/client/challenge.php"), body, response)) {
        return false;
    }

    g_last_challenge_id = extract_json_string(response, "challengeId");
    g_last_challenge_value = extract_json_string(response, "challenge");
    return !g_last_challenge_id.empty() && !g_last_challenge_value.empty();
}

bool http_post_json(const std::string& url, const std::string& body, std::string& response) {
    URL_COMPONENTSW components{};
    components.dwStructSize = sizeof(components);
    components.dwSchemeLength = static_cast<DWORD>(-1);
    components.dwHostNameLength = static_cast<DWORD>(-1);
    components.dwUrlPathLength = static_cast<DWORD>(-1);
    components.dwExtraInfoLength = static_cast<DWORD>(-1);

    auto wide_url = utf8_to_wide(url);
    if (!WinHttpCrackUrl(wide_url.c_str(), 0, 0, reinterpret_cast<LPURL_COMPONENTS>(&components))) {
        set_error(format_last_error("Failed to parse HTTPS URL"));
        return false;
    }

    const std::wstring host(components.lpszHostName, components.dwHostNameLength);
    std::wstring path(components.lpszUrlPath, components.dwUrlPathLength);
    if (components.dwExtraInfoLength > 0) {
        path += std::wstring(components.lpszExtraInfo, components.dwExtraInfoLength);
    }

    const bool is_secure = lower_ascii(url).rfind("https://", 0) == 0;
    if (!is_secure) {
        set_error("The native SDK requires HTTPS endpoints.");
        return false;
    }

    HINTERNET session = WinHttpOpen(L"KeyTrialProNativeSdk/0.2", WINHTTP_ACCESS_TYPE_DEFAULT_PROXY, WINHTTP_NO_PROXY_NAME, WINHTTP_NO_PROXY_BYPASS, 0);
    if (session == nullptr) {
        set_error(format_last_error("WinHttpOpen failed"));
        return false;
    }

    HINTERNET connect = WinHttpConnect(session, host.c_str(), components.nPort, 0);
    if (connect == nullptr) {
        set_error(format_last_error("WinHttpConnect failed"));
        WinHttpCloseHandle(session);
        return false;
    }

    HINTERNET request = WinHttpOpenRequest(
        connect,
        L"POST",
        path.c_str(),
        nullptr,
        WINHTTP_NO_REFERER,
        WINHTTP_DEFAULT_ACCEPT_TYPES,
        is_secure ? WINHTTP_FLAG_SECURE : 0
    );

    if (request == nullptr) {
        set_error(format_last_error("WinHttpOpenRequest failed"));
        WinHttpCloseHandle(connect);
        WinHttpCloseHandle(session);
        return false;
    }

    WinHttpSetStatusCallback(
        request,
        winhttp_status_callback,
        WINHTTP_CALLBACK_FLAG_SECURE_FAILURE,
        0
    );

    if (is_loopback_host(host)) {
        DWORD security_flags =
            SECURITY_FLAG_IGNORE_UNKNOWN_CA |
            SECURITY_FLAG_IGNORE_CERT_DATE_INVALID |
            SECURITY_FLAG_IGNORE_CERT_CN_INVALID |
            SECURITY_FLAG_IGNORE_CERT_WRONG_USAGE |
#ifdef SECURITY_FLAG_IGNORE_REVOCATION
            SECURITY_FLAG_IGNORE_REVOCATION |
#endif
#ifdef SECURITY_FLAG_IGNORE_REVOCATION_OFFLINE
            SECURITY_FLAG_IGNORE_REVOCATION_OFFLINE |
#endif
            0;
        WinHttpSetOption(request, WINHTTP_OPTION_SECURITY_FLAGS, &security_flags, sizeof(security_flags));
    }

    const auto wide_headers = std::wstring(L"Content-Type: application/json\r\n");
    BOOL sent = WinHttpSendRequest(
        request,
        wide_headers.c_str(),
        static_cast<DWORD>(wide_headers.size()),
        const_cast<char*>(body.data()),
        static_cast<DWORD>(body.size()),
        static_cast<DWORD>(body.size()),
        0
    );

    if (!sent || !WinHttpReceiveResponse(request, nullptr)) {
        const DWORD secure_error = GetLastError();
        if (is_loopback_host(host) && secure_error == 12185) {
            WinHttpCloseHandle(request);
            WinHttpCloseHandle(connect);
            WinHttpCloseHandle(session);
            return internet_post_json(url, body, response);
        }
        set_error(format_last_error("HTTPS request failed during send/receive", secure_error));
        WinHttpCloseHandle(request);
        WinHttpCloseHandle(connect);
        WinHttpCloseHandle(session);
        return false;
    }

    if (!verify_tls_pin(request)) {
        WinHttpCloseHandle(request);
        WinHttpCloseHandle(connect);
        WinHttpCloseHandle(session);
        return false;
    }

    response.clear();
    DWORD available = 0;
    do {
        available = 0;
        if (!WinHttpQueryDataAvailable(request, &available) || available == 0) {
            if (GetLastError() != ERROR_SUCCESS && available == 0) {
                set_error(format_last_error("Failed to query HTTPS response data"));
            }
            break;
        }

        std::string chunk(available, '\0');
        DWORD read = 0;
        if (!WinHttpReadData(request, chunk.data(), available, &read)) {
            set_error(format_last_error("Failed to read HTTPS response body"));
            break;
        }
        chunk.resize(read);
        response += chunk;
    } while (available > 0);

    WinHttpCloseHandle(request);
    WinHttpCloseHandle(connect);
    WinHttpCloseHandle(session);
    return !response.empty();
}

bool internet_post_json(const std::string& url, const std::string& body, std::string& response) {
    URL_COMPONENTSA components{};
    char host_buffer[256] = {0};
    char path_buffer[2048] = {0};
    components.dwStructSize = sizeof(components);
    components.lpszHostName = host_buffer;
    components.dwHostNameLength = sizeof(host_buffer);
    components.lpszUrlPath = path_buffer;
    components.dwUrlPathLength = sizeof(path_buffer);

    std::vector<char> url_buffer(url.begin(), url.end());
    url_buffer.push_back('\0');
    if (!InternetCrackUrlA(url_buffer.data(), 0, 0, &components)) {
        set_error(format_last_error("Failed to parse HTTPS URL with WinINet"));
        return false;
    }

    const std::string host(components.lpszHostName, components.dwHostNameLength);
    const std::string path(components.lpszUrlPath, components.dwUrlPathLength);

    HINTERNET internet = InternetOpenA("KeyTrialProNativeSdk/0.3", INTERNET_OPEN_TYPE_DIRECT, nullptr, nullptr, 0);
    if (internet == nullptr) {
        set_error(format_last_error("InternetOpen failed"));
        return false;
    }

    HINTERNET connect = InternetConnectA(
        internet,
        host.c_str(),
        components.nPort,
        nullptr,
        nullptr,
        INTERNET_SERVICE_HTTP,
        0,
        0
    );
    if (connect == nullptr) {
        set_error(format_last_error("InternetConnect failed"));
        InternetCloseHandle(internet);
        return false;
    }

    const DWORD flags =
        INTERNET_FLAG_RELOAD |
        INTERNET_FLAG_NO_CACHE_WRITE |
        INTERNET_FLAG_SECURE |
        INTERNET_FLAG_IGNORE_CERT_CN_INVALID |
        INTERNET_FLAG_IGNORE_CERT_DATE_INVALID;

    HINTERNET request = HttpOpenRequestA(connect, "POST", path.c_str(), "HTTP/1.1", nullptr, nullptr, flags, 0);
    if (request == nullptr) {
        set_error(format_last_error("HttpOpenRequest failed"));
        InternetCloseHandle(connect);
        InternetCloseHandle(internet);
        return false;
    }

    DWORD security_flags =
        SECURITY_FLAG_IGNORE_UNKNOWN_CA |
        SECURITY_FLAG_IGNORE_CERT_CN_INVALID |
        SECURITY_FLAG_IGNORE_CERT_DATE_INVALID |
        SECURITY_FLAG_IGNORE_WRONG_USAGE;
    InternetSetOptionA(request, INTERNET_OPTION_SECURITY_FLAGS, &security_flags, sizeof(security_flags));

    const char* headers = "Content-Type: application/json\r\n";
    if (!HttpSendRequestA(request, headers, -1L, const_cast<char*>(body.data()), static_cast<DWORD>(body.size()))) {
        set_error(format_last_error("HttpSendRequest failed"));
        InternetCloseHandle(request);
        InternetCloseHandle(connect);
        InternetCloseHandle(internet);
        return false;
    }

    PCCERT_CHAIN_CONTEXT chain_context = nullptr;
    DWORD chain_length = sizeof(chain_context);
    if (!InternetQueryOptionA(request, INTERNET_OPTION_SERVER_CERT_CHAIN_CONTEXT, &chain_context, &chain_length) || chain_context == nullptr) {
        set_error(format_last_error("Failed to query server certificate chain context"));
        InternetCloseHandle(request);
        InternetCloseHandle(connect);
        InternetCloseHandle(internet);
        return false;
    }

    const bool pin_ok = verify_tls_pin_chain(chain_context);
    CertFreeCertificateChain(chain_context);
    if (!pin_ok) {
        InternetCloseHandle(request);
        InternetCloseHandle(connect);
        InternetCloseHandle(internet);
        return false;
    }

    response.clear();
    char buffer[4096];
    DWORD bytes_read = 0;
    while (InternetReadFile(request, buffer, sizeof(buffer), &bytes_read) && bytes_read > 0) {
        response.append(buffer, bytes_read);
        bytes_read = 0;
    }

    InternetCloseHandle(request);
    InternetCloseHandle(connect);
    InternetCloseHandle(internet);
    return !response.empty();
}

std::string make_payload(const std::string& status, const std::string& body) {
    std::ostringstream stream;
    stream << "{"
           << "\"status\":\"" << json_escape(status) << "\","
           << "\"productId\":\"" << json_escape(g_product_id) << "\","
           << "\"machineId\":\"" << json_escape(g_state.machine_id) << "\","
           << "\"serverUrl\":\"" << json_escape(g_server_url) << "\"";

    if (!body.empty()) {
        stream << "," << body;
    }

    stream << "}";
    return stream.str();
}

void set_error(const std::string& message) {
    std::memset(g_state.last_error, 0, sizeof(g_state.last_error));
    const size_t copy_size = std::min(message.size(), sizeof(g_state.last_error) - 1);
    std::memcpy(g_state.last_error, message.c_str(), copy_size);
}

void CALLBACK winhttp_status_callback(
    HINTERNET,
    DWORD_PTR,
    DWORD internet_status,
    LPVOID status_information,
    DWORD
) {
    if (internet_status != WINHTTP_CALLBACK_STATUS_SECURE_FAILURE || status_information == nullptr) {
        return;
    }

    const DWORD flags = *reinterpret_cast<DWORD*>(status_information);
    set_error("WinHTTP secure failure flags: " + describe_secure_failure(flags));
}

}  // namespace

int KTP_CALL KtpInit(const KtpInitOptions* options) {
    if (options == nullptr || options->product_id == nullptr || options->server_url == nullptr || options->app_key == nullptr) {
        set_error("KtpInit requires product_id, server_url, and app_key.");
        return KTP_STATUS_INVALID_ARGUMENT;
    }

    g_product_id = options->product_id;
    g_server_url = options->server_url;
    g_app_key = options->app_key;
    g_cert_pins = options->cert_pins == nullptr ? "" : options->cert_pins;
    const auto fingerprint = collect_fingerprint();
    const auto machine_id = make_machine_id(fingerprint);
    std::memset(g_state.machine_id, 0, sizeof(g_state.machine_id));
    const size_t copy_size = std::min(machine_id.size(), sizeof(g_state.machine_id) - 1);
    std::memcpy(g_state.machine_id, machine_id.c_str(), copy_size);
    g_expected_text_hash = current_module_text_hash();
    g_state.initialized = 1;
    set_error("");
    return KTP_STATUS_OK;
}

int KTP_CALL KtpCollectFingerprintJson(char* buffer, int buffer_size) {
    const auto fingerprint = collect_fingerprint();
    const auto payload = make_payload("ok", "\"fingerprint\":" + fingerprint_to_json(fingerprint));
    return copy_string(payload, buffer, buffer_size);
}

int KTP_CALL KtpRequestChallengeJson(char* buffer, int buffer_size) {
    const auto fingerprint = collect_fingerprint();
    std::string response;
    if (!request_challenge_internal(fingerprint, response)) {
        if (current_error().empty()) {
            set_error("Failed to request challenge from server.");
        }
        return KTP_STATUS_INTERNAL_ERROR;
    }
    return copy_string(response, buffer, buffer_size);
}

int KTP_CALL KtpActivateLicenseJson(const char* card_key, char* buffer, int buffer_size) {
    const auto fingerprint = collect_fingerprint();
    const std::string card = card_key == nullptr ? "" : card_key;
    std::string challenge_response;
    if (!request_challenge_internal(fingerprint, challenge_response)) {
        if (current_error().empty()) {
            set_error("Failed to refresh challenge before activation.");
        }
        return KTP_STATUS_INTERNAL_ERROR;
    }

    const auto body = build_signed_body(
        signature_subject(fingerprint),
        "\"cardKey\":\"" + json_escape(card) + "\","
        "\"sdkVersion\":\"native-0.3\","
        "\"challengeId\":\"" + json_escape(g_last_challenge_id) + "\","
        "\"challengeSignature\":\"" + sha256_hex(g_last_challenge_value + "|" + signature_subject(fingerprint)) + "\","
        "\"machineFingerprint\":" + fingerprint_to_json(fingerprint)
    );
    std::string response;
    if (!http_post_json(api_path("/api/client/activate.php"), body, response)) {
        if (current_error().empty()) {
            set_error("Failed to activate license via server.");
        }
        return KTP_STATUS_INTERNAL_ERROR;
    }
    return copy_string(response, buffer, buffer_size);
}

int KTP_CALL KtpVerifyLicenseJson(char* buffer, int buffer_size) {
    const auto fingerprint = collect_fingerprint();
    std::string challenge_response;
    if (!request_challenge_internal(fingerprint, challenge_response)) {
        if (current_error().empty()) {
            set_error("Failed to refresh challenge before verification.");
        }
        return KTP_STATUS_INTERNAL_ERROR;
    }

    const auto body = build_signed_body(
        signature_subject(fingerprint),
        "\"sdkVersion\":\"native-0.3\","
        "\"challengeId\":\"" + json_escape(g_last_challenge_id) + "\","
        "\"challengeSignature\":\"" + sha256_hex(g_last_challenge_value + "|" + signature_subject(fingerprint)) + "\","
        "\"machineFingerprint\":" + fingerprint_to_json(fingerprint)
    );
    std::string response;
    if (!http_post_json(api_path("/api/client/verify.php"), body, response)) {
        if (current_error().empty()) {
            set_error("Failed to verify license via server.");
        }
        return KTP_STATUS_INTERNAL_ERROR;
    }
    return copy_string(response, buffer, buffer_size);
}

int KTP_CALL KtpHeartbeatJson(char* buffer, int buffer_size) {
    const auto fingerprint = collect_fingerprint();
    const auto body = build_signed_body(
        signature_subject(fingerprint),
        "\"sdkVersion\":\"native-0.3\",\"machineFingerprint\":" + fingerprint_to_json(fingerprint)
    );
    std::string response;
    if (!http_post_json(api_path("/api/client/heartbeat.php"), body, response)) {
        if (current_error().empty()) {
            set_error("Failed to refresh heartbeat via server.");
        }
        return KTP_STATUS_INTERNAL_ERROR;
    }
    return copy_string(response, buffer, buffer_size);
}

int KTP_CALL KtpStartTrialJson(char* buffer, int buffer_size) {
    const auto fingerprint = collect_fingerprint();
    std::string challenge_response;
    if (!request_challenge_internal(fingerprint, challenge_response)) {
        if (current_error().empty()) {
            set_error("Failed to refresh challenge before trial start.");
        }
        return KTP_STATUS_INTERNAL_ERROR;
    }

    const auto body = build_signed_body(
        signature_subject(fingerprint),
        "\"sdkVersion\":\"native-0.3\","
        "\"challengeId\":\"" + json_escape(g_last_challenge_id) + "\","
        "\"challengeSignature\":\"" + sha256_hex(g_last_challenge_value + "|" + signature_subject(fingerprint)) + "\","
        "\"machineFingerprint\":" + fingerprint_to_json(fingerprint)
    );
    std::string response;
    if (!http_post_json(api_path("/api/client/trial_start.php"), body, response)) {
        if (current_error().empty()) {
            set_error("Failed to start trial via server.");
        }
        return KTP_STATUS_INTERNAL_ERROR;
    }
    return copy_string(response, buffer, buffer_size);
}

int KTP_CALL KtpGetTrialStatusJson(char* buffer, int buffer_size) {
    const auto fingerprint = collect_fingerprint();
    const auto body = build_signed_body(
        signature_subject(fingerprint),
        "\"machineFingerprint\":" + fingerprint_to_json(fingerprint)
    );
    std::string response;
    if (!http_post_json(api_path("/api/client/trial_status.php"), body, response)) {
        if (current_error().empty()) {
            set_error("Failed to fetch trial status from server.");
        }
        return KTP_STATUS_INTERNAL_ERROR;
    }
    return copy_string(response, buffer, buffer_size);
}

int KTP_CALL KtpRequestRebindJson(const char* reason, char* buffer, int buffer_size) {
    const auto fingerprint = collect_fingerprint();
    const std::string reason_text = reason == nullptr ? "" : reason;
    const auto body = build_signed_body(
        signature_subject(fingerprint),
        "\"machineFingerprint\":" + fingerprint_to_json(fingerprint) + ","
        "\"reason\":\"" + json_escape(reason_text) + "\","
        "\"requestedBy\":\"native-sdk\""
    );
    std::string response;
    if (!http_post_json(api_path("/api/client/rebind_request.php"), body, response)) {
        if (current_error().empty()) {
            set_error("Failed to submit rebind request.");
        }
        return KTP_STATUS_INTERNAL_ERROR;
    }
    return copy_string(response, buffer, buffer_size);
}

int KTP_CALL KtpGetLastError(char* buffer, int buffer_size) {
    return copy_string(g_state.last_error, buffer, buffer_size);
}

BOOL APIENTRY DllMain(HMODULE module, DWORD reason, LPVOID) {
    if (reason == DLL_PROCESS_ATTACH) {
        g_module_handle = module;
    }
    return TRUE;
}

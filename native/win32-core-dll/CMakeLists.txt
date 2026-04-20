cmake_minimum_required(VERSION 3.20)
project(KeyTrialProNativeSdk LANGUAGES CXX)

add_library(keytrialpro_sdk SHARED
  src/keytrialpro_sdk.cpp
)

target_compile_features(keytrialpro_sdk PRIVATE cxx_std_20)
target_include_directories(keytrialpro_sdk PUBLIC include)
target_compile_definitions(keytrialpro_sdk PRIVATE KEYTRIALPRO_SDK_EXPORTS)
target_link_libraries(keytrialpro_sdk PRIVATE winhttp wininet iphlpapi advapi32 bcrypt crypt32)

using System.Net;
using System.Security.Cryptography;
using System.Security.Cryptography.X509Certificates;

if (args.Length != 1)
{
    Console.Error.WriteLine("usage: LocalCertTool <output-directory>");
    return 1;
}

var outputDir = args[0];
Directory.CreateDirectory(outputDir);

var certPem = Path.Combine(outputDir, "localhost-cert.pem");
var keyPem = Path.Combine(outputDir, "localhost-key.pem");
var pfxPath = Path.Combine(outputDir, "localhost-dev.pfx");
var pinFile = Path.Combine(outputDir, "localhost-cert.pin.txt");
var passwordFile = Path.Combine(outputDir, "localhost-dev.pfx.password.txt");
const string pfxPassword = "keytrialpro-local-dev";

using var rsa = RSA.Create(2048);
var request = new CertificateRequest(
    "CN=localhost",
    rsa,
    HashAlgorithmName.SHA256,
    RSASignaturePadding.Pkcs1
);

var san = new SubjectAlternativeNameBuilder();
san.AddDnsName("localhost");
san.AddIpAddress(IPAddress.Loopback);
request.CertificateExtensions.Add(san.Build());
request.CertificateExtensions.Add(new X509BasicConstraintsExtension(false, false, 0, false));
request.CertificateExtensions.Add(new X509KeyUsageExtension(X509KeyUsageFlags.DigitalSignature | X509KeyUsageFlags.KeyEncipherment, false));
request.CertificateExtensions.Add(
    new X509EnhancedKeyUsageExtension(
        new OidCollection
        {
            new Oid("1.3.6.1.5.5.7.3.1")
        },
        false
    )
);
request.CertificateExtensions.Add(new X509SubjectKeyIdentifierExtension(request.PublicKey, false));

using var certificate = request.CreateSelfSigned(DateTimeOffset.UtcNow.AddDays(-1), DateTimeOffset.UtcNow.AddYears(2));
await File.WriteAllTextAsync(certPem, certificate.ExportCertificatePem());
await File.WriteAllTextAsync(keyPem, rsa.ExportPkcs8PrivateKeyPem());
await File.WriteAllBytesAsync(pfxPath, certificate.Export(X509ContentType.Pfx, pfxPassword));
await File.WriteAllTextAsync(passwordFile, pfxPassword);

var pin = Convert.ToHexString(SHA256.HashData(certificate.RawData)).ToLowerInvariant();
await File.WriteAllTextAsync(pinFile, pin);

Console.WriteLine(
    $$"""
    {
      "CertPem": "{{certPem.Replace("\\", "\\\\")}}",
      "KeyPem": "{{keyPem.Replace("\\", "\\\\")}}",
      "Pfx": "{{pfxPath.Replace("\\", "\\\\")}}",
      "PfxPassword": "{{pfxPassword}}",
      "PfxPasswordFile": "{{passwordFile.Replace("\\", "\\\\")}}",
      "Pin": "{{pin}}",
      "PinFile": "{{pinFile.Replace("\\", "\\\\")}}"
    }
    """
);

return 0;

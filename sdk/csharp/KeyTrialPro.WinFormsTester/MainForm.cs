using System.Net.Security;
using System.Net.Sockets;
using System.Security.Cryptography;
using System.Security.Cryptography.X509Certificates;
using System.Text;
using System.Text.Json;
using KeyTrialPro.Sdk;

namespace KeyTrialPro.WinFormsTester;

public sealed class MainForm : Form
{
    private static readonly string ConfigDirectoryPath = Path.Combine(
        Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
        "KeyTrialPro",
        "WinFormsTester");
    private static readonly string ConfigFilePath = Path.Combine(ConfigDirectoryPath, "settings.json");

    private readonly TextBox _productCodeTextBox = CreateTextBox("testp3");
    private readonly TextBox _serverUrlTextBox = CreateTextBox("https://key.462030.xyz");
    private readonly TextBox _clientAppKeyTextBox = CreateTextBox("05eabfa0d3d5dfcb5a11829da9cebde2");
    private readonly TextBox _certPinsTextBox = CreateTextBox("29db02907c53989a408e70270d65d001a7e2e3ecf779287c9f46f4eedfdb9026");
    private readonly TextBox _cardKeyTextBox = CreateTextBox("");
    private readonly TextBox _outputTextBox = new()
    {
        Multiline = true,
        ScrollBars = ScrollBars.Both,
        ReadOnly = true,
        Dock = DockStyle.Fill,
        Font = new Font("Consolas", 10F),
        WordWrap = false,
    };

    private readonly Button _fetchPinButton = CreateButton("获取 Cert Pin");
    private readonly Button _fingerprintButton = CreateButton("采集指纹");
    private readonly Button _activateButton = CreateButton("激活卡密");
    private readonly Button _verifyButton = CreateButton("验证授权");
    private readonly Button _activateAndVerifyButton = CreateButton("一键激活并验证");
    private readonly Button _saveConfigButton = CreateButton("保存配置");

    public MainForm()
    {
        Text = "KeyTrialPro WinForms Tester";
        StartPosition = FormStartPosition.CenterScreen;
        MinimumSize = new Size(980, 720);
        Size = new Size(1100, 820);

        _cardKeyTextBox.PlaceholderText = "可选：输入卡密后再点“激活卡密”";
        _productCodeTextBox.PlaceholderText = "product_code";
        _serverUrlTextBox.PlaceholderText = "https://your-server.com";
        _clientAppKeyTextBox.PlaceholderText = "client_app_key";
        _certPinsTextBox.PlaceholderText = "cert_pins，多个 pin 用英文逗号分隔";

        _fetchPinButton.Click += async (_, _) => await RunAsync(FetchCertPinAsync);
        _fingerprintButton.Click += async (_, _) => await RunAsync(CollectFingerprintAsync);
        _activateButton.Click += async (_, _) => await RunAsync(ActivateAsync);
        _verifyButton.Click += async (_, _) => await RunAsync(VerifyAsync);
        _activateAndVerifyButton.Click += async (_, _) => await RunAsync(ActivateAndVerifyAsync);
        _saveConfigButton.Click += async (_, _) => await RunAsync(SaveConfigAsync);

        LoadConfigIfPresent();

        Controls.Add(BuildLayout());
    }

    private Control BuildLayout()
    {
        var root = new TableLayoutPanel
        {
            Dock = DockStyle.Fill,
            ColumnCount = 1,
            RowCount = 3,
            Padding = new Padding(12),
        };
        root.RowStyles.Add(new RowStyle(SizeType.AutoSize));
        root.RowStyles.Add(new RowStyle(SizeType.AutoSize));
        root.RowStyles.Add(new RowStyle(SizeType.Percent, 100F));

        var inputs = new TableLayoutPanel
        {
            Dock = DockStyle.Top,
            AutoSize = true,
            ColumnCount = 2,
            RowCount = 5,
        };
        inputs.ColumnStyles.Add(new ColumnStyle(SizeType.Absolute, 130F));
        inputs.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 100F));

        AddField(inputs, 0, "product_code", _productCodeTextBox);
        AddField(inputs, 1, "server_url", _serverUrlTextBox);
        AddField(inputs, 2, "client_app_key", _clientAppKeyTextBox);
        AddField(inputs, 3, "cert_pins", _certPinsTextBox);
        AddField(inputs, 4, "card_key", _cardKeyTextBox);

        var buttons = new FlowLayoutPanel
        {
            Dock = DockStyle.Top,
            AutoSize = true,
            FlowDirection = FlowDirection.LeftToRight,
            Padding = new Padding(0, 10, 0, 10),
        };
        buttons.Controls.Add(_fetchPinButton);
        buttons.Controls.Add(_fingerprintButton);
        buttons.Controls.Add(_activateButton);
        buttons.Controls.Add(_verifyButton);
        buttons.Controls.Add(_activateAndVerifyButton);
        buttons.Controls.Add(_saveConfigButton);

        root.Controls.Add(inputs, 0, 0);
        root.Controls.Add(buttons, 0, 1);
        root.Controls.Add(_outputTextBox, 0, 2);
        return root;
    }

    private static void AddField(TableLayoutPanel panel, int row, string label, Control input)
    {
        panel.Controls.Add(new Label
        {
            Text = label,
            AutoSize = true,
            Anchor = AnchorStyles.Left,
            Margin = new Padding(0, 8, 10, 8),
        }, 0, row);

        input.Anchor = AnchorStyles.Left | AnchorStyles.Right;
        input.Margin = new Padding(0, 4, 0, 4);
        panel.Controls.Add(input, 1, row);
    }

    private async Task RunAsync(Func<Task> operation)
    {
        SetButtonsEnabled(false);
        try
        {
            await operation();
        }
        catch (Exception exception)
        {
            WriteOutput(new
            {
                success = false,
                error = exception.Message,
                detail = exception.ToString(),
            });
        }
        finally
        {
            SetButtonsEnabled(true);
        }
    }

    private void SetButtonsEnabled(bool enabled)
    {
        _fetchPinButton.Enabled = enabled;
        _fingerprintButton.Enabled = enabled;
        _activateButton.Enabled = enabled;
        _verifyButton.Enabled = enabled;
        _activateAndVerifyButton.Enabled = enabled;
        _saveConfigButton.Enabled = enabled;
    }

    private Task CollectFingerprintAsync()
    {
        var client = CreateClient();
        using var payload = client.CollectFingerprint();
        WriteJson(payload.RootElement);
        return Task.CompletedTask;
    }

    private Task ActivateAsync()
    {
        var cardKey = _cardKeyTextBox.Text.Trim();
        if (string.IsNullOrWhiteSpace(cardKey))
        {
            throw new InvalidOperationException("请先输入 card_key。");
        }

        var client = CreateClient();
        using var payload = client.Activate(cardKey);
        WriteJson(payload.RootElement);
        return Task.CompletedTask;
    }

    private Task VerifyAsync()
    {
        var client = CreateClient();
        using var payload = client.Verify();
        WriteJson(payload.RootElement);
        return Task.CompletedTask;
    }

    private Task ActivateAndVerifyAsync()
    {
        var cardKey = _cardKeyTextBox.Text.Trim();
        if (string.IsNullOrWhiteSpace(cardKey))
        {
            throw new InvalidOperationException("请先输入 card_key。");
        }

        var client = CreateClient();
        using var activation = client.Activate(cardKey);
        using var verification = client.Verify();

        WriteOutput(new
        {
            success = true,
            step = "activate_and_verify",
            activation = JsonSerializer.Deserialize<object>(activation.RootElement.GetRawText()),
            verification = JsonSerializer.Deserialize<object>(verification.RootElement.GetRawText()),
        });

        return Task.CompletedTask;
    }

    private async Task FetchCertPinAsync()
    {
        var serverUrl = ParseServerUri();
        var pin = await Task.Run(() => FetchLeafCertificatePin(serverUrl));
        _certPinsTextBox.Text = pin;
        WriteOutput(new
        {
            success = true,
            message = "已获取 cert pin。",
            serverUrl = serverUrl.ToString(),
            certPin = pin,
        });
    }

    private Task SaveConfigAsync()
    {
        var config = CaptureConfig();
        Directory.CreateDirectory(ConfigDirectoryPath);
        File.WriteAllText(
            ConfigFilePath,
            JsonSerializer.Serialize(config, new JsonSerializerOptions { WriteIndented = true }),
            Encoding.UTF8);

        WriteOutput(new
        {
            success = true,
            message = "配置已保存。",
            configFile = ConfigFilePath,
        });

        return Task.CompletedTask;
    }

    private KeyTrialClient CreateClient()
    {
        var productCode = _productCodeTextBox.Text.Trim();
        var serverUrl = _serverUrlTextBox.Text.Trim();
        var clientAppKey = _clientAppKeyTextBox.Text.Trim();
        var certPins = _certPinsTextBox.Text.Trim();

        if (string.IsNullOrWhiteSpace(productCode) ||
            string.IsNullOrWhiteSpace(serverUrl) ||
            string.IsNullOrWhiteSpace(clientAppKey) ||
            string.IsNullOrWhiteSpace(certPins))
        {
            throw new InvalidOperationException("product_code、server_url、client_app_key、cert_pins 都必须填写。");
        }

        return new KeyTrialClient(productCode, serverUrl, clientAppKey, certPins);
    }

    private Uri ParseServerUri()
    {
        if (!Uri.TryCreate(_serverUrlTextBox.Text.Trim(), UriKind.Absolute, out var uri))
        {
            throw new InvalidOperationException("server_url 格式不正确。");
        }

        if (!string.Equals(uri.Scheme, Uri.UriSchemeHttps, StringComparison.OrdinalIgnoreCase))
        {
            throw new InvalidOperationException("cert pin 只能从 HTTPS 地址获取。");
        }

        return uri;
    }

    private static string FetchLeafCertificatePin(Uri serverUri)
    {
        using var tcpClient = new TcpClient();
        tcpClient.Connect(serverUri.Host, serverUri.Port > 0 ? serverUri.Port : 443);

        using var sslStream = new SslStream(
            tcpClient.GetStream(),
            leaveInnerStreamOpen: false,
            (_, certificate, _, sslPolicyErrors) =>
                certificate is not null && sslPolicyErrors is SslPolicyErrors.None or SslPolicyErrors.RemoteCertificateChainErrors);

        sslStream.AuthenticateAsClient(serverUri.Host);
        if (sslStream.RemoteCertificate is null)
        {
            throw new InvalidOperationException("未能从服务器拿到证书。");
        }

        var certificate = new X509Certificate2(sslStream.RemoteCertificate);
        var digest = SHA256.HashData(certificate.RawData);
        return Convert.ToHexString(digest).ToLowerInvariant();
    }

    private void WriteJson(JsonElement payload)
    {
        _outputTextBox.Text = JsonSerializer.Serialize(
            JsonSerializer.Deserialize<object>(payload.GetRawText()),
            new JsonSerializerOptions { WriteIndented = true });
    }

    private void WriteOutput(object payload)
    {
        _outputTextBox.Text = JsonSerializer.Serialize(payload, new JsonSerializerOptions { WriteIndented = true });
    }

    private void LoadConfigIfPresent()
    {
        if (!File.Exists(ConfigFilePath))
        {
            return;
        }

        try
        {
            var raw = File.ReadAllText(ConfigFilePath, Encoding.UTF8);
            var config = JsonSerializer.Deserialize<LocalConfig>(raw);
            if (config is null)
            {
                return;
            }

            _productCodeTextBox.Text = config.ProductCode ?? _productCodeTextBox.Text;
            _serverUrlTextBox.Text = config.ServerUrl ?? _serverUrlTextBox.Text;
            _clientAppKeyTextBox.Text = config.ClientAppKey ?? _clientAppKeyTextBox.Text;
            _certPinsTextBox.Text = config.CertPins ?? _certPinsTextBox.Text;
            _cardKeyTextBox.Text = config.CardKey ?? _cardKeyTextBox.Text;
        }
        catch (Exception exception)
        {
            _outputTextBox.Text = JsonSerializer.Serialize(new
            {
                success = false,
                message = "本地配置加载失败。",
                configFile = ConfigFilePath,
                error = exception.Message,
            }, new JsonSerializerOptions { WriteIndented = true });
        }
    }

    private LocalConfig CaptureConfig() => new()
    {
        ProductCode = _productCodeTextBox.Text.Trim(),
        ServerUrl = _serverUrlTextBox.Text.Trim(),
        ClientAppKey = _clientAppKeyTextBox.Text.Trim(),
        CertPins = _certPinsTextBox.Text.Trim(),
        CardKey = _cardKeyTextBox.Text.Trim(),
    };

    private static TextBox CreateTextBox(string value) => new()
    {
        Text = value,
        Dock = DockStyle.Top,
    };

    private static Button CreateButton(string text) => new()
    {
        Text = text,
        AutoSize = true,
        Padding = new Padding(12, 6, 12, 6),
        Margin = new Padding(0, 0, 10, 0),
    };

    private sealed class LocalConfig
    {
        public string? ProductCode { get; init; }
        public string? ServerUrl { get; init; }
        public string? ClientAppKey { get; init; }
        public string? CertPins { get; init; }
        public string? CardKey { get; init; }
    }
}

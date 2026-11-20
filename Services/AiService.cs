using System.Net.Http.Headers;
using System.Text;

namespace Workbench.Web.Services;

/// <summary>
/// AI 代理：密钥只存在服务器（环境变量 WORKBENCH_AI_KEY 或 appsettings 的 Ai:ApiKey），
/// 前端永远拿不到密钥。
/// </summary>
public class AiService
{
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly IConfiguration _config;

    public AiService(IHttpClientFactory httpClientFactory, IConfiguration config)
    {
        _httpClientFactory = httpClientFactory;
        _config = config;
    }

    public async Task<(int Status, string Body)> ChatAsync(string requestBodyJson)
    {
        var key = _config["Ai:ApiKey"];
        if (string.IsNullOrWhiteSpace(key))
            key = Environment.GetEnvironmentVariable("WORKBENCH_AI_KEY");
        if (string.IsNullOrWhiteSpace(key))
        {
            return (503, "{\"error\":{\"message\":\"服务器未配置 AI 密钥，请在服务器环境变量中设置 WORKBENCH_AI_KEY\"}}");
        }

        var baseUrl = _config["Ai:BaseUrl"] ?? "https://open.bigmodel.cn/api/paas/v4";
        var client = _httpClientFactory.CreateClient();
        client.Timeout = TimeSpan.FromSeconds(60);

        using var request = new HttpRequestMessage(HttpMethod.Post, baseUrl.TrimEnd('/') + "/chat/completions");
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", key);
        request.Content = new StringContent(requestBodyJson, Encoding.UTF8, "application/json");

        try
        {
            using var response = await client.SendAsync(request);
            var body = await response.Content.ReadAsStringAsync();
            return ((int)response.StatusCode, body);
        }
        catch (Exception ex)
        {
            return (502, "{\"error\":{\"message\":\"AI 服务连接失败：" + ex.Message + "\"}}");
        }
    }
}
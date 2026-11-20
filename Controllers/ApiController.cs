using System.Security.Claims;
using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Workbench.Web.Data;
using Workbench.Web.Services;

namespace Workbench.Web.Controllers;

[Authorize]
[ApiController]
[Route("api")]
public class ApiController : ControllerBase
{
    private static readonly HashSet<string> AllowedModules = new()
    {
        "words", "tasks", "courses", "videos", "inbox",
        "notes", "finance", "links", "settings", "stats"
    };

    private readonly AppDb _db;
    private readonly AiService _ai;
    private readonly VideoSearchService _video;
    private readonly IHttpClientFactory _httpClientFactory;

    public ApiController(AppDb db, AiService ai, VideoSearchService video, IHttpClientFactory httpClientFactory)
    {
        _db = db;
        _ai = ai;
        _video = video;
        _httpClientFactory = httpClientFactory;
    }

    private string UserId => User.FindFirstValue(ClaimTypes.NameIdentifier) ?? "";

    [HttpGet("me")]
    public IActionResult Me()
    {
        return Ok(new
        {
            username = User.Identity?.Name ?? "",
            userId = UserId,
            serverTime = DateTimeOffset.Now
        });
    }

    /// <summary>读取当前账号所有模块的数据和版本号</summary>
    [HttpGet("data")]
    public IActionResult GetAll()
    {
        var modules = _db.GetAllModules(UserId);
        var parsed = new Dictionary<string, object?>();
        foreach (var (name, json) in modules)
        {
            try { parsed[name] = JsonSerializer.Deserialize<JsonElement>(json); }
            catch { parsed[name] = null; }
        }
        return Ok(new { modules = parsed, versions = _db.GetAllVersions(UserId) });
    }

    [HttpGet("data/{module}")]
    public IActionResult GetOne(string module)
    {
        if (!AllowedModules.Contains(module)) return NotFound();
        var modules = _db.GetAllModules(UserId);
        if (!modules.TryGetValue(module, out var json)) return NotFound();
        return Content(json, "application/json; charset=utf-8");
    }

    /// <summary>
    /// 保存一个模块。请求体：{ version: 上次读到的版本, data: 新数据 }
    /// 版本不一致说明另一台设备已经改过，返回 409 由前端让用户选择，绝不静默覆盖。
    /// </summary>
    [HttpPut("data/{module}")]
    public IActionResult Save(string module, [FromBody] JsonElement body)
    {
        if (!AllowedModules.Contains(module)) return NotFound();
        if (body.ValueKind != JsonValueKind.Object
            || !body.TryGetProperty("version", out var versionEl)
            || !body.TryGetProperty("data", out var dataEl))
            return BadRequest(new { error = "请求格式不正确，需要 version 和 data" });

        var expectedVersion = versionEl.GetInt64();
        var json = dataEl.GetRawText();
        if (json.Length > 2_000_000)
            return BadRequest(new { error = "单个模块数据过大" });

        var result = _db.SaveModule(UserId, module, json, expectedVersion);
        if (!result.Ok)
        {
            return Conflict(new
            {
                ok = false,
                conflict = true,
                version = result.Version,
                data = result.ServerJson == null ? (JsonElement?)null : JsonSerializer.Deserialize<JsonElement>(result.ServerJson),
                message = "这条数据已在另一台设备上被修改"
            });
        }

        return Ok(new
        {
            ok = true,
            version = result.Version,
            savedAt = DateTimeOffset.Now
        });
    }

    /// <summary>AI 代理：密钥只保存在服务器</summary>
    [HttpPost("ai")]
    public async Task<IActionResult> Ai()
    {
        using var reader = new StreamReader(Request.Body, Encoding.UTF8);
        var body = await reader.ReadToEndAsync();
        var (status, responseBody) = await _ai.ChatAsync(body);
        return new ContentResult
        {
            Content = responseBody,
            ContentType = "application/json; charset=utf-8",
            StatusCode = status
        };
    }

    [HttpGet("news")]
    public async Task<IActionResult> News()
    {
        try
        {
            var client = _httpClientFactory.CreateClient();
            client.Timeout = TimeSpan.FromSeconds(20);
            client.DefaultRequestHeaders.UserAgent.ParseAdd("Mozilla/5.0");

            var html = await client.GetStringAsync("https://top.baidu.com/board?tab=realtime");
            var match = System.Text.RegularExpressions.Regex.Match(
                html, "<!--s-data:(.*?)-->", System.Text.RegularExpressions.RegexOptions.Singleline);
            if (!match.Success)
                return StatusCode(502, new { error = "热点页面中没有找到数据" });

            using var doc = JsonDocument.Parse(match.Groups[1].Value);
            var items = new List<object>();
            if (doc.RootElement.TryGetProperty("data", out var data)
                && data.TryGetProperty("cards", out var cards))
            {
                foreach (var card in cards.EnumerateArray())
                {
                    if (!card.TryGetProperty("content", out var content)) continue;
                    foreach (var it in content.EnumerateArray())
                    {
                        items.Add(new
                        {
                            title = GetString(it, "query") ?? GetString(it, "word") ?? "未命名热点",
                            link = GetString(it, "rawUrl") ?? GetString(it, "appUrl") ?? "",
                            desc = GetString(it, "desc") ?? "",
                            hotScore = GetString(it, "hotScore") ?? "",
                            source = "百度实时热点",
                            category = "实时热点"
                        });
                        if (items.Count >= 30) break;
                    }
                    if (items.Count >= 30) break;
                }
            }
            return Ok(new { items });
        }
        catch (Exception ex)
        {
            return StatusCode(502, new { error = ex.Message });
        }
    }

    [HttpGet("video-search")]
    public async Task<IActionResult> VideoSearch(string? q)
    {
        var query = (q ?? "").Trim();
        if (query.Length == 0) return BadRequest(new { error = "请输入搜索关键词" });

        try
        {
            var items = await _video.SearchAsync(query);
            return Ok(new { items, verified = true });
        }
        catch (Exception ex)
        {
            return StatusCode(502, new { error = "视频搜索失败：" + ex.Message });
        }
    }

    private static string? GetString(JsonElement element, string name)
    {
        if (!element.TryGetProperty(name, out var value)) return null;
        return value.ValueKind switch
        {
            JsonValueKind.String => value.GetString(),
            JsonValueKind.Number => value.ToString(),
            _ => null
        };
    }
}

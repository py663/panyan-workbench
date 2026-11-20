using System.Net;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;

namespace Workbench.Web.Services;

/// <summary>
/// 国内学习平台真实搜索：B站、中国大学MOOC、慕课网。
/// 每条结果都会请求对应页面验证可访问，验证失败的不返回。
/// </summary>
public class VideoSearchService
{
    private readonly IHttpClientFactory _httpClientFactory;
    private static readonly Dictionary<string, (DateTime Expires, List<VideoItem> Items)> Cache = new();

    private const string DesktopUa =
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
    private const string MobileUa =
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";

    public VideoSearchService(IHttpClientFactory httpClientFactory)
    {
        _httpClientFactory = httpClientFactory;
    }

    public class VideoItem
    {
        public string Title { get; set; } = "";
        public string Teacher { get; set; } = "";
        public string Platform { get; set; } = "";
        public string Url { get; set; } = "";
        public string Reason { get; set; } = "";
        public string Source { get; set; } = "real";
        public bool Verified { get; set; }
    }

    public async Task<List<VideoItem>> SearchAsync(string query)
    {
        var key = query.Trim();
        if (Cache.TryGetValue(key, out var cached) && cached.Expires > DateTime.Now)
            return cached.Items;

        var tasks = new List<Task<List<VideoItem>>>
        {
            SearchBilibiliAsync(key),
            SearchMoocAsync(key),
            SearchImoocAsync(key)
        };

        var groups = new List<List<VideoItem>>();
        foreach (var task in tasks)
        {
            try { groups.Add(await task); }
            catch { groups.Add(new List<VideoItem>()); }
        }

        // 三个平台交错排列，避免只看得到某一个平台
        var items = new List<VideoItem>();
        for (var i = 0; i < 3; i++)
        {
            foreach (var group in groups)
            {
                if (group.Count > i) items.Add(group[i]);
            }
        }

        Cache[key] = (DateTime.Now.AddMinutes(10), items);
        return items;
    }

    // ---------------- B站 ----------------

    private async Task<List<VideoItem>> SearchBilibiliAsync(string query)
    {
        var client = _httpClientFactory.CreateClient();
        client.Timeout = TimeSpan.FromSeconds(20);
        client.DefaultRequestHeaders.UserAgent.ParseAdd(DesktopUa);
        client.DefaultRequestHeaders.Referrer = new Uri("https://www.bilibili.com/");

        var url = "https://search.bilibili.com/all?keyword=" + Uri.EscapeDataString(query);
        var html = await client.GetStringAsync(url);

        var items = new List<VideoItem>();
        var seen = new HashSet<string>();
        var chunks = html.Split("<div class=\"bili-video-card\"");
        for (var i = 1; i < chunks.Length && items.Count < 8; i++)
        {
            var chunk = chunks[i];
            var link = Regex.Match(chunk, "href=\"//www\\.bilibili\\.com/video/(BV[0-9A-Za-z]+)/?\"");
            var title = Regex.Match(chunk, "<img[^>]+alt=\"([^\"]+)\"");
            if (!link.Success || !title.Success) continue;
            var bvid = link.Groups[1].Value;
            if (!seen.Add(bvid)) continue;

            var author = Regex.Match(chunk, "bili-video-card__info--author\"[^>]*>(.*?)</span>", RegexOptions.Singleline);
            items.Add(new VideoItem
            {
                Title = WebUtility.HtmlDecode(title.Groups[1].Value).Trim(),
                Teacher = author.Success
                    ? WebUtility.HtmlDecode(Regex.Replace(author.Groups[1].Value, "<[^>]+>", "")).Trim()
                    : "B站UP主",
                Platform = "B站",
                Url = $"https://www.bilibili.com/video/{bvid}/",
                Reason = "来自B站真实搜索结果，视频页面已验证可访问"
            });
        }

        var verified = new List<VideoItem>();
        foreach (var item in items)
        {
            if (await VerifyPageAsync(item.Url, item.Title, requireTitle: false))
            {
                item.Verified = true;
                verified.Add(item);
            }
            if (verified.Count >= 3) break;
        }
        return verified;
    }

    // ---------------- 中国大学MOOC ----------------

    private async Task<List<VideoItem>> SearchMoocAsync(string query)
    {
        var handler = new HttpClientHandler { CookieContainer = new CookieContainer(), UseCookies = true };
        using var client = new HttpClient(handler) { Timeout = TimeSpan.FromSeconds(25) };
        client.DefaultRequestHeaders.UserAgent.ParseAdd(MobileUa);

        var referer = "https://www.icourse163.org/search.htm?search=" + Uri.EscapeDataString(query);
        await client.GetStringAsync(referer);

        var csrf = handler.CookieContainer.GetCookies(new Uri("https://www.icourse163.org"))
            .Cast<Cookie>()
            .FirstOrDefault(c => c.Name == "NTESSTUDYSI")?.Value ?? "";

        var api = "https://www.icourse163.org/web/j/mocSearchBean.searchCourse.rpc?csrfKey=" + Uri.EscapeDataString(csrf);
        var queryVo = JsonSerializer.Serialize(new
        {
            keyword = query,
            pageIndex = 1,
            highlight = true,
            orderBy = 0,
            stats = 30,
            pageSize = 20
        });
        var form = new FormUrlEncodedContent(new Dictionary<string, string>
        {
            ["mocCourseQueryVo"] = queryVo
        });
        form.Headers.ContentType = new MediaTypeHeaderValue("application/x-www-form-urlencoded") { CharSet = "utf-8" };

        using var request = new HttpRequestMessage(HttpMethod.Post, api) { Content = form };
        request.Headers.Referrer = new Uri(referer);
        var response = await client.SendAsync(request);
        var json = await response.Content.ReadAsStringAsync();

        var items = new List<VideoItem>();
        using var doc = JsonDocument.Parse(json);
        if (!doc.RootElement.TryGetProperty("result", out var result)) return items;
        if (!result.TryGetProperty("list", out var list)) return items;

        foreach (var entry in list.EnumerateArray())
        {
            if (!entry.TryGetProperty("mocCourseCard", out var wrap)) continue;
            if (!wrap.TryGetProperty("mocCourseCardDto", out var card)) continue;
            if (!card.TryGetProperty("name", out var nameEl) || !card.TryGetProperty("id", out var idEl)) continue;
            if (!card.TryGetProperty("schoolPanel", out var school)) continue;
            if (!school.TryGetProperty("shortName", out var shortName)) continue;

            var teacher = "";
            if (card.TryGetProperty("termPanel", out var term)
                && term.TryGetProperty("lectorPanels", out var lectors))
            {
                var names = new List<string>();
                foreach (var lector in lectors.EnumerateArray())
                {
                    if (lector.TryGetProperty("realName", out var realName) && realName.GetString() is { Length: > 0 } n)
                        names.Add(n);
                }
                teacher = string.Join("、", names);
            }
            if (string.IsNullOrWhiteSpace(teacher))
                teacher = school.TryGetProperty("name", out var schoolName) ? schoolName.GetString() ?? "课程团队" : "课程团队";

            items.Add(new VideoItem
            {
                Title = nameEl.GetString() ?? "",
                Teacher = teacher,
                Platform = "中国大学MOOC",
                Url = $"https://www.icourse163.org/course/{shortName.GetString()}-{idEl.GetInt64()}",
                Reason = (school.TryGetProperty("name", out var sn) ? sn.GetString() : "国内高校") + "真实课程，课程页面已验证可访问"
            });

            if (items.Count >= 6) break;
        }

        var verified = new List<VideoItem>();
        foreach (var item in items)
        {
            if (await VerifyPageAsync(item.Url, item.Title, requireTitle: true))
            {
                item.Verified = true;
                verified.Add(item);
            }
            if (verified.Count >= 3) break;
        }
        return verified;
    }

    // ---------------- 慕课网 ----------------

    private async Task<List<VideoItem>> SearchImoocAsync(string query)
    {
        var client = _httpClientFactory.CreateClient();
        client.Timeout = TimeSpan.FromSeconds(20);
        client.DefaultRequestHeaders.UserAgent.ParseAdd(MobileUa);

        var url = "https://m.imooc.com/search/?words=" + Uri.EscapeDataString(query);
        var html = await client.GetStringAsync(url);

        var items = new List<VideoItem>();
        var seen = new HashSet<string>();
        var chunks = html.Split("<dd class=\"js-search-item\"");
        for (var i = 1; i < chunks.Length && items.Count < 6; i++)
        {
            var chunk = chunks[i];
            var anchor = Regex.Match(chunk, "<a[^>]+href=\"\\s*(//www\\.imooc\\.com/learn/\\d+)\\s*\"[^>]*>", RegexOptions.Singleline);
            if (!anchor.Success) continue;

            var tag = anchor.Value;
            var title = Regex.Match(tag, "data-title=\"([^\"]*)\"");
            if (!title.Success) continue;

            var courseUrl = "https:" + anchor.Groups[1].Value;
            if (!seen.Add(courseUrl)) continue;

            var teacher = Regex.Match(tag, "data-teacher=\"([^\"]*)\"");
            items.Add(new VideoItem
            {
                Title = string.Join(" ", WebUtility.HtmlDecode(title.Groups[1].Value).Split(' ', StringSplitOptions.RemoveEmptyEntries)),
                Teacher = teacher.Success ? WebUtility.HtmlDecode(teacher.Groups[1].Value).Trim() : "慕课网讲师",
                Platform = "慕课网",
                Url = courseUrl,
                Reason = "来自慕课网真实搜索结果，课程页面已验证可访问"
            });
        }

        var verified = new List<VideoItem>();
        foreach (var item in items)
        {
            if (await VerifyPageAsync(item.Url, item.Title, requireTitle: true))
            {
                item.Verified = true;
                verified.Add(item);
            }
            if (verified.Count >= 3) break;
        }
        return verified;
    }

    // ---------------- 通用验证 ----------------

    private async Task<bool> VerifyPageAsync(string url, string expectedTitle, bool requireTitle)
    {
        try
        {
            var client = _httpClientFactory.CreateClient();
            client.Timeout = TimeSpan.FromSeconds(15);
            client.DefaultRequestHeaders.UserAgent.ParseAdd(DesktopUa);

            using var response = await client.GetAsync(url);
            if (!response.IsSuccessStatusCode) return false;
            var html = await response.Content.ReadAsStringAsync();

            if (html.Contains("视频不见了") || html.Contains("页面不存在")) return false;
            if (!requireTitle) return true;

            var titleMatch = Regex.Match(html, "<title[^>]*>(.*?)</title>", RegexOptions.Singleline | RegexOptions.IgnoreCase);
            if (!titleMatch.Success) return false;

            static string Normalize(string s) => Regex.Replace(WebUtility.HtmlDecode(s), "\\s+", "");
            return Normalize(titleMatch.Groups[1].Value).Contains(Normalize(expectedTitle));
        }
        catch
        {
            return false;
        }
    }
}

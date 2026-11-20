using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Workbench.Web.Data;
using Workbench.Web.Services;

namespace Workbench.Web.Controllers;

/// <summary>
/// 由 ASP.NET 服务端渲染的页面：今日总览、课程表。
/// 数据直接从当前账号的数据库读取，HTML 在服务器生成。
/// </summary>
[Authorize]
public class DashboardController : Controller
{
    private readonly DeskDataService _data;
    private readonly AppDb _db;

    public DashboardController(DeskDataService data, AppDb db)
    {
        _data = data;
        _db = db;
    }

    private string UserId => User.FindFirstValue(ClaimTypes.NameIdentifier) ?? "";

    public IActionResult Index()
    {
        ViewData["Active"] = "today";
        ViewData["TopTitle"] = "今日";
        FillBadges();
        return View("Today", _data.BuildToday(UserId));
    }

    public IActionResult Timetable()
    {
        ViewData["Active"] = "homework";
        ViewData["TopTitle"] = "课程与作业";
        FillBadges();
        return View("Timetable", _data.BuildTimetable(UserId));
    }

    private void FillBadges()
    {
        var modules = _db.GetAllModules(UserId);
        ViewData["InboxCount"] = Count(modules.GetValueOrDefault("inbox"));
        ViewData["LinksCount"] = Count(modules.GetValueOrDefault("links"));
        ViewData["UserName"] = User.Identity?.Name ?? "";
    }

    private static int Count(string? json)
    {
        if (string.IsNullOrWhiteSpace(json)) return 0;
        try { using var doc = System.Text.Json.JsonDocument.Parse(json); return doc.RootElement.GetArrayLength(); }
        catch { return 0; }
    }
}

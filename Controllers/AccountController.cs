using System.Security.Claims;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Mvc;
using Workbench.Web.Data;

namespace Workbench.Web.Controllers;

public class AccountController : Controller
{
    private readonly AppDb _db;

    public AccountController(AppDb db) => _db = db;

    [HttpGet]
    public IActionResult Login(string? returnUrl = null)
    {
        if (User.Identity?.IsAuthenticated == true)
            return Redirect("/site/index.html");
        ViewData["ReturnUrl"] = SafeReturnUrl(returnUrl);
        return View();
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> Login(string username, string password, bool remember, string? returnUrl = null)
    {
        ViewData["ReturnUrl"] = SafeReturnUrl(returnUrl);
        username = (username ?? "").Trim();

        string? userId;
        try
        {
            userId = _db.ValidateUser(username, password ?? "");
        }
        catch
        {
            ViewData["Error"] = "登录失败，请稍后重试";
            ViewData["Username"] = username;
            return View();
        }
        if (userId == null)
        {
            ViewData["Error"] = "账号或密码不正确";
            ViewData["Username"] = username;
            return View();
        }

        await SignInAsync(userId, username, remember);
        return Redirect(SafeReturnUrl(returnUrl));
    }

    [HttpGet]
    public IActionResult Register() => View();

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> Register(string username, string password, string confirm)
    {
        username = (username ?? "").Trim();
        ViewData["Username"] = username;

        if (username.Length < 3 || username.Length > 32)
        {
            ViewData["Error"] = "账号长度需要 3 到 32 个字符";
            return View();
        }
        if ((password ?? "").Length < 6)
        {
            ViewData["Error"] = "密码至少 6 位";
            return View();
        }
        if (password != confirm)
        {
            ViewData["Error"] = "两次输入的密码不一致";
            return View();
        }

        var createResult = _db.CreateUser(username, password!, out var userId);
        if (createResult != AppDb.CreateUserResult.Success)
        {
            ViewData["Error"] = createResult == AppDb.CreateUserResult.Duplicate
                ? "这个账号已被注册，请换一个"
                : "注册失败，请稍后重试";
            return View();
        }

        await SignInAsync(userId, username, true);
        return Redirect("/site/index.html");
    }

    [HttpGet]
    public async Task<IActionResult> Logout()
    {
        await HttpContext.SignOutAsync(CookieAuthenticationDefaults.AuthenticationScheme);
        return RedirectToAction(nameof(Login));
    }

    private async Task SignInAsync(string userId, string username, bool remember)
    {
        var claims = new List<Claim>
        {
            new(ClaimTypes.NameIdentifier, userId),
            new(ClaimTypes.Name, username)
        };
        var identity = new ClaimsIdentity(claims, CookieAuthenticationDefaults.AuthenticationScheme);
        await HttpContext.SignInAsync(
            CookieAuthenticationDefaults.AuthenticationScheme,
            new ClaimsPrincipal(identity),
            new AuthenticationProperties
            {
                IsPersistent = remember,
                ExpiresUtc = DateTimeOffset.UtcNow.AddDays(remember ? 30 : 1)
            });
    }

    private static string SafeReturnUrl(string? returnUrl)
    {
        if (!string.IsNullOrWhiteSpace(returnUrl)
            && returnUrl.StartsWith("/")
            && !returnUrl.StartsWith("//"))
            return returnUrl;
        return "/site/index.html";
    }
}

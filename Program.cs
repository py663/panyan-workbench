using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.DataProtection;
using Workbench.Web.Data;

AppDomain.CurrentDomain.UnhandledException += (_, e) =>
{
    try
    {
        File.WriteAllText(
            Path.Combine(Path.GetTempPath(), "workbench-startup-error.txt"),
            e.ExceptionObject?.ToString() ?? "unknown");
    }
    catch { }
};

var builder = WebApplication.CreateBuilder(args);

// 托管平台通过 PORT 指定监听端口（MonsterASP 的 IIS 模式不会设置，不影响本地运行）
var port = Environment.GetEnvironmentVariable("PORT");
if (!string.IsNullOrWhiteSpace(port) && int.TryParse(port, out _))
{
    builder.WebHost.UseUrls($"http://0.0.0.0:{port}");
}

// 数据目录：优先使用环境变量 WORKBENCH_DATA_DIR，便于部署时把数据库放在持久目录，
// 重新发布程序时不会覆盖数据。未设置时回退到程序目录下的 Data。
var dataDir = Environment.GetEnvironmentVariable("WORKBENCH_DATA_DIR");
if (string.IsNullOrWhiteSpace(dataDir))
{
    dataDir = builder.Configuration["Storage:DataDir"];
}
if (string.IsNullOrWhiteSpace(dataDir))
{
    dataDir = Path.Combine(builder.Environment.ContentRootPath, "Data");
}
dataDir = Path.GetFullPath(dataDir);
Directory.CreateDirectory(dataDir);
var dbPath = Path.Combine(dataDir, "workbench.db");

// 登录票据密钥持久化：服务重启后不会把所有用户踢下线
var keysDir = Path.Combine(dataDir, "keys");
Directory.CreateDirectory(keysDir);
builder.Services.AddDataProtection().PersistKeysToFileSystem(new DirectoryInfo(keysDir));

// 数据库：线上使用 Supabase（PostgreSQL），通过环境变量 DATABASE_URL 提供连接串；
// 未设置时回退到本地 SQLite，方便在本机开发调试。
var pgUrl = Environment.GetEnvironmentVariable("DATABASE_URL");
if (string.IsNullOrWhiteSpace(pgUrl)) pgUrl = builder.Configuration["Database:Url"];
AppDb db;
if (string.IsNullOrWhiteSpace(pgUrl))
{
    db = AppDb.FromSqlite(dbPath);
}
else
{
    db = AppDb.FromPostgres(AppDb.PostgresUrlToConnectionString(pgUrl));
}
builder.Services.AddSingleton(db);
builder.Services.AddSingleton<Workbench.Web.Services.AiService>();
builder.Services.AddSingleton<Workbench.Web.Services.VideoSearchService>();
builder.Services.AddSingleton<Workbench.Web.Services.DeskDataService>();
builder.Services.AddHttpClient();

builder.Services
    .AddAuthentication(CookieAuthenticationDefaults.AuthenticationScheme)
    .AddCookie(options =>
    {
        options.LoginPath = "/Account/Login";
        options.LogoutPath = "/Account/Logout";
        options.AccessDeniedPath = "/Account/Login";
        options.Cookie.Name = "workbench.auth";
        options.Cookie.HttpOnly = true;
        options.Cookie.SameSite = SameSiteMode.Lax;
        options.Cookie.SecurePolicy = CookieSecurePolicy.SameAsRequest;
        options.ExpireTimeSpan = TimeSpan.FromDays(30);
        options.SlidingExpiration = true;
    });

builder.Services.AddControllersWithViews();

var app = builder.Build();

if (!app.Environment.IsDevelopment())
{
    app.UseExceptionHandler("/Home/Error");
}

app.UseAuthentication();

// 只保护工作台入口页面；样式、图片、脚本本身不含数据，API 另有登录校验
app.Use(async (ctx, next) =>
{
    var path = ctx.Request.Path;
    var isEntry = path.StartsWithSegments("/site", StringComparison.OrdinalIgnoreCase)
                  && (path.Value == "/site" || path.Value == "/site/"
                      || path.Value!.EndsWith("/index.html", StringComparison.OrdinalIgnoreCase));
    if (isEntry && ctx.User.Identity?.IsAuthenticated != true)
    {
        var returnUrl = "/site/index.html" + ctx.Request.QueryString;
        ctx.Response.Redirect("/Account/Login?returnUrl=" + Uri.EscapeDataString(returnUrl));
        return;
    }
    await next();
});

app.UseStaticFiles();
app.UseRouting();
app.UseAuthorization();

app.MapControllerRoute(
    name: "default",
    pattern: "{controller=Home}/{action=Index}/{id?}");

app.Run();

using Microsoft.AspNetCore.Mvc;

namespace Workbench.Web.Controllers;

public class HomeController : Controller
{
    /// <summary>首页：已登录进入工作台，未登录进入登录页</summary>
    public IActionResult Index()
    {
        if (User.Identity?.IsAuthenticated == true)
            return Redirect("/site/index.html");
        return RedirectToAction("Login", "Account");
    }

    public IActionResult Error() => View();
}

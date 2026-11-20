namespace Workbench.Web.Infrastructure;

public class NavItem
{
    public string Key { get; set; } = "";
    public string Icon { get; set; } = "";
    public string Text { get; set; } = "";
    public string Href { get; set; } = "";
    public string Badge { get; set; } = "";
}

public class NavSection
{
    public string Label { get; set; } = "";
    public List<NavItem> Items { get; set; } = new();
}

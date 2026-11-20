namespace Workbench.Web.Infrastructure;

/// <summary>与服务端页面共用的细线图标，保持与前端完全一致。</summary>
public static class Icons
{
    private const string Wrap = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.7\" stroke-linecap=\"round\" stroke-linejoin=\"round\">{0}</svg>";

    private static readonly Dictionary<string, string> Map = new()
    {
        ["today"] = "<rect x=\"3.5\" y=\"5\" width=\"17\" height=\"15\" rx=\"2\"/><path d=\"M3.5 9.5h17M8 3v4M16 3v4\"/><path d=\"M8 14h3M8 17h6\"/>",
        ["book"] = "<path d=\"M4 5.5c3-1.5 6-1.5 8 0v14c-2-1.5-5-1.5-8 0z\"/><path d=\"M20 5.5c-3-1.5-6-1.5-8 0v14c2-1.5 5-1.5 8 0z\"/><path d=\"M12 5.5v14\"/>",
        ["code"] = "<path d=\"M8 7 3 12l5 5M16 7l5 5-5 5M14 4l-4 16\"/>",
        ["school"] = "<path d=\"M3 10 12 4l9 6\"/><path d=\"M5 10v9M19 10v9M3 20h18\"/><path d=\"M9 20v-6h6v6\"/>",
        ["target"] = "<circle cx=\"12\" cy=\"12\" r=\"8.5\"/><circle cx=\"12\" cy=\"12\" r=\"4.5\"/><circle cx=\"12\" cy=\"12\" r=\"1\" fill=\"currentColor\"/>",
        ["video"] = "<rect x=\"3\" y=\"5\" width=\"18\" height=\"14\" rx=\"3\"/><path d=\"M10 9l5 3-5 3z\"/>",
        ["wallet"] = "<path d=\"M4 7h14a2 2 0 0 1 2 2v10H6a2 2 0 0 1-2-2z\"/><path d=\"M4 7V5a2 2 0 0 1 2-2h11v4\"/><path d=\"M15 13h5\"/><circle cx=\"15\" cy=\"13\" r=\".8\" fill=\"currentColor\"/>",
        ["news"] = "<path d=\"M5 4h14v16H5z\"/><path d=\"M8 8h8M8 12h8M8 16h5\"/>",
        ["inbox"] = "<path d=\"M4 9h16v10a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1z\"/><path d=\"M4 9l2-5h12l2 5\"/><path d=\"M9 13h6\"/>",
        ["search"] = "<circle cx=\"10.5\" cy=\"10.5\" r=\"6.5\"/><path d=\"M15.5 15.5 21 21\"/>",
        ["sparkles"] = "<path d=\"M12 3c.6 4.5 2.5 6.4 7 7-4.5.6-6.4 2.5-7 7-.6-4.5-2.5-6.4-7-7 4.5-.6 6.4-2.5 7-7z\"/><path d=\"M19 16c.3 2 1 2.7 3 3-2 .3-2.7 1-3 3-.3-2-1-2.7-3-3 2-.3 2.7-1 3-3z\"/>",
        ["settings"] = "<circle cx=\"12\" cy=\"12\" r=\"3\"/><path d=\"M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M18.7 5.3l-2.1 2.1M7.4 16.6l-2.1 2.1\"/>",
        ["plus"] = "<path d=\"M12 5v14M5 12h14\"/>",
        ["more"] = "<circle cx=\"5\" cy=\"12\" r=\"1.2\" fill=\"currentColor\"/><circle cx=\"12\" cy=\"12\" r=\"1.2\" fill=\"currentColor\"/><circle cx=\"19\" cy=\"12\" r=\"1.2\" fill=\"currentColor\"/>",
        ["help"] = "<circle cx=\"12\" cy=\"12\" r=\"9\"/><path d=\"M9.5 9a2.5 2.5 0 1 1 4 2c-1 .7-1.5 1.2-1.5 2.5\"/><circle cx=\"12\" cy=\"17\" r=\".8\" fill=\"currentColor\"/>",
        ["arrow"] = "<path d=\"M4 12h15M14 7l5 5-5 5\"/>",
        ["trash"] = "<path d=\"M4 7h16M7 7l1 13h8l1-13M9 7V4h6v3M10 11v5M14 11v5\"/>",
        ["star"] = "<path d=\"M12 3l2.8 6 6.2.6-4.7 4.1 1.4 6.1-5.7-3.3-5.7 3.3 1.4-6.1L3 9.6l6.2-.6z\"/>",
        ["calendar"] = "<rect x=\"3.5\" y=\"5\" width=\"17\" height=\"15\" rx=\"2\"/><path d=\"M3.5 9.5h17M8 3v4M16 3v4\"/>",
        ["trend"] = "<path d=\"M4 17l5-6 4 3 7-8\"/><path d=\"M15 6h5v5\"/>",
        ["eye"] = "<path d=\"M2.5 12c3-5 6-7 9.5-7s6.5 2 9.5 7c-3 5-6 7-9.5 7s-6.5-2-9.5-7z\"/><circle cx=\"12\" cy=\"12\" r=\"3\"/>",
        ["link"] = "<path d=\"M10 14a4 4 0 0 0 6 .4l2-2a4 4 0 0 0-5.7-5.7l-1.1 1.1\"/><path d=\"M14 10a4 4 0 0 0-6-.4l-2 2a4 4 0 0 0 5.7 5.7l1.1-1.1\"/>"
    };

    public static string Svg(string name)
        => string.Format(Wrap, Map.TryGetValue(name, out var body) ? body : "");
}

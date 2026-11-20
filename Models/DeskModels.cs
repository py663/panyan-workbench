using System.Text.Json;

namespace Workbench.Web.Models;

public class WordDto
{
    public string w { get; set; } = "";
    public string p { get; set; } = "";
    public string m { get; set; } = "";
    public string status { get; set; } = "new";
    public long nextReview { get; set; }
}

public class TaskDto
{
    public string id { get; set; } = "";
    public string type { get; set; } = "homework";
    public string title { get; set; } = "";
    public string status { get; set; } = "todo";
    public string? deadline { get; set; }
    public string priority { get; set; } = "medium";
    public List<string> tags { get; set; } = new();
}

public class CourseDto
{
    public string id { get; set; } = "";
    public string name { get; set; } = "";
    public int day { get; set; }
    public int[] periods { get; set; } = Array.Empty<int>();
    public string location { get; set; } = "";
    public string kind { get; set; } = "theory";
}

public class FinanceDto
{
    public string type { get; set; } = "expense";
    public double amount { get; set; }
    public string category { get; set; } = "其他";
    public string date { get; set; } = "";
}

public class HistoryDto
{
    public string date { get; set; } = "";
    public int @new { get; set; }
    public int review { get; set; }
}

public class SettingsDto
{
    public int dailyNewWords { get; set; } = 20;
    public double monthlyBudget { get; set; } = 1500;
}

public class StatsDto
{
    public List<HistoryDto> wordsHistory { get; set; } = new();
}

public static class Json
{
    private static readonly JsonSerializerOptions Options = new()
    {
        PropertyNameCaseInsensitive = true
    };

    public static T Load<T>(string? json, T fallback) where T : class
    {
        if (string.IsNullOrWhiteSpace(json)) return fallback;
        try { return JsonSerializer.Deserialize<T>(json, Options) ?? fallback; }
        catch { return fallback; }
    }
}

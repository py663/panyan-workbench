using Workbench.Web.Data;
using Workbench.Web.Models;

namespace Workbench.Web.Services;

/// <summary>
/// 为服务端渲染的页面准备数据：直接从当前账号的数据库记录计算。
/// </summary>
public class DeskDataService
{
    private readonly AppDb _db;

    public DeskDataService(AppDb db) => _db = db;

    public Dictionary<string, string> Modules(string userId) => _db.GetAllModules(userId);

    public TodayPageData BuildToday(string userId)
    {
        var m = Modules(userId);
        var words = Json.Load<List<WordDto>>(m.GetValueOrDefault("words"), new());
        var tasks = Json.Load<List<TaskDto>>(m.GetValueOrDefault("tasks"), new());
        var courses = Json.Load<List<CourseDto>>(m.GetValueOrDefault("courses"), new());
        var finance = Json.Load<List<FinanceDto>>(m.GetValueOrDefault("finance"), new());
        var settings = Json.Load<SettingsDto>(m.GetValueOrDefault("settings"), new SettingsDto());
        var stats = Json.Load<StatsDto>(m.GetValueOrDefault("stats"), new StatsDto());

        var now = DateTime.Now;
        var todayDate = DateTime.Today;
        var today = todayDate.ToString("yyyy-MM-dd");
        var todayTs = todayDate.Ticks / TimeSpan.TicksPerMillisecond - DateTime.UnixEpoch.Ticks / TimeSpan.TicksPerMillisecond;
        var tomorrow = todayDate.AddDays(1).ToString("yyyy-MM-dd");
        var weekLater = todayDate.AddDays(7).ToString("yyyy-MM-dd");

        var review = words.Where(w => w.nextReview <= todayTs && w.status != "archived" && w.status != "new")
                          .OrderBy(w => w.nextReview).ToList();
        var fresh = words.Where(w => w.status == "new").Take(Math.Max(0, settings.dailyNewWords)).ToList();

        var todayTasks = tasks.Where(t => t.status != "done" && !string.IsNullOrEmpty(t.deadline)
                                          && (t.deadline == today || (string.CompareOrdinal(t.deadline, today) >= 0
                                              && string.CompareOrdinal(t.deadline, tomorrow) <= 0)))
                              .ToList();
        var upcoming = tasks.Where(t => t.status != "done" && !string.IsNullOrEmpty(t.deadline)
                                        && string.CompareOrdinal(t.deadline, today) >= 0
                                        && string.CompareOrdinal(t.deadline, weekLater) <= 0)
                            .OrderBy(t => t.deadline).ToList();
        var overdue = tasks.Where(t => t.status != "done" && !string.IsNullOrEmpty(t.deadline)
                                       && string.CompareOrdinal(t.deadline, today) < 0).ToList();

        var ym = today[..7];
        var monthFinance = finance.Where(f => f.date.StartsWith(ym, StringComparison.Ordinal)).ToList();
        var expense = monthFinance.Where(f => f.type != "income").Sum(f => f.amount);
        var income = monthFinance.Where(f => f.type == "income").Sum(f => f.amount);
        var catExpense = monthFinance.Where(f => f.type != "income")
            .GroupBy(f => f.category)
            .Select(g => new CategoryAmount { Name = g.Key, Amount = g.Sum(x => x.amount) })
            .OrderByDescending(x => x.Amount).ToList();
        var budget = settings.monthlyBudget;
        var budgetPercent = budget > 0 ? Math.Min(100, (int)Math.Round(expense / budget * 100)) : 0;

        var hist = stats.wordsHistory.TakeLast(7).ToList();
        var maxV = Math.Max(1, Math.Max(hist.Sum(h => h.@new), hist.Sum(h => h.review)));

        var dayIndex = ((int)now.DayOfWeek + 6) % 7 + 1;
        var todayCourses = courses.Where(c => c.day == dayIndex).OrderBy(c => c.periods.FirstOrDefault()).ToList();

        return new TodayPageData
        {
            Greeting = Greeting(now.Hour),
            DateText = today,
            WeekdayText = Weekday(now.DayOfWeek),
            ReviewCount = review.Count,
            FreshCount = fresh.Count,
            LearnedCount = words.Count(w => w.status != "new"),
            TodayTasks = todayTasks,
            Upcoming = upcoming,
            Overdue = overdue,
            Budget = budget,
            Expense = expense,
            Income = income,
            BudgetRemain = budget - expense,
            BudgetPercent = budgetPercent,
            Categories = catExpense,
            History = hist,
            HistoryMax = maxV,
            NewTotal = hist.Sum(h => h.@new),
            ReviewTotal = hist.Sum(h => h.review),
            TodayCourses = todayCourses
        };
    }

    public TimetablePageData BuildTimetable(string userId)
    {
        var m = Modules(userId);
        var courses = Json.Load<List<CourseDto>>(m.GetValueOrDefault("courses"), new());
        var tasks = Json.Load<List<TaskDto>>(m.GetValueOrDefault("tasks"), new());

        var homework = tasks.Where(t => t.type == "homework").ToList()
            .OrderBy(t => t.status == "done" ? 1 : 0)
            .ThenBy(t => t.deadline ?? "").ToList();

        return new TimetablePageData
        {
            Courses = courses,
            Tasks = homework,
            TodayIndex = ((int)DateTime.Now.DayOfWeek + 6) % 7 + 1
        };
    }

    private static string Greeting(int hour) => hour switch
    {
        < 6 => "夜深了，注意休息",
        < 12 => "早安，今天也要加油",
        < 14 => "午后好，适度休息",
        < 18 => "下午好，保持专注",
        _ => "晚上好，回顾一下今天吧"
    };

    private static string Weekday(DayOfWeek day) => day switch
    {
        DayOfWeek.Monday => "周一",
        DayOfWeek.Tuesday => "周二",
        DayOfWeek.Wednesday => "周三",
        DayOfWeek.Thursday => "周四",
        DayOfWeek.Friday => "周五",
        DayOfWeek.Saturday => "周六",
        _ => "周日"
    };
}

public class CategoryAmount
{
    public string Name { get; set; } = "";
    public double Amount { get; set; }
}

public class TodayPageData
{
    public string Greeting { get; set; } = "";
    public string DateText { get; set; } = "";
    public string WeekdayText { get; set; } = "";
    public int ReviewCount { get; set; }
    public int FreshCount { get; set; }
    public int LearnedCount { get; set; }
    public List<TaskDto> TodayTasks { get; set; } = new();
    public List<TaskDto> Upcoming { get; set; } = new();
    public List<TaskDto> Overdue { get; set; } = new();
    public double Budget { get; set; }
    public double Expense { get; set; }
    public double Income { get; set; }
    public double BudgetRemain { get; set; }
    public int BudgetPercent { get; set; }
    public List<CategoryAmount> Categories { get; set; } = new();
    public List<HistoryDto> History { get; set; } = new();
    public int HistoryMax { get; set; } = 1;
    public int NewTotal { get; set; }
    public int ReviewTotal { get; set; }
    public List<CourseDto> TodayCourses { get; set; } = new();
}

public class TimetablePageData
{
    public List<CourseDto> Courses { get; set; } = new();
    public List<TaskDto> Tasks { get; set; } = new();
    public int TodayIndex { get; set; }
}

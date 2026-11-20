using System.Data.Common;
using System.Security.Cryptography;
using Microsoft.Data.Sqlite;
using Npgsql;

namespace Workbench.Web.Data;

/// <summary>
/// 数据访问层：支持 SQLite（本地开发）与 PostgreSQL（线上 Supabase）。
/// 两张表：账号、每个账号各模块的 JSON 数据。
/// </summary>
public class AppDb
{
    private readonly Func<DbConnection> _open;
    private readonly bool _isPostgres;

    private AppDb(Func<DbConnection> open, bool isPostgres)
    {
        _open = open;
        _isPostgres = isPostgres;
        Init();
    }

    public static AppDb FromSqlite(string dbPath)
        => new(() =>
        {
            var conn = new SqliteConnection($"Data Source={dbPath}");
            conn.Open();
            return conn;
        }, false);

    public static AppDb FromPostgres(string connectionString)
        => new(() =>
        {
            var conn = new NpgsqlConnection(connectionString);
            conn.Open();
            return conn;
        }, true);

    /// <summary>把 postgresql://user:pass@host:port/db 转成 Npgsql 连接串。</summary>
    public static string PostgresUrlToConnectionString(string url)
    {
        if (!url.StartsWith("postgres", StringComparison.OrdinalIgnoreCase)) return url;
        var uri = new Uri(url);
        var userInfo = uri.UserInfo.Split(':', 2);
        var user = Uri.UnescapeDataString(userInfo[0]);
        var pass = userInfo.Length > 1 ? Uri.UnescapeDataString(userInfo[1]) : "";
        var db = uri.AbsolutePath.Trim('/');
        if (string.IsNullOrEmpty(db)) db = "postgres";
        var port = uri.Port > 0 ? uri.Port : 5432;
        // PgBouncer（Supabase 事务池 6543 / 会话池 5432）兼容性：
        // 显式禁用自动 prepared statement，避免事务池下 "prepared statement does not exist"。
        return $"Host={uri.Host};Port={port};Database={db};Username={user};Password={pass};" +
               "SSL Mode=Require;Trust Server Certificate=true;Pooling=true;Max Auto Prepare=0;No Reset On Close=true";
    }

    private void Init()
    {
        // 分两条语句单独执行，避免某些驱动/连接池对单命令多语句的兼容问题。
        var statements = _isPostgres
            ? new[]
            {
                @"CREATE TABLE IF NOT EXISTS users (
  id           TEXT PRIMARY KEY,
  username     TEXT NOT NULL UNIQUE,
  passwordhash TEXT NOT NULL,
  createdat    TEXT NOT NULL
)",
                @"CREATE TABLE IF NOT EXISTS usermodules (
  userid    TEXT NOT NULL,
  module    TEXT NOT NULL,
  json      TEXT NOT NULL,
  version   BIGINT NOT NULL DEFAULT 1,
  updatedat TEXT NOT NULL,
  PRIMARY KEY (userid, module)
)"
            }
            : new[]
            {
                @"CREATE TABLE IF NOT EXISTS Users (
  Id           TEXT PRIMARY KEY,
  Username     TEXT NOT NULL UNIQUE,
  PasswordHash TEXT NOT NULL,
  CreatedAt    TEXT NOT NULL
)",
                @"CREATE TABLE IF NOT EXISTS UserModules (
  UserId    TEXT NOT NULL,
  Module    TEXT NOT NULL,
  Json      TEXT NOT NULL,
  Version   INTEGER NOT NULL DEFAULT 1,
  UpdatedAt TEXT NOT NULL,
  PRIMARY KEY (UserId, Module)
)"
            };

        using var conn = _open();
        foreach (var sql in statements)
        {
            using var cmd = conn.CreateCommand();
            cmd.CommandText = sql;
            cmd.ExecuteNonQuery();
        }
    }

    private static string Normalize(string username) => (username ?? "").Trim().ToLowerInvariant();

    private static DbParameter Param(DbCommand cmd, string name, object value)
    {
        var p = cmd.CreateParameter();
        p.ParameterName = name;
        p.Value = value;
        return p;
    }

    // ---------------- 账号 ----------------

    public enum CreateUserResult { Success, Duplicate, Error }

    public CreateUserResult CreateUser(string username, string password, out string userId)
    {
        username = Normalize(username);
        userId = Guid.NewGuid().ToString("N");
        try
        {
            using var conn = _open();
            using var cmd = conn.CreateCommand();
            cmd.CommandText = "INSERT INTO Users (Id, Username, PasswordHash, CreatedAt) VALUES (@id, @u, @p, @t)";
            cmd.Parameters.Add(Param(cmd, "@id", userId));
            cmd.Parameters.Add(Param(cmd, "@u", username));
            cmd.Parameters.Add(Param(cmd, "@p", HashPassword(password)));
            cmd.Parameters.Add(Param(cmd, "@t", DateTime.UtcNow.ToString("o")));
            cmd.ExecuteNonQuery();
        }
        catch (Exception ex)
        {
            // 唯一约束违反 → 用户名已存在；其它（含连接失败的 IOException）→ 出错，不再冒泡成 500。
            return IsUniqueViolation(ex) ? CreateUserResult.Duplicate : CreateUserResult.Error;
        }

        try
        {
            SeedDefaultModules(userId);
        }
        catch
        {
            // 种子失败：回滚刚建的用户，避免重试时被误判为“已注册”。
            try { DeleteUser(userId); } catch { }
            userId = "";
            return CreateUserResult.Error;
        }

        return CreateUserResult.Success;
    }

    private void DeleteUser(string userId)
    {
        using var conn = _open();
        using var cmd = conn.CreateCommand();
        cmd.CommandText = "DELETE FROM Users WHERE Id = @id";
        cmd.Parameters.Add(Param(cmd, "@id", userId));
        cmd.ExecuteNonQuery();
    }

    private static bool IsUniqueViolation(Exception ex)
    {
        if (ex is Npgsql.PostgresException pg && pg.SqlState == "23505") return true;
        if (ex is Microsoft.Data.Sqlite.SqliteException sl && sl.SqliteErrorCode == 19) return true;
        return false;
    }

    public string? ValidateUser(string username, string password)
    {
        username = Normalize(username);
        using var conn = _open();
        using var cmd = conn.CreateCommand();
        cmd.CommandText = "SELECT Id, PasswordHash FROM Users WHERE Username = @u";
        cmd.Parameters.Add(Param(cmd, "@u", username));
        using var reader = cmd.ExecuteReader();
        if (!reader.Read()) return null;
        var id = reader.GetString(0);
        var stored = reader.GetString(1);
        return VerifyPassword(password, stored) ? id : null;
    }

    public string? GetUsername(string userId)
    {
        using var conn = _open();
        using var cmd = conn.CreateCommand();
        cmd.CommandText = "SELECT Username FROM Users WHERE Id = @id";
        cmd.Parameters.Add(Param(cmd, "@id", userId));
        return cmd.ExecuteScalar() as string;
    }

    // ---------------- 模块数据 ----------------

    public Dictionary<string, string> GetAllModules(string userId)
    {
        var result = new Dictionary<string, string>();
        using var conn = _open();
        using var cmd = conn.CreateCommand();
        cmd.CommandText = "SELECT Module, \"json\" FROM UserModules WHERE UserId = @id";
        cmd.Parameters.Add(Param(cmd, "@id", userId));
        using var reader = cmd.ExecuteReader();
        while (reader.Read()) result[reader.GetString(0)] = reader.GetString(1);
        return result;
    }

    /// <summary>
    /// 保存某个模块。version 用来防止多设备同时修改被静默覆盖。
    /// 返回 (ok, newVersion, serverJson)：版本不一致时 ok=false，serverJson 为服务器当前内容。
    /// </summary>
    public (bool Ok, long Version, string? ServerJson) SaveModule(
        string userId, string module, string json, long expectedVersion)
    {
        using var conn = _open();

        long currentVersion = 0;
        string? currentJson = null;
        using (var q = conn.CreateCommand())
        {
            q.CommandText = "SELECT Version, \"json\" FROM UserModules WHERE UserId = @id AND Module = @m";
            q.Parameters.Add(Param(q, "@id", userId));
            q.Parameters.Add(Param(q, "@m", module));
            using var r = q.ExecuteReader();
            if (r.Read())
            {
                currentVersion = r.GetInt64(0);
                currentJson = r.GetString(1);
            }
        }

        if (currentJson != null && expectedVersion != currentVersion)
            return (false, currentVersion, currentJson);

        long next = currentVersion + 1;
        using (var cmd = conn.CreateCommand())
        {
            cmd.CommandText = @"
INSERT INTO UserModules (UserId, Module, ""json"", Version, UpdatedAt)
VALUES (@id, @m, @j, @v, @t)
ON CONFLICT(UserId, Module) DO UPDATE SET
  ""json"" = excluded.""json"",
  Version = excluded.Version,
  UpdatedAt = excluded.UpdatedAt";
            cmd.Parameters.Add(Param(cmd, "@id", userId));
            cmd.Parameters.Add(Param(cmd, "@m", module));
            cmd.Parameters.Add(Param(cmd, "@j", json));
            cmd.Parameters.Add(Param(cmd, "@v", next));
            cmd.Parameters.Add(Param(cmd, "@t", DateTime.UtcNow.ToString("o")));
            cmd.ExecuteNonQuery();
        }

        return (true, next, null);
    }

    public Dictionary<string, long> GetAllVersions(string userId)
    {
        var result = new Dictionary<string, long>();
        using var conn = _open();
        using var cmd = conn.CreateCommand();
        cmd.CommandText = "SELECT Module, Version FROM UserModules WHERE UserId = @id";
        cmd.Parameters.Add(Param(cmd, "@id", userId));
        using var reader = cmd.ExecuteReader();
        while (reader.Read()) result[reader.GetString(0)] = reader.GetInt64(1);
        return result;
    }

    public long GetVersion(string userId, string module)
    {
        using var conn = _open();
        using var cmd = conn.CreateCommand();
        cmd.CommandText = "SELECT Version FROM UserModules WHERE UserId = @id AND Module = @m";
        cmd.Parameters.Add(Param(cmd, "@id", userId));
        cmd.Parameters.Add(Param(cmd, "@m", module));
        var v = cmd.ExecuteScalar();
        return v == null ? 0 : Convert.ToInt64(v);
    }

    // ---------------- 默认数据 ----------------

    private void SeedDefaultModules(string userId)
    {
        var defaults = new Dictionary<string, string>
        {
            ["words"] = "[]",
            ["tasks"] = "[]",
            ["videos"] = "[]",
            ["inbox"] = "[]",
            ["notes"] = "[]",
            ["finance"] = "[]",
            ["courses"] = DefaultCourses,
            ["links"] = DefaultLinks,
            ["settings"] = DefaultSettings,
            ["stats"] = "{\"wordsLearnedToday\":0,\"wordsReviewedToday\":0,\"wordsHistory\":[],\"financeMonthly\":{}}"
        };

        using var conn = _open();
        using var tx = conn.BeginTransaction();
        foreach (var (module, json) in defaults)
        {
            using var cmd = conn.CreateCommand();
            cmd.Transaction = tx;
            cmd.CommandText = @"
INSERT INTO UserModules (UserId, Module, ""json"", Version, UpdatedAt)
VALUES (@id, @m, @j, 1, @t)";
            cmd.Parameters.Add(Param(cmd, "@id", userId));
            cmd.Parameters.Add(Param(cmd, "@m", module));
            cmd.Parameters.Add(Param(cmd, "@j", json));
            cmd.Parameters.Add(Param(cmd, "@t", DateTime.UtcNow.ToString("o")));
            cmd.ExecuteNonQuery();
        }
        tx.Commit();
    }

    private const string DefaultCourses = @"[
 {""name"":""地理大数据分析与应用"",""day"":1,""periods"":[1,3],""location"":""38-401"",""kind"":""theory""},
 {""name"":""AutoCAD 地理制图实验"",""day"":1,""periods"":[6,8],""location"":""JX09-201"",""kind"":""lab""},
 {""name"":""环境学概论"",""day"":2,""periods"":[1,3],""location"":""38-409"",""kind"":""theory""},
 {""name"":""GIS应用开发实验"",""day"":2,""periods"":[4,5],""location"":""JX09-303"",""kind"":""lab""},
 {""name"":""概率论与数理统计"",""day"":2,""periods"":[6,8],""location"":""JX02-404"",""kind"":""theory""},
 {""name"":""网络地理信息系统实验"",""day"":3,""periods"":[3,5],""location"":""JX04-107"",""kind"":""lab""},
 {""name"":""遥感云计算技术"",""day"":3,""periods"":[8,9],""location"":""39-A101"",""kind"":""theory""},
 {""name"":""GIS空间分析"",""day"":4,""periods"":[4,5],""location"":""JX09-201"",""kind"":""theory""},
 {""name"":""GIS应用开发"",""day"":4,""periods"":[8,9],""location"":""JX09-303"",""kind"":""theory""},
 {""name"":""GIS空间分析实验"",""day"":5,""periods"":[6,7],""location"":""38-409"",""kind"":""lab""}
]";

    private const string DefaultLinks = @"[
 {""title"":""中国大学MOOC"",""url"":""https://www.icourse163.org/"",""note"":""国内高校课程""},
 {""title"":""哔哩哔哩"",""url"":""https://www.bilibili.com/"",""note"":""学习视频""},
 {""title"":""GitHub"",""url"":""https://github.com/"",""note"":""代码与资料""}
]";

    private const string DefaultSettings = @"{
 ""dailyNewWords"":20,
 ""aiBaseUrl"":""https://open.bigmodel.cn/api/paas/v4"",
 ""aiModel"":""glm-4-flash"",
 ""monthlyBudget"":1500,
 ""newsEnabled"":true
}";

    // ---------------- 密码哈希 ----------------

    private const int Iterations = 100000;

    private static string HashPassword(string password)
    {
        var salt = RandomNumberGenerator.GetBytes(16);
        var hash = Rfc2898DeriveBytes.Pbkdf2(password, salt, Iterations, HashAlgorithmName.SHA256, 32);
        return $"{Iterations}.{Convert.ToBase64String(salt)}.{Convert.ToBase64String(hash)}";
    }

    private static bool VerifyPassword(string password, string stored)
    {
        var parts = stored.Split('.');
        if (parts.Length != 3) return false;
        if (!int.TryParse(parts[0], out var iterations)) return false;
        var salt = Convert.FromBase64String(parts[1]);
        var expected = Convert.FromBase64String(parts[2]);
        var actual = Rfc2898DeriveBytes.Pbkdf2(password, salt, iterations, HashAlgorithmName.SHA256, expected.Length);
        return CryptographicOperations.FixedTimeEquals(actual, expected);
    }
}

using MockingBird.Common;
using Microsoft.EntityFrameworkCore;
using MockingBird.Contracts;
using MockingBird.Data;

namespace MockingBird.Services;

public class SettingsService(MockingBirdDbContext database)
{
    public async Task<SettingsDto> Get() => (await database.Settings.AsNoTracking().SingleOrDefaultAsync())?.Dto() ?? new();
    public async Task Save(SettingsDto settings)
    {
        if (settings.LogRetentionDays is < 1 or > 30 || settings.MaxLogsPerProject is < 10 or > 500 || settings.MaxLoggedRequestBodyMb is < 1 or > 4)
            throw new ApiException(400, "Retention must be 1–30 days, logs 10–500, and body size 1–4 MB.");
        var row = await database.Settings.SingleOrDefaultAsync();
        if (row == null)
        {
            row = new();
            database.Settings.Add(row);
        }

        row.LogRetentionDays = settings.LogRetentionDays;
        row.MaxLogsPerProject = settings.MaxLogsPerProject;
        row.MaxLoggedRequestBodyMb = settings.MaxLoggedRequestBodyMb;
        row.ExternalRequestsEnabled = settings.ExternalRequestsEnabled;
        await database.SaveChangesAsync();
    }
}

using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace server.Data;

public class TripPlannerContextFactory : IDesignTimeDbContextFactory<TripPlannerContext>
{
    public TripPlannerContext CreateDbContext(string[] args)
    {
        var options = new DbContextOptionsBuilder<TripPlannerContext>()
            .UseSqlite("Data Source=tripplanner.db")
            .Options;

        return new TripPlannerContext(options);
    }
}

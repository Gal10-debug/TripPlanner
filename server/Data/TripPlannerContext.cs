using Microsoft.EntityFrameworkCore;
using server.Models;

namespace server.Data;

public class TripPlannerContext(DbContextOptions<TripPlannerContext> options)
    : DbContext(options)
{
    public DbSet<Trip> Trips => Set<Trip>();
}

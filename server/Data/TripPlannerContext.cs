using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using server.Models;

namespace server.Data;

public class TripPlannerContext(DbContextOptions<TripPlannerContext> options)
    : IdentityDbContext<IdentityUser>(options)
{
    public DbSet<Trip> Trips => Set<Trip>();
    public DbSet<TripLink> TripLinks => Set<TripLink>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        modelBuilder.Entity<Trip>()
            .HasOne<IdentityUser>()
            .WithMany()
            .HasForeignKey(trip => trip.UserId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<TripLink>()
            .HasOne(link => link.Trip)
            .WithMany(trip => trip.UsefulLinks)
            .HasForeignKey(link => link.TripId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}

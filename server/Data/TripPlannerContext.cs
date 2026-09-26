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
    public DbSet<ItineraryItem> ItineraryItems => Set<ItineraryItem>();
    public DbSet<PackingItem> PackingItems => Set<PackingItem>();
    public DbSet<Expense> Expenses => Set<Expense>();
    public DbSet<TripMember> TripMembers => Set<TripMember>();
    public DbSet<TripInvitation> TripInvitations => Set<TripInvitation>();
    public DbSet<TripReminder> TripReminders => Set<TripReminder>();

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

        modelBuilder.Entity<ItineraryItem>()
            .HasOne(item => item.Trip)
            .WithMany()
            .HasForeignKey(item => item.TripId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<PackingItem>()
            .HasOne(item => item.Trip)
            .WithMany()
            .HasForeignKey(item => item.TripId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<Expense>()
            .HasOne(expense => expense.Trip)
            .WithMany()
            .HasForeignKey(expense => expense.TripId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<TripMember>().HasKey(member => new { member.TripId, member.UserId });
        modelBuilder.Entity<TripMember>()
            .HasOne<Trip>()
            .WithMany()
            .HasForeignKey(member => member.TripId)
            .OnDelete(DeleteBehavior.Cascade);
        modelBuilder.Entity<TripMember>()
            .HasOne<IdentityUser>()
            .WithMany()
            .HasForeignKey(member => member.UserId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<TripInvitation>()
            .HasOne<Trip>()
            .WithMany()
            .HasForeignKey(invitation => invitation.TripId)
            .OnDelete(DeleteBehavior.Cascade);
        modelBuilder.Entity<TripInvitation>()
            .HasIndex(invitation => new { invitation.TripId, invitation.NormalizedEmail })
            .IsUnique();

        modelBuilder.Entity<TripReminder>()
            .HasOne(reminder => reminder.Trip)
            .WithMany()
            .HasForeignKey(reminder => reminder.TripId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}

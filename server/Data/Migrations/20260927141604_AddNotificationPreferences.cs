using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace server.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddNotificationPreferences : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "EmailAttempts",
                table: "UserNotifications",
                type: "INTEGER",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<long>(
                name: "EmailNextAttemptUtcTicks",
                table: "UserNotifications",
                type: "INTEGER",
                nullable: false,
                defaultValue: 0L);

            migrationBuilder.AddColumn<string>(
                name: "EmailStatus",
                table: "UserNotifications",
                type: "TEXT",
                nullable: false,
                defaultValue: "none");

            migrationBuilder.AddColumn<bool>(
                name: "BrowserNotifications",
                table: "AccountSettings",
                type: "INTEGER",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<bool>(
                name: "EmailReminders",
                table: "AccountSettings",
                type: "INTEGER",
                nullable: false,
                defaultValue: false);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "EmailAttempts",
                table: "UserNotifications");

            migrationBuilder.DropColumn(
                name: "EmailNextAttemptUtcTicks",
                table: "UserNotifications");

            migrationBuilder.DropColumn(
                name: "EmailStatus",
                table: "UserNotifications");

            migrationBuilder.DropColumn(
                name: "BrowserNotifications",
                table: "AccountSettings");

            migrationBuilder.DropColumn(
                name: "EmailReminders",
                table: "AccountSettings");
        }
    }
}

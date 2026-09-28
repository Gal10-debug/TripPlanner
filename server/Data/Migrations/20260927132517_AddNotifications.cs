using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace server.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddNotifications : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "UserNotifications",
                columns: table => new
                {
                    Id = table.Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    UserId = table.Column<string>(type: "TEXT", nullable: false),
                    ReminderId = table.Column<int>(type: "INTEGER", nullable: false),
                    DueDate = table.Column<DateOnly>(type: "TEXT", nullable: false),
                    IsRead = table.Column<bool>(type: "INTEGER", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_UserNotifications", x => x.Id);
                    table.ForeignKey(
                        name: "FK_UserNotifications_AspNetUsers_UserId",
                        column: x => x.UserId,
                        principalTable: "AspNetUsers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_UserNotifications_TripReminders_ReminderId",
                        column: x => x.ReminderId,
                        principalTable: "TripReminders",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_UserNotifications_ReminderId",
                table: "UserNotifications",
                column: "ReminderId");

            migrationBuilder.CreateIndex(
                name: "IX_UserNotifications_UserId_ReminderId_DueDate",
                table: "UserNotifications",
                columns: new[] { "UserId", "ReminderId", "DueDate" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "UserNotifications");
        }
    }
}

using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace server.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddPasswordResetQueue : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "PasswordResetDeliveries",
                columns: table => new
                {
                    EmailKey = table.Column<string>(type: "TEXT", nullable: false),
                    ProtectedPayload = table.Column<string>(type: "TEXT", nullable: false),
                    Status = table.Column<string>(type: "TEXT", nullable: false),
                    RequestedUtcTicks = table.Column<long>(type: "INTEGER", nullable: false),
                    ExpiresUtcTicks = table.Column<long>(type: "INTEGER", nullable: false),
                    NextAttemptUtcTicks = table.Column<long>(type: "INTEGER", nullable: false),
                    Attempts = table.Column<int>(type: "INTEGER", nullable: false),
                    LeaseId = table.Column<string>(type: "TEXT", nullable: false),
                    LastFailureType = table.Column<string>(type: "TEXT", nullable: true),
                    SentUtcTicks = table.Column<long>(type: "INTEGER", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PasswordResetDeliveries", x => x.EmailKey);
                });

            migrationBuilder.CreateIndex(
                name: "IX_PasswordResetDeliveries_Status_NextAttemptUtcTicks",
                table: "PasswordResetDeliveries",
                columns: new[] { "Status", "NextAttemptUtcTicks" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "PasswordResetDeliveries");
        }
    }
}

import org.flywaydb.core.Flyway;
import org.flywaydb.core.api.MigrationInfo;
import org.flywaydb.core.api.output.MigrateResult;

/**
 * Temporary Flyway verify harness (mirrors application.yml spring.flyway settings:
 * locations + baseline-on-migrate=true + baseline-version=0).
 * Run twice in separate JVMs against the same schema to verify idempotent restart behavior.
 * args: <jdbcUrl> <user> <pass> <migrationLocation>
 */
public class FlywayVerify {
    public static void main(String[] args) {
        String url = args[0];
        String user = args[1];
        String pass = args[2];
        String location = args[3];
        Flyway flyway = Flyway.configure()
                .dataSource(url, user, pass)
                .locations(location)
                .baselineOnMigrate(true)
                .baselineVersion("0")
                .load();
        MigrateResult r = flyway.migrate();
        System.out.println("RESULT migrationsExecuted=" + r.migrationsExecuted
                + " success=" + r.success
                + " targetSchemaVersion=" + r.targetSchemaVersion
                + " schemaName=" + r.schemaName);
        MigrationInfo[] pending = flyway.info().pending();
        System.out.println("RESULT pendingAfterMigrate=" + pending.length);
        for (MigrationInfo m : flyway.info().all()) {
            System.out.println("HIST " + m.getVersion() + " | " + m.getType()
                    + " | " + m.getDescription() + " | state=" + m.getState()
                    + " | " + m.getScript());
        }
        if (!r.success) {
            System.out.println("HARNESS FAILURE");
        }
    }
}

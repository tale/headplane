import { dump } from "js-yaml";
import { beforeEach, describe, expect, test } from "vitest";

import { loadConfig } from "~/server/config/load";
import { type DatabaseConfig, resolveDatabaseConfig } from "~/server/db/client.server";

function expectSqlite(config: DatabaseConfig): Extract<DatabaseConfig, { type: "sqlite" }> {
  if (config.type !== "sqlite") {
    throw new Error(`expected a sqlite target, got ${config.type}`);
  }
  return config;
}

import { clearFakeFiles, createFakeFile } from "../setup/overlay-fs";

const CONFIG_PATH = "/etc/headplane/config.yaml";

function writeConfig(server: Record<string, unknown>) {
  createFakeFile(
    CONFIG_PATH,
    dump({
      server: {
        host: "0.0.0.0",
        port: 3000,
        cookie_secret: "abcdefghijklmnopqrstuvwxyz123456",
        cookie_secure: false,
        ...server,
      },
      headscale: { url: "http://localhost:8080" },
    }),
  );
}

describe("server.database configuration", () => {
  beforeEach(() => {
    clearFakeFiles();
  });

  test("loadConfig_withoutDatabaseBlock_keepsHistoricalLocation", async () => {
    writeConfig({ data_path: "/var/lib/headplane/" });
    const config = await loadConfig(CONFIG_PATH);

    // An existing install must keep using the database it already has.
    expect(resolveDatabaseConfig(config.server)).toEqual({
      type: "sqlite",
      path: "/var/lib/headplane/hp_persist.db",
    });
  });

  test("loadConfig_withDatabasePath_overridesTheDefaultLocation", async () => {
    writeConfig({
      data_path: "/var/lib/headplane/",
      database: { type: "sqlite", path: "/srv/state/headplane.db" },
    });
    const config = await loadConfig(CONFIG_PATH);

    expect(resolveDatabaseConfig(config.server)).toEqual({
      type: "sqlite",
      path: "/srv/state/headplane.db",
    });
  });

  test("loadConfig_withDatabaseBlockButNoPath_fallsBackToDataPath", async () => {
    writeConfig({ data_path: "/var/lib/headplane/", database: { type: "sqlite" } });
    const config = await loadConfig(CONFIG_PATH);

    expect(expectSqlite(resolveDatabaseConfig(config.server)).path).toBe(
      "/var/lib/headplane/hp_persist.db",
    );
  });

  test("loadConfig_withDatabaseBlockOmittingType_defaultsToSqlite", async () => {
    writeConfig({ database: { path: "/srv/state/headplane.db" } });
    const config = await loadConfig(CONFIG_PATH);

    expect(config.server.database?.type).toBe("sqlite");
  });

  test("loadConfig_withUnknownDatabaseType_rejects", async () => {
    writeConfig({ database: { type: "mongodb" } });

    await expect(loadConfig(CONFIG_PATH)).rejects.toThrow();
  });

  test("loadConfig_withMixedCaseDatabasePath_preservesIt", async () => {
    // `string.lower` rewrites the value it validates, which would silently
    // point at a different directory on a case-sensitive filesystem. This
    // field must not use it.
    writeConfig({ database: { path: "/srv/State/Headplane.db" } });
    const config = await loadConfig(CONFIG_PATH);

    expect(expectSqlite(resolveDatabaseConfig(config.server)).path).toBe("/srv/State/Headplane.db");
  });
});

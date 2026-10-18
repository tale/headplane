import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rename, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { HEADSCALE_ALIAS } from "./constants";

// Nodes retry control over TLS on 443 after a reconnect, so Headscale needs TLS.
const DIR = join(tmpdir(), "headplane-harness-tls");
const CERT = join(DIR, "cert.pem");
const KEY = join(DIR, "key.pem");

export async function harnessCertificate() {
  if (!existsSync(CERT) || !existsSync(KEY)) {
    await mkdir(DIR, { recursive: true });
    const scratch = await mkdtemp(join(DIR, "new-"));
    execFileSync(
      "openssl",
      [
        "req",
        "-x509",
        "-newkey",
        "ec",
        "-pkeyopt",
        "ec_paramgen_curve:prime256v1",
        "-nodes",
        "-days",
        "3650",
        "-subj",
        `/CN=${HEADSCALE_ALIAS}`,
        "-addext",
        `subjectAltName=DNS:${HEADSCALE_ALIAS},DNS:localhost,IP:127.0.0.1`,
        "-keyout",
        join(scratch, "key.pem"),
        "-out",
        join(scratch, "cert.pem"),
      ],
      { stdio: "ignore" },
    );

    // Renames are atomic, so parallel workers never see half a pair.
    await rename(join(scratch, "key.pem"), KEY);
    await rename(join(scratch, "cert.pem"), CERT);
    await rm(scratch, { recursive: true, force: true });
  }

  return {
    certPath: CERT,
    keyPath: KEY,
    cert: await readFile(CERT, "utf8"),
    key: await readFile(KEY, "utf8"),
  };
}

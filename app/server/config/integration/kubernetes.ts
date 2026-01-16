import { CoreV1Api, KubeConfig } from "@kubernetes/client-node";
import { type } from "arktype";
import { readdir, readFile } from "node:fs/promises";
import { platform } from "node:os";
import { join } from "node:path";

import type { RuntimeApiClient } from "~/server/headscale/api/endpoints";

import log from "~/utils/log";

import { Integration } from "./abstract";
import { findHeadscaleServe, signalAndWaitHealthy } from "./proc-helper";

// https://github.com/kubernetes-client/javascript/blob/055b83c6504dfd1b2a2d081efd974163c6cbb808/src/config.ts#L40
const svcRoot = "/var/run/secrets/kubernetes.io/serviceaccount";
const svcCaPath = `${svcRoot}/ca.crt`;
const svcTokenPath = `${svcRoot}/token`;
const svcNamespacePath = `${svcRoot}/namespace`;

const configSchema = {
  full: type({
    enabled: "boolean",
    pod_name: "string",
    validate_manifest: "boolean = true",
  }),

  partial: type({
    enabled: "boolean?",
    pod_name: "string?",
    validate_manifest: "boolean?",
  }).partial(),
};

export default class KubernetesIntegration extends Integration<typeof configSchema.full.infer> {
  private pid: number | undefined;

  get name() {
    return "Kubernetes (k8s)";
  }

  static get configSchema() {
    return configSchema;
  }

  async isAvailable() {
    if (platform() !== "linux") {
      log.error("config", "Kubernetes is only available on Linux");
      return false;
    }

    try {
      log.debug("config", "Checking Kubernetes service account at %s", svcRoot);
      const files = await readdir(svcRoot);
      if (files.length === 0) {
        log.error("config", "Kubernetes service account not found");
        return false;
      }

      const mappedFiles = new Set(files.map((file) => join(svcRoot, file)));
      const expectedFiles = [svcCaPath, svcTokenPath, svcNamespacePath];

      log.debug("config", "Looking for %s", expectedFiles.join(", "));
      if (!expectedFiles.every((file) => mappedFiles.has(file))) {
        log.error("config", "Malformed Kubernetes service account");
        return false;
      }
    } catch (error) {
      log.error("config", "Failed to access %s: %s", svcRoot, error);
      return false;
    }

    log.debug("config", "Reading Kubernetes service account at %s", svcRoot);
    const namespace = await readFile(svcNamespacePath, "utf8");

    // Some very ugly nesting but it's necessary
    if (this.context.validate_manifest === false) {
      log.warn("config", "Skipping strict Pod status check");
    } else {
      const pod = this.context.pod_name;
      if (!pod) {
        log.error("config", "Missing POD_NAME variable");
        return false;
      }

      if (pod.trim().length === 0) {
        log.error("config", "Pod name is empty");
        return false;
      }

      log.debug("config", "Checking Kubernetes pod %s in namespace %s", pod, namespace);

      try {
        log.debug("config", "Attempgin to get cluster KubeConfig");
        const kc = new KubeConfig();
        kc.loadFromCluster();

        const cluster = kc.getCurrentCluster();
        if (!cluster) {
          log.error("config", "Malformed kubeconfig");
          return false;
        }

        log.info("config", "Service account connected to %s (%s)", cluster.name, cluster.server);

        const kCoreV1Api = kc.makeApiClient(CoreV1Api);

        log.info("config", "Checking pod %s in namespace %s", pod, namespace);
        log.debug("config", "Reading pod info for %s", pod);
        const body = await kCoreV1Api.readNamespacedPod({
          name: pod,
          namespace,
        });

        if (!body.spec) {
          log.error("config", "Missing spec in pod info for %s/%s", pod, namespace);

          return false;
        }

        log.debug("config", "Got pod info: %o", body.spec);
        const shared = body.spec.shareProcessNamespace;
        if (shared === undefined) {
          log.error("config", "Pod does not have spec.shareProcessNamespace set");

          return false;
        }

        if (!shared) {
          log.error("config", "Pod has set but disabled spec.shareProcessNamespace");

          return false;
        }

        log.info("config", "Pod %s enabled shared processes", pod);
      } catch (error) {
        log.error("config", "Failed to read pod info: %s", error);
        return false;
      }
    }

    try {
      const result = await findHeadscaleServe();
      if (!result) {
        log.error("config", "Could not find headscale serve process");
        return false;
      }

      this.pid = result;
      log.info("config", "Found headscale serve (PID %d)", this.pid);
      return true;
    } catch (error) {
      log.error("config", "Failed to scan /proc: %s", error);
      return false;
    }
  }

  async onConfigChange(client: RuntimeApiClient) {
    if (!this.pid) {
      return;
    }

    await signalAndWaitHealthy(client, {
      pid: this.pid,
      signal: "SIGHUP",
    });
  }
}

/// <reference types="node" />

import type { Environment } from "./types/primitives";
import { ENV } from "varlock/env";

/**
 * Normalizes build-time mode input into a supported runtime environment.
 * @param value - Raw build-time mode value.
 * @returns The corresponding normalized runtime environment.
 */
export function resolveEnvironment(value: string | undefined) {
  let environment: Environment;
  switch (value) {
    case "production":
    case "preview":
      environment = value;
      break;
    default:
      environment = "development";
  }

  const isDebug = ENV.DEBUG === true;
  const isProd = environment === "production";
  const isPreview = environment === "preview";
  const isDev = environment === "development";
  const isTest = ENV.VITEST === true || ENV.NODE_ENV === "test" || ENV.NUXT_TEST === true;

  return {
    environment,
    isDebug,
    isProd,
    isPreview,
    isDev,
    isTest
  };
}

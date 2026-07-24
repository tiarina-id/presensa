import { loadEnv, getSslConfig, type AppEnv } from "./env";

let _env: AppEnv | null = null;

export function getEnv(): AppEnv {
  if (!_env) {
    _env = loadEnv();
  }
  return _env;
}

export function getDatabaseSslConfig() {
  return getSslConfig(getEnv());
}

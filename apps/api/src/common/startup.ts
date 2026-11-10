import { validateEnvironment, StartupConfigurationError } from './config/env.schema';

export { StartupConfigurationError };

export function validateStartupEnvironment(): void {
  validateEnvironment(process.env);
}

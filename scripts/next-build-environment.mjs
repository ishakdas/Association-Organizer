export function buildNextEnvironment(environment) {
  return { ...environment, NODE_ENV: 'production' };
}

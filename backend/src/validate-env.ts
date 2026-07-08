const numericVars = [
  'PORT',
  'DB_ZABBIX_PORT',
  'DB_GLPI_PORT',
  'SMTP_PORT',
] as const;
const validNodeEnvs = ['development', 'test', 'production'];

const errors: string[] = [];

for (const key of numericVars) {
  const value = process.env[key];
  if (value !== undefined && value !== '' && Number.isNaN(Number(value))) {
    errors.push(`${key} must be a number, got "${value}"`);
  }
}

if (
  process.env.NODE_ENV !== undefined &&
  !validNodeEnvs.includes(process.env.NODE_ENV)
) {
  errors.push(
    `NODE_ENV must be one of ${validNodeEnvs.join(', ')}, got "${process.env.NODE_ENV}"`,
  );
}

if (errors.length > 0) {
  console.error('Invalid environment configuration:\n- ' + errors.join('\n- '));
  process.exit(1);
}

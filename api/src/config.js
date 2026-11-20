// Configuración leída del entorno. Sin valores por defecto para secretos.
const required = (name) => {
  const v = process.env[name];
  if (!v) throw new Error(`Falta la variable de entorno ${name}`);
  return v;
};

const IDENT = /^[a-z_][a-z0-9_]*$/;

export const config = {
  port: Number(process.env.PORT ?? 3000),
  dbDir: process.env.DB_DIR ?? '/app/db',
  filesDir: process.env.FILES_DIR ?? '/data/files',
  db: {
    host: process.env.DB_HOST ?? 'db',
    port: Number(process.env.DB_PORT ?? 5432),
    database: required('POSTGRES_DB'),
    ownerUser: required('POSTGRES_USER'),
    ownerPassword: required('POSTGRES_PASSWORD'),
    appUser: required('APP_DB_USER'),
    appPassword: required('APP_DB_PASSWORD'),
  },
  sessionSecret: required('SESSION_SECRET'),
  cookieSecure: process.env.COOKIE_SECURE === 'true',
  sessionIdleHours: 12,
  // Ingreso único desde el portal (RS256, kit de login-central). Sin SSO_JWKS_URL queda desactivado.
  sso: {
    issuer: process.env.SSO_ISSUER || null,
    jwksUrl: process.env.SSO_JWKS_URL || null,
    audience: process.env.SSO_AUDIENCE || 'wiki',
    portalUrl: process.env.SSO_PORTAL_URL || null, // origen exacto del portal (anti-CSRF y enlace "sin acceso")
    inicioUrl: process.env.WIKI_INICIO_URL || '/wiki/', // relativo: el nginx de ecodatos quita /wiki/
  },
  portalUrl: process.env.PORTAL_URL || null,
  vaultwardenUrl: process.env.VAULTWARDEN_URL || null,
  adminEmail: process.env.ADMIN_EMAIL || null,
  adminPasswordInicial: process.env.ADMIN_PASSWORD_INICIAL || null,
  passwordMinLength: 12,
};

if (config.sessionSecret.length < 32) {
  throw new Error('SESSION_SECRET debe tener al menos 32 caracteres');
}
if (config.sso.jwksUrl && (!config.sso.issuer || !config.sso.portalUrl)) {
  throw new Error('Con SSO_JWKS_URL también hay que definir SSO_ISSUER y SSO_PORTAL_URL');
}
if (!IDENT.test(config.db.appUser)) {
  throw new Error('APP_DB_USER solo admite minúsculas, números y guion bajo');
}
if (config.db.appUser === config.db.ownerUser) {
  throw new Error('APP_DB_USER debe ser distinto de POSTGRES_USER');
}

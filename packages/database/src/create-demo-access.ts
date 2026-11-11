/**
 * CLI: mints a one-click demo link for a prospect.
 *
 * Usage:
 *   pnpm demo:create --email=prospecto@acme.com --name="Acme S.A." --contact="Juan Pérez"
 *
 * It calls the API endpoint `POST /demo/access` (protected by the internal
 * API key), which is the same path the sales tooling uses. The API must be
 * running.
 *
 * Environment:
 *   API_URL           base URL of the API (default http://localhost:4000)
 *   INTERNAL_API_KEY  internal key of the API (required)
 */

type Args = {
  email?: string;
  name?: string;
  contact?: string;
};

function parseArgs(argv: string[]): Args {
  const args: Args = {};
  for (const raw of argv) {
    const match = raw.match(/^--([^=]+)(?:=(.*))?$/);
    if (!match) continue;
    const [, key, value] = match;
    args[key as keyof Args] = value ?? 'true';
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (!args.email) {
    console.error('Falta --email. Ejemplo:');
    console.error('  pnpm demo:create --email=prospecto@acme.com --name="Acme S.A."');
    process.exit(1);
  }

  const apiUrl = (process.env.API_URL || 'http://localhost:4000').replace(/\/$/, '');
  const internalApiKey = process.env.INTERNAL_API_KEY;

  if (!internalApiKey) {
    console.error('Falta INTERNAL_API_KEY (la API lo usa para proteger este endpoint).');
    process.exit(1);
  }

  const response = await fetch(`${apiUrl}/api/v1/demo/access`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-internal-api-key': internalApiKey,
    },
    body: JSON.stringify({
      email: args.email,
      ...(args.name ? { name: args.name } : {}),
      ...(args.contact ? { contactName: args.contact } : {}),
    }),
  });

  const body = (await response.json().catch(() => null)) as {
    error?: { message?: string };
    data?: Record<string, string>;
  } | null;

  if (!response.ok) {
    console.error(`No se pudo crear la demo (HTTP ${response.status}):`);
    console.error(body?.error?.message ?? JSON.stringify(body));
    process.exit(1);
  }

  const grant = body?.data;
  if (!grant) {
    console.error('La API no devolvió los datos de la demo.');
    process.exit(1);
  }

  console.log('');
  console.log('✅ Demo creada');
  console.log(`  Prospecto:  ${grant.email}`);
  console.log(`  Tenant:      ${grant.slug}`);
  console.log(`  Expira:      ${grant.expiresAt}`);
  console.log('');
  console.log('  Link para el prospecto (un click, sin password):');
  console.log(`  ${grant.url}`);
  console.log('');
  console.log(`  Login alternativo: ${grant.email} / ${grant.password}`);
  console.log('');
  console.log('  El acceso se corta exactamente al vencer la fecha de expiración.');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

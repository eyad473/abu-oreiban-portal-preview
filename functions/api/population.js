// Deploy behind Cloudflare Access. Use an application AUD dedicated to approved institutions.
const reply = (body, status = 200) => Response.json(body, {
  status, headers: { 'Cache-Control': 'private, no-store', 'X-Robots-Tag': 'noindex' }
});
const decode = value => Uint8Array.from(atob(value.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
async function authorized(request, env) {
  const issuer = env.ACCESS_ISSUER;
  if (!/^https:\/\/[a-z0-9-]+\.cloudflareaccess\.com$/.test(issuer) || !env.ACCESS_AUD) return false;
  const token = request.headers.get('Cf-Access-Jwt-Assertion') || '';
  const parts = token.split('.');
  if (parts.length !== 3) return false;
  try {
    const [header, claims] = parts.slice(0, 2).map(p => JSON.parse(new TextDecoder().decode(decode(p))));
    const now = Date.now() / 1000;
    if (header.alg !== 'RS256' || claims.iss !== issuer || !Array.isArray(claims.aud) ||
        !claims.aud.includes(env.ACCESS_AUD) || !Number.isFinite(claims.exp) || claims.exp <= now ||
        claims.nbf > now || !claims.email) return false;
    const response = await fetch(issuer + '/cdn-cgi/access/certs', {cf:{cacheTtl:300,cacheEverything:true}});
    if (!response.ok) return false;
    const {keys} = await response.json();
    const jwk = keys.find(k => k.kid === header.kid && k.kty === 'RSA');
    if (!jwk) return false;
    const key = await crypto.subtle.importKey('jwk', jwk, {name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'}, false, ['verify']);
    return crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, decode(parts[2]), new TextEncoder().encode(parts.slice(0,2).join('.')));
  } catch { return false; }
}
export async function onRequestGet({request,env}) {
  if (!await authorized(request, env)) return reply({error:'access_required'},403);
  const group = new URL(request.url).searchParams.get('group');
  if (!['adult','child','school','older'].includes(group)) return reply({error:'invalid_group'},400);
  try {
    const snapshot = await env.AGE_RELEASES.get('approved-age-counts', 'json');
    if (!snapshot || !Number.isFinite(Date.parse(snapshot.asOf)) || Date.parse(snapshot.asOf)>Date.now() ||
        Date.now()-Date.parse(snapshot.asOf)>86400000) return reply({error:'unavailable'},503);
    const min = Number(env.MIN_CELL);
    const cells = snapshot.cells;
    if (!Number.isSafeInteger(min) || min < 2 || !Array.isArray(cells) || cells.length !== 5 ||
        !cells.every(n=>Number.isSafeInteger(n) && n>=0)) return reply({error:'unavailable'},503);
    if (cells.some(n=>n<min)) return reply({suppressed:true,asOf:snapshot.asOf});
    const [under5,school,teen,adult,older] = cells;
    return reply({count:({adult:adult+older,child:under5+school+teen,school,older})[group],asOf:snapshot.asOf});
  } catch {return reply({error:'unavailable'},503);}
}

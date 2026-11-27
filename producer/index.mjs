// A scheduled job with no HTTP handler. Reads only the active population record namespace.
// Identifier or birth-date ambiguities block release until they are reconciled at source.
export const sql = `WITH raw AS (
 SELECT CASE WHEN json_valid(data_json) THEN json_extract(data_json,'$."رقم هوية الفرد"') END AS ident,
 CASE WHEN json_valid(data_json) THEN json_extract(data_json,'$."تاريخ الميلاد"') END AS dob
 FROM sync_records WHERE deleted=0 AND record_id GLOB 'r-*'
), normalized AS (
 SELECT trim(CAST(ident AS TEXT)) AS id,trim(dob) AS born FROM raw
), persons AS (
 SELECT id,min(born) AS born,
 max(CASE WHEN id IS NULL OR length(id)<>9 OR id GLOB '*[^0-9]*' OR born IS NULL
 OR born NOT GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]' OR
 date(born,'+0 days') IS NOT born OR born>?1 THEN 1 ELSE 0 END) AS invalid,
 count(DISTINCT born) AS variants FROM normalized GROUP BY id
), ages AS (
 SELECT cast(substr(?1,1,4) AS integer)-cast(substr(born,1,4) AS integer)
 -(substr(?1,6)<substr(born,6)) AS age,invalid,variants FROM persons
) SELECT count(*) AS total, sum(invalid OR variants<>1) AS errors,
 sum(age<5) AS a,sum(age BETWEEN 5 AND 12) AS b,sum(age BETWEEN 13 AND 17) AS c,
 sum(age BETWEEN 18 AND 59) AS d,sum(age>=60) AS e FROM ages`;
export default {async scheduled(event,env) {
 const now = new Date(event.scheduledTime);
 const day = new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Gaza',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
 const row = await env.MOOOD.prepare(sql).bind(day).first();
 if (!row || row.errors || !row.total) {
   await env.AGE_RELEASES.delete('approved-age-counts');
   return;
 }
 if(env.RELEASE_ENABLED !== 'true') return;
 await env.AGE_RELEASES.put('approved-age-counts',JSON.stringify({asOf:now.toISOString(),cells:[row.a,row.b,row.c,row.d,row.e]}),{expirationTtl:86400});
}};

## Deployment and reconciliation

Deploy index.mjs as a separate scheduled Cloudflare Worker in the Moood account. The Pages application receives only the AGE_RELEASES KV binding. Give the scheduled Worker the same KV namespace and a MOOOD binding to the existing D1 database. This code issues one fixed SELECT. D1 bindings themselves permit writes, so restrict Worker deployment privileges to trusted administrators. No HTTP route is needed for this Worker.

Before enabling the daily cron and RELEASE_ENABLED=true, compare all five disjoint counts to the administration's dated register. The first version accepts nine ASCII digits and complete ISO birth dates only. Any unsupported or conflicting identity/date blocks the release. Review any archive conventions beyond the deleted flag before enabling release. Configure both publishers and readers to use the same namespace. On revocation delete the released KV key; KV changes may take time to propagate.

Protect /api/population with a Cloudflare Access application limited to approved institutions. Set ACCESS_ISSUER to the team's HTTPS cloudflareaccess.com origin, ACCESS_AUD to this application's audience and MIN_CELL to the approved minimum. Configure query rate limiting on this route. Test the production Access login flow and a denied account. Disable shared caching for this route. Keep the source database and credentials off the Pages frontend.

The four presets use all registered people with confirmed dates. No real totals are expected until the account owner completes bindings, Access configuration and reconciliation.

GA-PICK redirect-loop fix

Cause:
Cloudflare Static Assets defaults html_handling to auto-trailing-slash.
The Worker requested /index.html through ASSETS; the asset service redirected it to /,
then the Worker requested /index.html again, causing ERR_TOO_MANY_REDIRECTS.

Fix:
- assets.html_handling = "none"
- assets.not_found_handling = "none"
- app shell asset fetch uses redirect: manual and returns a diagnostic 500 instead of looping

Deploy this ZIP to the ga-pick.com public Worker project.
Keep existing D1/R2 bindings and Secrets.

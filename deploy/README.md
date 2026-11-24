# SaaS frontend deployment

The browser uses a same-origin `/api` base URL by default. Configure the web server to proxy
`/api/` to the backend; an example Nginx site is in `nginx-site.conf.example`.

For a deployment that serves the API from another origin, update
`src/assets/runtime-config.js` on the deployed frontend to set the HTTPS API base URL.
This file is loaded before Angular starts, so changing it does not require rebuilding the app.

For Angular SSR, set `API_URL` in the Node process environment to an absolute backend URL.
The local fallback is `http://127.0.0.1:1111/api`.

The development server uses `proxy.conf.json` and forwards `/api` to
`http://localhost:1111`.

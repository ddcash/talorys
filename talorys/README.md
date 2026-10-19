# Your Talorys deployment

This directory was created by `create-talorys` and identifies your deployment
(`weubbr9y`). Keep it — it contains no secrets, but the
installer uses `talorys.json` to find your Cloudflare resources.

| Resource | Name |
| --- | --- |
| Agent Worker (private) | `talorys-weubbr9y-agent` |
| Pages project | `talorys-weubbr9y-web` |

Commands (run inside this directory):

- `npx create-talorys@latest update` — update to the latest version (keeps all data)
- `npx create-talorys@latest status` — show deployment status
- `npx create-talorys@latest doctor` — diagnose problems
- `npx create-talorys@latest reset-password` — set a new owner password

Your data lives in a Durable Object inside your Cloudflare account, not in this folder.
Use Settings → Privacy → Export in the app to download a backup.

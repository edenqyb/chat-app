# PixelChat

A tiny local chat app for two. Messages are stored
in Postgres so history persists across restarts.

## Run it

One of you runs this (whoever's laptop stays on / has the better connection):

```bash
docker compose up --build
```

This starts 3 containers:
- `db` — Postgres, stores messages
- `backend` — FastAPI, serves the websocket chat + message history on port `8000`
- `frontend` — nginx serving the UI on port `8080`

## How you both connect

Both of you are on the **same local network**.

1. On the machine running `docker compose`, find its local IP:
   - macOS/Linux: `ifconfig | grep inet` or `ip a`
   - Windows: `ipconfig` → look for "IPv4 Address" (e.g. `192.168.1.42`)

2. Both of you open a browser to:
   ```
   http://<that-machine's-LAN-IP>:8080
   ```
   e.g. `http://192.168.1.42:8080`

   The person actually running docker compose can also just use
   `http://localhost:8080`.

3. Type a name, hit **JOIN CHAT**, and start messaging. The frontend
   automatically talks to the backend on port `8000` on the same host.

## Notes

- Firewall: if the other person can't connect, make sure the host machine's
  firewall allows inbound connections on ports `8000` and `8080` on the
  local network.
- Data persists in a Docker volume (`pixelchat_data`), so `docker compose
  down` + `up` again keeps your message history. Use `docker compose down -v`
  if you ever want to wipe it.
- To stop: `docker compose down`.

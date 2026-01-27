# 网络配置与公网联机指南

本项目的联机基于 WebSocket（默认端口 7777）。要在不同网络（WAN/公网）联机，需要让客户端能访问到服务器公网地址。

## ✅ 方案一：公网服务器（推荐）

1. 准备一台公网服务器（VPS/云主机）。
2. 在服务器上运行后端：

```bash
cd backend/server
npm install
node index.js
```

3. 开放防火墙端口：
   - WebSocket：`7777`
   - 前端静态页：`8080`（如果你也托管前端）

客户端连接：
- WebSocket：`ws://<公网IP>:7777`
- 前端：`http://<公网IP>:8080`

## ✅ 方案二：家庭路由器端口转发

1. 在路由器设置端口转发，将 **公网IP:7777 → 内网主机:7777**。
2. 开放防火墙端口（Windows 防火墙/安全组）。
3. 客户端使用公网 IP 连接：

```
ws://<公网IP>:7777
```

如果你的公网 IP 会变化，建议使用 DDNS。

## 🔒 HTTPS + WSS（推荐用于公网）

当你使用 `https://` 访问前端时，浏览器要求 WebSocket 使用 `wss://`。
建议使用反向代理（Caddy / Nginx）做 TLS 终止。

### Caddy 示例（最简单）

```
game.example.com {
  reverse_proxy /ws* 127.0.0.1:7777
  reverse_proxy 127.0.0.1:8080
}
```

客户端连接：
- 前端：`https://game.example.com`
- WebSocket：`wss://game.example.com/ws`

### Nginx 示例

```
server {
  listen 443 ssl;
  server_name game.example.com;

  ssl_certificate /path/fullchain.pem;
  ssl_certificate_key /path/privkey.pem;

  location /ws {
    proxy_pass http://127.0.0.1:7777;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
  }

  location / {
    proxy_pass http://127.0.0.1:8080;
  }
}
```

## 🔧 常见排查

- 客户端无法连接：检查公网 IP、端口转发、防火墙、安全组。
- 连接后立即断开：检查后端是否在运行、日志是否报错。
- https 页面无法 ws：改用 `wss://` 或配置反向代理。

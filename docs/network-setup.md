# 网络配置指南

本指南帮助你配置网络，使不在同一局域网的玩家能够连接到你的游戏服务器。

## 目录

- [前提条件](#前提条件)
- [方案对比](#方案对比)
- [方案一：ngrok 内网穿透（推荐新手）](#方案一ngrok-内网穿透推荐新手)
- [方案二：ZeroTier 虚拟局域网（推荐长期使用）](#方案二zerotier-虚拟局域网推荐长期使用)
- [方案三：路由器端口转发](#方案三路由器端口转发)
- [方案四：云服务器部署](#方案四云服务器部署)
- [常见问题](#常见问题)
- [安全注意事项](#安全注意事项)

---

## 前提条件

在开始之前，确保你已经：

1. **后端服务器可以本地运行**
   ```bash
   cd backend/server
   npm install
   node index.js
   # 看到: Board Game Server running on ws://localhost:7777
   ```

2. **前端可以本地访问**
   ```bash
   cd frontend
   npm install
   npm run dev
   # 访问: http://localhost:5173
   ```

3. **本地测试联机正常**
   - 在浏览器打开两个标签页
   - 一个创建房间，一个加入房间
   - 确认本地联机功能正常

---

## 方案对比

| 方案 | 难度 | 成本 | 速度 | 稳定性 | 适用场景 |
|------|------|------|------|--------|----------|
| ngrok | ★☆☆ | 免费/付费 | 中等 | 中等 | 临时测试、偶尔联机 |
| ZeroTier | ★☆☆ | 免费 | 快 | 高 | 固定玩家群、长期使用 |
| 端口转发 | ★★☆ | 免费 | 最快 | 高 | 有公网IP的用户 |
| 云服务器 | ★★☆ | 付费 | 快 | 最高 | 正式部署、24/7运行 |

---

## 方案一：ngrok 内网穿透（推荐新手）

**优点**：无需配置路由器，5分钟搞定，免费版够用
**缺点**：免费版地址每次重启会变，有带宽限制

### 步骤 1：注册并下载 ngrok

1. 访问 [ngrok.com](https://ngrok.com/)
2. 点击 **Sign up** 注册免费账号
3. 登录后，进入 [Dashboard](https://dashboard.ngrok.com/get-started/setup)
4. 下载对应系统的 ngrok：
   - **Windows**: 下载 zip，解压到任意目录（如 `C:\ngrok\`）
   - **macOS**: `brew install ngrok` 或下载 zip
   - **Linux**: `snap install ngrok` 或下载 tar.gz

### 步骤 2：配置 ngrok authtoken

1. 在 ngrok Dashboard 找到你的 **Authtoken**
2. 打开终端，运行：
   ```bash
   # Windows (在 ngrok.exe 所在目录)
   ngrok config add-authtoken YOUR_AUTH_TOKEN

   # macOS / Linux
   ngrok config add-authtoken YOUR_AUTH_TOKEN
   ```

### 步骤 3：启动后端服务器

```bash
cd backend/server
node index.js
# 输出: Board Game Server running on ws://localhost:7777
```

### 步骤 4：启动 ngrok 隧道

**新开一个终端**，运行：

```bash
# Windows
C:\ngrok\ngrok.exe tcp 7777

# macOS / Linux
ngrok tcp 7777
```

成功后会显示类似：

```
Session Status    online
Account           your@email.com (Plan: Free)
Forwarding        tcp://0.tcp.ngrok.io:12345 -> localhost:7777
```

### 步骤 5：分享给玩家

1. 复制 **Forwarding** 地址：`tcp://0.tcp.ngrok.io:12345`
2. 玩家连接时，WebSocket 地址填写：`ws://0.tcp.ngrok.io:12345`

### 步骤 6：前端也需要公网访问（可选）

如果玩家也需要访问你的前端页面：

```bash
# 新开终端，为前端也创建隧道
ngrok http 5173
```

或者让玩家自己下载前端代码本地运行，只连接你的 WebSocket 服务器。

### ngrok 常见问题

**Q: 每次重启地址都变？**
A: 免费版的限制。付费版（$8/月起）可以固定域名。或者使用 ZeroTier 方案。

**Q: 连接超时？**
A: 检查 ngrok 是否还在运行，免费版有 8 小时会话限制。

---

## 方案二：ZeroTier 虚拟局域网（推荐长期使用）

**优点**：免费、稳定、IP固定、所有玩家像在同一局域网
**缺点**：所有玩家都需要安装客户端

### 步骤 1：创建 ZeroTier 网络

1. 访问 [my.zerotier.com](https://my.zerotier.com/)
2. 注册账号并登录
3. 点击 **Create A Network**
4. 记下你的 **Network ID**（16位十六进制，如 `a1b2c3d4e5f67890`）

### 步骤 2：配置网络（重要）

1. 点击你创建的网络，进入设置页面
2. 在 **Access Control** 部分，选择 **Private**（需要手动授权）或 **Public**（任何人可加入）
3. 在 **IPv4 Auto-Assign** 部分：
   - 勾选 **Auto-Assign from Range**
   - 选择一个网段，如 `10.147.17.*`

### 步骤 3：所有玩家安装 ZeroTier 客户端

**主机端和所有玩家都需要安装**：

- **Windows**: [下载地址](https://www.zerotier.com/download/)，安装后系统托盘会出现图标
- **macOS**: `brew install zerotier-one` 或官网下载
- **Linux**:
  ```bash
  curl -s https://install.zerotier.com | sudo bash
  ```
- **Android/iOS**: 应用商店搜索 ZeroTier One

### 步骤 4：加入网络

**每个玩家执行**：

```bash
# Windows (管理员权限运行 cmd)
zerotier-cli join YOUR_NETWORK_ID

# macOS / Linux
sudo zerotier-cli join YOUR_NETWORK_ID

# 或者在客户端 GUI 中点击 Join Network，输入 Network ID
```

### 步骤 5：授权成员（如果是 Private 网络）

1. 回到 [my.zerotier.com](https://my.zerotier.com/) 的网络设置页面
2. 在 **Members** 部分，你会看到所有申请加入的设备
3. 勾选 **Auth** 复选框授权每个设备
4. 记下每个设备的 **Managed IP**（如 `10.147.17.1`）

### 步骤 6：启动服务器并连接

**主机端**：
```bash
cd backend/server
node index.js
```

**玩家连接**：
- 主机告诉玩家自己的 ZeroTier IP（如 `10.147.17.1`）
- 玩家连接时填写：`ws://10.147.17.1:7777`

### ZeroTier 常见问题

**Q: 显示 OFFLINE？**
A: 检查 ZeroTier 服务是否运行，Windows 看系统托盘，Linux 运行 `sudo systemctl status zerotier-one`

**Q: 连不上其他成员？**
A: 确认双方都已授权（Auth 勾选），可以互相 ping 测试：`ping 10.147.17.x`

---

## 方案三：路由器端口转发

**优点**：最快、最稳定、完全免费
**缺点**：需要有公网IP、需要配置路由器

### 前提：确认你有公网 IP

1. 访问 [whatismyip.com](https://www.whatismyip.com/) 记下你的公网 IP
2. 在路由器管理页面查看 WAN IP
3. 如果两者相同，你有公网 IP；如果不同，你在 NAT 后面，需要联系运营商要公网 IP 或使用其他方案

### 步骤 1：设置电脑静态内网 IP

为了端口转发稳定工作，你的电脑需要固定内网 IP：

**Windows**:
1. 打开 **设置 > 网络和 Internet > 以太网/Wi-Fi > 属性**
2. 点击 **IP 分配** 旁边的 **编辑**
3. 选择 **手动**，开启 **IPv4**
4. 设置：
   - IP 地址：`192.168.1.100`（或你网段的一个未用地址）
   - 子网掩码：`255.255.255.0`
   - 网关：`192.168.1.1`（你的路由器地址）
   - DNS：`8.8.8.8`

**macOS**:
1. 打开 **系统偏好设置 > 网络**
2. 选择你的网络连接，点击 **高级 > TCP/IP**
3. 配置 IPv4：**手动**
4. 设置 IP、子网掩码、路由器地址

### 步骤 2：配置路由器端口转发

不同路由器界面不同，一般步骤：

1. 浏览器访问路由器管理页面（通常是 `192.168.1.1` 或 `192.168.0.1`）
2. 登录管理界面
3. 找到 **端口转发 / Port Forwarding / 虚拟服务器** 设置
4. 添加规则：

| 服务名称 | 外部端口 | 内部端口 | 内部IP | 协议 |
|----------|----------|----------|--------|------|
| GameServer | 7777 | 7777 | 192.168.1.100 | TCP |

5. 保存设置

### 步骤 3：配置防火墙

**Windows 防火墙**:
1. 打开 **Windows Defender 防火墙 > 高级设置**
2. 点击 **入站规则 > 新建规则**
3. 选择 **端口 > TCP > 特定端口: 7777**
4. 选择 **允许连接**
5. 命名为 "Board Game Server"

**Linux (ufw)**:
```bash
sudo ufw allow 7777/tcp
```

### 步骤 4：测试并分享

1. 启动服务器：`node index.js`
2. 让朋友访问你的公网 IP：`ws://YOUR_PUBLIC_IP:7777`
3. 可以用 [canyouseeme.org](https://canyouseeme.org/) 测试端口是否开放

### 端口转发常见问题

**Q: 端口检测显示关闭？**
A: 检查：1) 服务器是否运行 2) 防火墙是否放行 3) 路由器规则是否正确 4) 是否有公网 IP

**Q: 运营商封锁端口？**
A: 有些运营商封锁常用端口，尝试改用高位端口（如 17777），修改 `backend/server/config.js` 中的端口配置。

---

## 方案四：云服务器部署

**优点**：24/7 稳定运行、公网可访问、专业级方案
**缺点**：需要付费（最低约 $5/月）

### 推荐云服务商

| 服务商 | 最低价格 | 推荐配置 |
|--------|----------|----------|
| [Vultr](https://www.vultr.com/) | $5/月 | 1 vCPU, 1GB RAM |
| [DigitalOcean](https://www.digitalocean.com/) | $6/月 | 1 vCPU, 1GB RAM |
| [阿里云](https://www.aliyun.com/) | ¥24/月起 | 1 vCPU, 1GB RAM |
| [腾讯云](https://cloud.tencent.com/) | ¥30/月起 | 1 vCPU, 1GB RAM |

### 步骤 1：创建云服务器

1. 注册云服务商账号
2. 创建云服务器实例：
   - **系统**: Ubuntu 22.04 LTS（推荐）
   - **配置**: 1 vCPU, 1GB RAM 足够
   - **区域**: 选择离玩家近的区域
3. 记下服务器公网 IP

### 步骤 2：连接服务器

```bash
# 使用 SSH 连接（Windows 可用 PuTTY 或 Windows Terminal）
ssh root@YOUR_SERVER_IP
```

### 步骤 3：安装 Node.js

```bash
# 更新系统
apt update && apt upgrade -y

# 安装 Node.js 18.x
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt install -y nodejs

# 验证安装
node --version  # 应该显示 v18.x.x
npm --version
```

### 步骤 4：部署后端

```bash
# 克隆项目
git clone https://github.com/your-org/board-game-client.git
cd board-game-client/backend/server

# 安装依赖
npm install

# 测试运行
node index.js
# Ctrl+C 停止
```

### 步骤 5：配置防火墙

```bash
# 开放端口
ufw allow 22/tcp    # SSH
ufw allow 7777/tcp  # WebSocket
ufw enable
```

如果使用云服务商的安全组，也需要在控制台添加入站规则放行 7777 端口。

### 步骤 6：使用 PM2 守护进程

```bash
# 安装 PM2
npm install -g pm2

# 启动服务器
cd ~/board-game-client/backend/server
pm2 start index.js --name "game-server"

# 设置开机自启
pm2 startup
pm2 save

# 查看状态
pm2 status
pm2 logs game-server
```

### 步骤 7：连接游戏

玩家连接时填写：`ws://YOUR_SERVER_IP:7777`

### 云服务器常见问题

**Q: 服务器重启后连不上？**
A: 检查 PM2 是否配置了开机自启：`pm2 startup`

**Q: 想要域名访问？**
A: 购买域名后，添加 A 记录指向服务器 IP，然后使用域名连接。

---

## 常见问题

### 连接相关

**Q: WebSocket 连接失败？**
A: 检查：
1. 服务器是否运行（终端有输出）
2. 地址格式是否正确（`ws://` 开头，不是 `http://`）
3. 端口是否正确（默认 7777）
4. 防火墙是否放行

**Q: 连接成功但游戏不同步？**
A:
1. 检查是否所有玩家都加入了同一个房间 ID
2. 查看浏览器控制台是否有错误
3. 确认后端服务器版本与前端版本匹配

**Q: 延迟很高？**
A:
1. 检查网络质量（ping 服务器）
2. 如果使用 ngrok 免费版，尝试升级或换用 ZeroTier
3. 考虑选择地理位置更近的服务器

### 特定方案问题

**Q: ngrok 报错 ERR_NGROK_xxxx？**
A: 检查 authtoken 是否配置正确，或尝试重新安装 ngrok。

**Q: ZeroTier 设备一直 OFFLINE？**
A:
1. 确认服务正在运行
2. 检查网络是否封锁 UDP（ZeroTier 使用 UDP 9993）
3. 尝试重新加入网络

**Q: 端口转发不生效？**
A:
1. 确认内网 IP 设置正确
2. 有些路由器需要重启才生效
3. 检查是否有多层 NAT（光猫+路由器）

---

## 安全注意事项

1. **不要暴露不必要的端口** - 只开放游戏需要的 7777 端口

2. **定期更新** - 保持 Node.js 和依赖包更新

3. **使用防火墙** - 配置防火墙限制不必要的入站连接

4. **云服务器安全**:
   - 使用 SSH 密钥而非密码登录
   - 禁用 root SSH 登录
   - 配置 fail2ban 防止暴力破解

5. **ngrok 安全** - 免费版地址会变，不要分享给不信任的人

6. **ZeroTier 安全** - 使用 Private 网络模式，手动授权成员

---

## 需要帮助？

如果按照本指南仍无法成功配置，请：

1. 检查 [常见问题](#常见问题) 部分
2. 在项目 Issues 中搜索类似问题
3. 创建新 Issue，提供：
   - 使用的方案
   - 操作系统
   - 错误信息截图
   - 已尝试的步骤

---

*最后更新: 2026-01-29*

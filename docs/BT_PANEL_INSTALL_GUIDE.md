# 宝塔面板安装教程

> 宝塔面板是一款简单好用的 Linux/Windows 服务器运维管理面板，支持一键部署 LNMP/LAMP、网站、数据库、FTP、SSL 等功能。

---

## 📋 目录

1. [环境要求](#环境要求)
2. [安装前准备](#安装前准备)
3. [各系统安装命令](#各系统安装命令)
4. [安装后配置](#安装后配置)
5. [基本使用](#基本使用)
6. [Docker 环境安装](#docker-环境安装)
7. [常见问题](#常见问题)

---

## 环境要求

### 最低配置要求

| 项目 | 要求 |
|------|------|
| 内存 | 512MB+（推荐 1GB+） |
| 硬盘 | 20GB+ 可用空间 |
| 系统 | CentOS 7+/Ubuntu 18+/Debian 10+ |
| 网络 | 可访问外网（用于下载组件） |

### 支持的系统版本

- **CentOS**: 7.x, 8.x, 9.x（推荐 7.9+）
- **Ubuntu**: 18.04, 20.04, 22.04, 24.04（推荐 20.04/22.04）
- **Debian**: 10, 11, 12（推荐 11+）
- ** AlmaLinux / RockyLinux**: 8.x, 9.x

---

## 安装前准备

### 1. 更新系统

```bash
# CentOS
yum update -y

# Ubuntu/Debian
apt update && apt upgrade -y
```

### 2. 关闭 SELinux（CentOS）

```bash
# 临时关闭
setenforce 0

# 永久关闭
sed -i 's/SELINUX=enforcing/SELINUX=disabled/g' /etc/selinux/config
```

### 3. 开放端口

确保以下端口未被防火墙阻挡：

| 端口 | 用途 |
|------|------|
| 8888 | 宝塔面板主端口 |
| 888 | phpMyAdmin（可选） |
| 80 | HTTP |
| 443 | HTTPS |
| 22 | SSH（默认） |
| 3306 | MySQL（可选） |
| 6379 | Redis（可选） |

```bash
# 关闭防火墙（测试环境，生产环境建议只开放必要端口）
# CentOS
systemctl stop firewalld
systemctl disable firewalld

# Ubuntu/Debian
ufw disable

# 或者只开放特定端口
# CentOS
firewall-cmd --permanent --add-port=8888/tcp
firewall-cmd --permanent --add-port=80/tcp
firewall-cmd --permanent --add-port=443/tcp
firewall-cmd --reload

# Ubuntu/Debian
ufw allow 8888/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw reload
```

### 4. 检查主机名

```bash
# 查看当前主机名
hostname

# 如需要，设置主机名
hostnamectl set-hostname your-hostname
```

---

## 各系统安装命令

### 🚀 一键安装脚本（推荐）

```bash
# 官方安装脚本（自动识别系统）
url=https://download.bt.cn/install/install_lts.sh;if [ -f /usr/bin/curl ];then curl -sSO $url;else wget -O install_lts.sh $url;fi;bash install_lts.sh ed8484bec
```

> **注意：** 安装完成后会显示面板地址、用户名和密码，**请务必保存**！

---

### CentOS 安装

```bash
# CentOS 7/8/9 通用
yum install -y wget && wget -O install.sh https://download.bt.cn/install/install_lts.sh && sh install.sh ed8484bec
```

---

### Ubuntu 安装

```bash
# Ubuntu 18.04/20.04/22.04/24.04
wget -O install.sh https://download.bt.cn/install/install_lts.sh && sudo bash install.sh ed8484bec
```

---

### Debian 安装

```bash
# Debian 10/11/12
wget -O install.sh https://download.bt.cn/install/install_lts.sh && bash install.sh ed8484bec
```

---

### 中国境内服务器（使用镜像加速）

```bash
# 使用国内镜像源加速下载
url=https://download.bt.cn/install/install_lts.sh;wget -O install_lts.sh $url;bash install_lts.sh ed8484bec --mirror CN
```

---

## 安装后配置

### 1. 查看面板信息

安装完成后，终端会显示类似以下信息：

```
===============================================
Congratulations! Installed successfully!
===============================================
外网面板地址: http://123.123.123.123:8888/abc123
内网面板地址: http://192.168.1.100:8888/abc123
username: admin
password: 1234567890
===============================================
```

**如果忘记保存，可以通过以下命令查看：**

```bash
bt default
```

**修改面板密码：**

```bash
bt 5
```

**修改面板端口：**

```bash
bt 8
```

---

### 2. 首次登录配置

1. **访问面板**
   - 浏览器打开：`http://服务器IP:8888/安全入口`
   - 安全入口是随机生成的，如 `/abc123`

2. **绑定账号**
   - 需要注册/登录宝塔账号才能使用
   - 注册地址：https://www.bt.cn/

3. **选择安装套件**
   首次登录会提示安装 Web 环境套件，推荐选择：

   | 套件 | 说明 |
   |------|------|
   | **LNMP** | Nginx + MySQL + PHP（推荐，性能更好） |
   | **LAMP** | Apache + MySQL + PHP |

   **推荐版本组合：**
   - Nginx: 1.24+
   - MySQL: 8.0（或 5.7）
   - PHP: 8.0/8.1/8.2
   - phpMyAdmin: 5.x

4. **等待安装完成**
   - 安装过程约 10-30 分钟，取决于服务器配置

---

### 3. 安全设置

#### 修改默认端口

```bash
# 使用 bt 命令修改
bt 8
# 输入新端口，如 8889
```

或在面板中：**面板设置 → 端口**

#### 修改安全入口

**面板设置 → 安全入口**，修改为自定义字符串

#### 绑定域名访问

**面板设置 → 域名**，绑定域名后只能通过域名访问

#### 开启 SSL

**面板设置 → 面板 SSL**，申请 Let's Encrypt 证书

#### 设置 IP 白名单

**安全 → 面板监控**，设置允许访问的 IP

---

## 基本使用

### 常用 bt 命令

```bash
# 显示所有命令
bt

# 启动面板
bt start

# 停止面板
bt stop

# 重启面板
bt restart

# 查看面板信息（地址、账号密码）
bt default

# 修改面板密码
bt 5

# 修改面板端口
bt 8

# 关闭安全入口
bt 10

# 查看面板日志
bt 12

# 卸载面板
bt 22
```

---

### 部署网站

#### 1. 添加站点

**网站 → 添加站点**

- 填写域名
- 选择 PHP 版本
- 创建 FTP（可选）
- 创建数据库（可选）

#### 2. 上传代码

**方式一：面板文件管理器**
- 进入 `/www/wwwroot/网站目录`
- 上传代码文件

**方式二：FTP**
- 使用 FTP 客户端连接上传

**方式三：Git**
- 面板支持 Git 部署
- **网站 → 设置 → Git**

#### 3. 配置伪静态

**网站 → 设置 → 伪静态**

常用框架规则：

**WordPress:**
```nginx
location /
{
	 try_files $uri $uri/ /index.php?$args;
}

rewrite /wp-admin$ $scheme://$host$uri/ permanent;
```

**Laravel:**
```nginx
location / {
    try_files $uri $uri/ /index.php?$query_string;
}
```

**Next.js (Node):**
```nginx
location / {
    proxy_pass http://localhost:3000;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $host;
    proxy_cache_bypass $http_upgrade;
}
```

---

### 数据库管理

#### 创建数据库

**数据库 → MySQL → 添加数据库**

#### 远程连接设置

```bash
# 1. 放行 MySQL 端口
# 安全 → 放行端口 → 添加 3306

# 2. 修改 MySQL 绑定地址
# 文件 /etc/mysql/mysql.conf.d/mysqld.cnf
# 将 bind-address = 127.0.0.1 改为 0.0.0.0

# 3. 创建远程访问用户
# 数据库 → 权限 → 指定 IP 或 %（所有 IP）
```

---

### SSL 证书配置

#### Let's Encrypt 免费证书

**网站 → 设置 → SSL → Let's Encrypt**

- 选择域名
- 点击申请
- 开启强制 HTTPS

#### 自定义证书

**网站 → 设置 → SSL → 其他证书**

- 粘贴 `.key` 和 `.crt` 内容

---

## Docker 环境安装

### 安装 Docker

宝塔面板 **Docker 管理器** 插件提供可视化安装：

**软件商店 → 运行环境 → Docker管理器 → 安装**

或命令行安装：

```bash
# 官方安装脚本
curl -fsSL https://get.docker.com | bash

# 启动 Docker
systemctl start docker
systemctl enable docker

# 安装 Docker Compose
pip3 install docker-compose
# 或
curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
chmod +x /usr/local/bin/docker-compose
```

### 使用宝塔部署 FlintStudio

```bash
# 1. 进入项目目录
cd /www/wwwroot/

# 2. 克隆项目
git clone https://github.com/Flintcore/FlintStudio.git

# 3. 进入项目
cd FlintStudio

# 4. 复制环境变量
cp .env.example .env

# 5. 编辑 .env 文件，设置必要的环境变量
# INTERNAL_TASK_TOKEN, OPENAI_API_KEY 等

# 6. 启动服务
docker compose up -d

# 7. 查看日志
docker compose logs -f
```

### 配置 Nginx 反向代理

**网站 → 添加站点 → 纯静态**

**设置 → 配置文件**，添加：

```nginx
location / {
    proxy_pass http://localhost:3000;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_cache_bypass $http_upgrade;
}
```

---

## 常见问题

### 1. 安装失败，提示网络错误

**原因：** 服务器无法连接宝塔下载服务器

**解决：**
```bash
# 使用国内镜像
wget -O install.sh https://download.bt.cn/install/install_lts.sh && bash install.sh ed8484bec --mirror CN

# 或检查 DNS 设置
echo "nameserver 8.8.8.8" >> /etc/resolv.conf
echo "nameserver 114.114.114.114" >> /etc/resolv.conf
```

---

### 2. 安装后无法访问面板

**排查步骤：**

```bash
# 1. 检查面板是否运行
bt default

# 2. 检查端口是否监听
netstat -tlnp | grep 8888

# 3. 检查防火墙
firewall-cmd --list-all
ufw status

# 4. 检查安全组（云服务器）
# 登录云服务商控制台，放行 8888 端口

# 5. 检查面板日志
cat /www/server/panel/logs/request/2024-01-01.log
```

---

### 3. 忘记面板密码

```bash
# 查看默认信息
bt default

# 或重置密码
bt 5
# 输入新密码
```

---

### 4. 忘记安全入口

```bash
# 查看面板信息
bt default
# 会显示完整访问地址，包含安全入口

# 或关闭安全入口
bt 10
```

---

### 5. MySQL 无法启动

```bash
# 检查磁盘空间
df -h

# 检查内存
free -m

# 查看错误日志
cat /www/server/mysql/error.log

# 修复权限
chown -R mysql:mysql /www/server/mysql

# 重新安装 MySQL
# 软件商店 → MySQL → 卸载 → 重装
```

---

### 6. 面板打开空白或 502

```bash
# 重启面板
bt restart

# 修复面板
curl -sSO https://download.bt.cn/install/update_panel.sh && bash update_panel.sh

# 或强制更新
curl -sSO https://download.bt.cn/install/update6.sh && bash update6.sh
```

---

### 7. 卸载宝塔面板

```bash
# 方法1：使用 bt 命令
bt 22

# 方法2：手动卸载
/etc/init.d/bt stop
rm -rf /www/server/panel
rm -f /etc/init.d/bt
rm -f /etc/rc.d/init.d/bt
```

> ⚠️ **警告：** 卸载前请备份所有数据！

---

## 备份与迁移

### 面板数据备份

**面板设置 → 备份面板**

或手动备份：
```bash
# 备份面板配置
tar czvf /root/bt_backup.tar.gz /www/server/panel/data

# 备份网站数据
tar czvf /root/www_backup.tar.gz /www/wwwroot

# 备份数据库
cd /www/backup/database && ls
```

### 服务器迁移

1. **新服务器安装宝塔**
2. **面板设置 → 迁移数据**
3. **或使用同步工具**

```bash
# rsync 同步网站文件
rsync -avz /www/wwwroot/ root@新服务器IP:/www/wwwroot/

# mysqldump 导出数据库
mysqldump -u root -p 数据库名 > db.sql
```

---

## 参考资源

- **官方文档：** https://www.bt.cn/docs/
- **官方论坛：** https://www.bt.cn/forum/
- **GitHub：** https://github.com/aaPanel/BaoTa

---

## 安全建议

1. **修改默认端口**（不要使用 8888）
2. **设置复杂密码**（16位以上，包含大小写+数字+符号）
3. **绑定域名+SSL**，禁用 IP 访问
4. **定期备份**网站和数据库
5. **开启面板监控**，及时发现异常
6. **只开放必要端口**，使用防火墙限制 IP

---

*文档版本：v1.0 | 更新时间：2024年*

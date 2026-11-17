# Typecho 博客部署指南

> 目标环境：Ubuntu 22.04 LTS + Nginx + PHP 8.1-FPM + SQLite + Typecho 1.2.x
> 适用：1 核 1G 起的个人 VPS，不想用 Docker、不想维护数据库服务
> 全文命令默认以 `root` 执行，非 root 请在前面加 `sudo`

---

## 0. 这套栈为什么这么选

| 组件 | 选择 | 原因 |
|---|---|---|
| 系统 | Ubuntu 22.04 LTS | 官方源里就有 PHP 8.1，和 Typecho 1.2.x 的兼容性经过大量验证。**不要用 24.04**：它默认 PHP 8.3，Typecho 1.2.x 和部分插件在上面会报 deprecated 警告甚至报错 |
| Web 服务器 | Nginx | 内存占用低于 Apache，反代静态文件效率高 |
| PHP | 8.1-FPM（Unix socket） | 官方源直装，不需要第三方 PPA |
| 数据库 | **SQLite** | 博客量级（几千篇文章）性能完全够；备份就是复制一个文件；不额外吃 100~200MB 内存、不需要 `mysqld` 进程 |
| 程序 | Typecho 1.2.x | 单文件部署思路、后台干净、中文文档齐全 |
| HTTPS | certbot（Let's Encrypt） | 免费、自动续期 |

**什么时候该换 MySQL**：只有当你要装的插件明确要求 MySQL/MariaDB 时。Typecho 迁移到 MySQL 是官方支持的操作，到时候再迁，不要一开始就为不确定的需求付成本。

**国内服务器注意**：域名必须先完成 ICP 备案，否则服务商会在 80/443 上拦截。香港/海外机器不需要备案。

---

## 1. DNS 解析

在域名服务商处加一条 A 记录：

```
类型: A    主机记录: blog    记录值: <你的VPS公网IP>    TTL: 600
```

验证（在你本地机器上执行）：

```bash
ping blog.example.com        # 应该解析到你的 VPS IP
```

> 解析生效前不要往下走，否则 certbot 签发证书会失败。

---

## 2. 首次登录 + 基础加固

### 2.1 先配好 SSH 密钥（顺序很重要）

在你**本地电脑**上：

```bash
ssh-keygen -t ed25519 -C "vps-blog"        # 一路回车，用默认路径
ssh-copy-id root@<VPS_IP>                   # 把公钥传上去
```

然后**新开一个终端**，确认能免密登录：

```bash
ssh root@<VPS_IP>       # 不应该再问密码
```

**确认这一步成功了再继续**，否则关掉密码登录后可能把自己锁在门外。

### 2.2 关闭密码登录

先检查有没有被 cloud-init 写进去的覆盖配置（这是最常见的坑，改了主配置却不生效）：

```bash
grep -r "PasswordAuthentication" /etc/ssh/sshd_config /etc/ssh/sshd_config.d/
```

如果 `/etc/ssh/sshd_config.d/` 下有文件写着 `PasswordAuthentication yes`，先把它改成 `no` 或直接删掉该文件，然后：

```bash
sed -i 's/^#\?PasswordAuthentication.*/PasswordAuthentication no/' /etc/ssh/sshd_config
sed -i 's/^#\?PermitRootLogin.*/PermitRootLogin prohibit-password/' /etc/ssh/sshd_config
sshd -t && systemctl restart ssh
```

改完**再开一个新终端**验证还能登录。这一步做完之前，别关掉当前这个已登录的会话。

### 2.3 系统更新 + 基础工具

```bash
apt update && apt upgrade -y
apt install -y ufw fail2ban unattended-upgrades curl unzip
```

### 2.4 防火墙

```bash
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp
ufw allow 80,443/tcp
ufw --force enable
ufw status
```

### 2.5 自动安全更新

```bash
dpkg-reconfigure -plow unattended-upgrades      # 弹窗里选 Yes
```

### 2.6 fail2ban（防 SSH 爆破）

```bash
systemctl enable --now fail2ban
fail2ban-client status sshd          # 能看到当前封禁列表即正常
```

### 2.7 swap（内存 ≤ 1G 必做）

```bash
fallocate -l 1G /swapfile
chmod 600 /swapfile
mkswap /swapfile
swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab
free -h                              # 确认 Swap 行有 1.0Gi
```

---

## 3. 安装 Nginx + PHP 8.1

```bash
apt install -y nginx \
  php8.1-fpm php8.1-sqlite3 php8.1-mbstring php8.1-curl \
  php8.1-gd php8.1-xml php8.1-zip php8.1-intl

systemctl enable --now nginx php8.1-fpm
php -v                               # 应显示 8.1.x
systemctl status php8.1-fpm --no-pager | head -5
```

> 如果提示找不到 `php8.1-*` 包，先启用 universe 源：`add-apt-repository universe && apt update`

### 3.1 PHP-FPM 进程池调优（1G 内存）

编辑 `/etc/php/8.1/fpm/pool.d/www.conf`，把 `pm` 相关几行改成：

```ini
pm = dynamic
pm.max_children = 6
pm.start_servers = 2
pm.min_spare_servers = 1
pm.max_spare_servers = 3
```

```bash
systemctl restart php8.1-fpm
```

> 每个 PHP 进程大约吃 30~50MB。`max_children = 6` 在 1G 内存下是安全值；写到 20 只会在流量突增时 OOM 把整机拖死。

---

## 4. 放置 Typecho 程序

### 4.1 下载

**推荐**：浏览器打开 <https://typecho.org/download> 下载最新稳定版 zip，然后从本地传上去：

```bash
# 在你本地电脑执行
scp ~/Downloads/typecho.zip root@<VPS_IP>:/tmp/
```

### 4.2 解压部署

```bash
cd /tmp && unzip -o typecho.zip -d /tmp/tc
find /tmp/tc -maxdepth 2 -name index.php     # 看清真正的程序根目录在哪

mkdir -p /var/www/typecho
# 把 index.php / install.php / admin / var / usr 这些同级内容拷进去
cp -r /tmp/tc/<上面找到的那一层>/. /var/www/typecho/
ls /var/www/typecho                          # 应能看到 index.php install.php admin var usr
```

### 4.3 权限

```bash
chown -R www-data:www-data /var/www/typecho
find /var/www/typecho -type d -exec chmod 755 {} \;
find /var/www/typecho -type f -exec chmod 644 {} \;
```

> 安装程序需要往 `config.inc.php` 和 `usr/uploads/` 写文件，所以现在必须让 `www-data` 拥有整个目录。安装完成后再收紧（见第 8 节）。

---

## 5. Nginx 站点配置

创建 `/etc/nginx/sites-available/typecho`：

```nginx
server {
    listen 80;
    listen [::]:80;
    server_name blog.example.com;

    root /var/www/typecho;
    index index.php;

    access_log /var/log/nginx/typecho.access.log;
    error_log  /var/log/nginx/typecho.error.log;

    client_max_body_size 20m;

    # 【必须】上传目录禁止执行 PHP
    # 正则 location 按出现顺序匹配，这条一定要排在下面 \.php$ 之前
    location ~* ^/usr/uploads/.*\.(php|phtml|phar)$ {
        deny all;
    }

    # 隐藏文件（.git / .env 等），保留 ACME 验证目录
    location ~ /\.(?!well-known).* {
        deny all;
    }

    # 静态资源缓存
    location ~* \.(jpg|jpeg|png|gif|webp|svg|ico|css|js|woff2?)$ {
        expires 30d;
        access_log off;
        try_files $uri =404;
    }

    # PHP 交给 FPM
    location ~ \.php$ {
        include snippets/fastcgi-php.conf;
        fastcgi_pass unix:/run/php/php8.1-fpm.sock;
    }

    # Typecho 伪静态
    location / {
        try_files $uri $uri/ /index.php$is_args$args;
    }
}
```

启用并检查：

```bash
ln -sf /etc/nginx/sites-available/typecho /etc/nginx/sites-enabled/typecho
rm -f /etc/nginx/sites-enabled/default
nginx -t                    # 必须显示 syntax is ok / test is successful
systemctl reload nginx
```

此时浏览器访问 `http://blog.example.com` 应能看到 Typecho 安装页或 403/404，说明 Nginx 和 PHP 已通。

---

## 6. 签发 HTTPS 证书

```bash
apt install -y certbot python3-certbot-nginx
certbot --nginx -d blog.example.com
```

交互里选择：

- 同意条款 → `Y`
- 是否接收邮件 → 随意
- **是否把 HTTP 重定向到 HTTPS → 选 `2`（Redirect）**

验证自动续期：

```bash
certbot renew --dry-run
systemctl list-timers | grep certbot      # 应有 certbot.timer
```

---

## 7. 网页安装

打开 `https://blog.example.com/install.php`：

1. **数据库选择 SQLite**，数据库文件路径留默认（会落在 `usr/` 下）
2. 站点地址填 `https://blog.example.com`（**务必带 https**，填错会导致后台登录后跳回登录页）
3. 设置管理员账号：用户名别用 `admin`，密码 16 位以上
4. 提交后如果提示无法写入 `config.inc.php`，说明第 4.3 节权限没做对

安装完成后，进 **后台 → 设置 → 永久链接**，把「启用地址重写」打开（否则文章链接是 `?p=1` 这种形式）。

---

## 8. 安装后收尾（安全必做）

```bash
# 1. 删掉安装程序
rm -f /var/www/typecho/install.php

# 2. 收紧配置文件权限
chmod 640 /var/www/typecho/config.inc.php

# 3. 确认上传目录可写但不可执行
ls -ld /var/www/typecho/usr/uploads
chown -R www-data:www-data /var/www/typecho/usr/uploads
```

再确认一遍 PHP 实际生效的配置没有暴露信息：

```bash
php -i | grep -E "expose_php|cgi.fix_pathinfo"
```

如果 `expose_php` 是 `On`，编辑 `/etc/php/8.1/fpm/php.ini` 改成 `expose_php = Off`，然后 `systemctl restart php8.1-fpm`。

---

## 9. 自动备份（这一节不要跳）

备份的判据不是「有没有生成压缩包」，而是**你恢复过一次**。

### 9.1 备份脚本

创建 `/usr/local/bin/backup-typecho.sh`：

```bash
#!/usr/bin/env bash
set -euo pipefail

SRC=/var/www/typecho
DST=/var/backups/typecho
STAMP=$(date +%F)

mkdir -p "$DST"

# 整站打包（SQLite 数据库文件也在里面）
tar czf "$DST/typecho-$STAMP.tar.gz" -C /var/www typecho

# 本地保留 7 天
find "$DST" -name 'typecho-*.tar.gz' -mtime +7 -delete

# 有 rclone 就推到异地，没有就跳过
if command -v rclone >/dev/null 2>&1 && rclone listremotes | grep -q .; then
    rclone copy "$DST/typecho-$STAMP.tar.gz" <remote>:typecho-backup
fi
```

```bash
chmod +x /usr/local/bin/backup-typecho.sh
/usr/local/bin/backup-typecho.sh
ls -lh /var/backups/typecho/          # 确认有今天的包
```

### 9.2 定时执行

```bash
( crontab -l 2>/dev/null; echo "17 3 * * * /usr/local/bin/backup-typecho.sh" ) | crontab -
crontab -l
```

### 9.3 异地存储（强烈建议）

本地备份和网站死在同一块盘上，没有意义。装 rclone 推到对象存储：

```bash
apt install -y rclone
rclone config          # 交互式配置，选你的对象存储（S3 / 阿里云 OSS / 腾讯云 COS 等），命名 remote 为 mybackup
```

配置完把脚本里的 `<remote>` 换成 `mybackup`。

### 9.4 演练恢复（每季度一次）

```bash
mkdir -p /tmp/restore-test
tar xzf /var/backups/typecho/typecho-YYYY-MM-DD.tar.gz -C /tmp/restore-test
ls /tmp/restore-test/typecho/usr/          # 能看到 uploads 和 db 文件就算通了
rm -rf /tmp/restore-test
```

---

## 10. 故障排查速查

| 现象 | 大概率原因 | 查这里 |
|---|---|---|
| 502 Bad Gateway | php8.1-fpm 没起 / socket 路径写错 | `systemctl status php8.1-fpm`；`ls /run/php/` 看实际 socket 名 |
| 403 Forbidden | 目录权限或属主不对 | `ls -ld /var/www/typecho`，应属 `www-data` |
| 首页能开，文章 404 | 伪静态没开 | 后台「永久链接」启用重写；确认 `try_files` 那行在 |
| 500 / 白屏 | PHP 报错 | `tail -50 /var/log/nginx/typecho.error.log`、`tail -50 /var/log/php8.1-fpm.log` |
| 登录后台又跳回登录页 | 站点地址填成了 http 或缺域名 | 数据库或 `config.inc.php` 里的站点地址，改成 `https://域名` |
| 上传图片失败 | 体积超限或目录不可写 | `client_max_body_size`；`ls -ld usr/uploads` |
| 磁盘满了 | 日志/备份堆积 | `du -sh /var/log/* \| sort -h`、`journalctl --vacuum-time=7d` |

---

## 11. 日常维护清单

- **每月**：`apt update && apt upgrade -y`，然后 `systemctl reload nginx`
- **每月**：看一眼 `fail2ban-client status sshd`，被封 IP 数量突然暴涨说明在被扫
- **每季度**：按 9.4 演练一次恢复
- **每季度**：`certbot renew --dry-run` 确认续期链路没断
- **升级 Typecho**：先备份，再覆盖程序文件（保留 `config.inc.php`、`usr/`、`admin/` 下的自定义内容），最后访问 `/admin` 触发升级
- **磁盘水位**：`df -h` 使用率超过 80% 就该清理了，日志是最常见的元凶

---

## 附：可选优化（不影响可用，按需加）

- **对象存储存图**：图片走 OSS/COS + CDN，VPS 带宽压力立减
- **Nginx 缓存**：Typecho 装插件做页面缓存，1C1G 也能扛住小流量突发
- **`open_basedir`**：在 PHP-FPM pool 里限制 PHP 只能读 `/var/www/typecho`，进一步缩小被拿下后的影响面
- **HTTP/2 + Brotli**：Nginx 1.18+ 默认支持 HTTP/2，`listen 443 ssl http2;` 即可

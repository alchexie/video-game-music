# vgm后端更新部署

项目部署在 ```/www/wwwroot/servers/vgm/``` 目录下，目录结构与源代码目录结构一致。

```text
(path)/vgm/
  apps/
  packages/
  var/
  .env
  package.json
  pnpm-workspace.yaml
```

以下所有操作都在 ```/www/wwwroot/servers/vgm``` 目录下

```bash
cd /www/wwwroot/servers/vgm
```

## 源代码有更新时

1、将除 var/ 外的所有内容移动到 _bak/ 里

```bash
mkdir -p _bak
shopt -s dotglob extglob
mv !(var|_bak) _bak/
```

2、将本地 build 好的内容 （```(本地代码仓库)/dist/server``` 里的内容）上传到 ```/www/wwwroot/servers/vgm/``` 并安装依赖

```bash
pnpm install --prod
```

3、重载服务

```bash
pm2 reload vgm
```

4、确认没问题，删除 _bak 文件夹。

## var 文件夹内容 / 数据库有更新时

1、按需备份、上传需要更新的文件

2、重载服务

```bash
pm2 reload vgm
```

# mcwhitelist-plugin

一个用于 **便捷管理 Minecraft 服务器白名单** 的 [TRSS/Yunzai-Bot](https://gitee.com/TimeRainStarSky/Yunzai-Bot) 插件。  
通过聊天命令即可添加/查询白名单，无需进入服务器后台操作。

---

## 功能特性

- 支持通过命令 `#mcl 玩家名` 添加白名单
- 自动保存用户已添加的白名单列表 (`list.json`)
- 通过命令 `#mcwl` 查询自己添加过的白名单
- 使用远程接口调用 Minecraft 服务器白名单 API
- 内置简单权限控制（仅限发送命令的 QQ 用户可管理自己的白名单）
- 支持通过`#mcws` 调用 mcstatus.io 与 crafatar.com 查询服务器状态


![mfi1evuh](https://img.zmal.top/20250913/mfi1evuh.73ce16bf.2dp1z90uy3.jpg)
---

## 安装方法

### mc mod
> 理论上支持全部版本，但是目前只在1.21.1和1.21.8通过测试
[github](https://github.com/kmizmal/whitelistapimod)  
modrinth审核还没过

### yz插件

```bash
git clone https://github.com/kmizmal/mcwhitelist-plugin.git ./plugins/mcwhitelist-plugin
```

或者直接下载源码放到 `plugins/mcwhitelist-plugin/`。

安装依赖：

```bash
pnpm install
```

---

## 配置
> 插件已支持使用锅巴配置
插件目录下需要有 `config.yaml` 文件，示例：

```yaml
mcwhapi: http://127.0.0.1:8080 # 你的白名单 API 地址
mcwhkey: your_secret_token # 鉴权密钥
```

---

## 使用方法

- 添加白名单

  ```
  #mcw 玩家名
  ```

  机器人会调用接口并返回是否添加成功。

- 删除白名单
  ```
  #mcw 删 玩家名
  ```
  还没写完，只能删插件记录，暂时不会影响服务器

- 查询自己添加过的白名单

  ```
  #mcwl
  ```

- 查询服务器状态
  ```
  #mcws
  ```

- 帮助
  ```
  #mcwhelp
  ```
  显示帮助信息


---

## 常见问题

1. **提示 “请求出错”**
   - 检查 `config.yaml` 是否配置正确
   - 确认 API 服务是否能正常访问

2. **鉴权失败**
   - 请检查 `mcwhkey` 是否正确

## 鸣谢

- [Yunzai-Bot](https://gitee.com/Le-niao/Yunzai-Bot) / [TRSS-Yunzai](https://gitee.com/TimeRainStarSky/Yunzai-Bot)
- 插件开发：[@kmizmal](https://github.com/kmizmal)
- 一些示例：https://gitee.com/shijinn/Miao-Yunzai-plugin
- [icqq文档](https://gitee.com/shijinn/Miao-Yunzai-plugin)
- [锅巴插件](https://github.com/guoba-yunzai/Guoba-Plugin)~~sjlei还没回我，差评~~
- [fabric](https://fabricmc.net/)
- [次元api](https://t.alcy.cc/)提供服务器状态背景图
- [mcstatus](mcstatus.io)提供服务器状态
- [crafatar](crafatar.com)提供uuid查头像
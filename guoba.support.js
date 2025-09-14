import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"
import YAML from "yaml"
import {McWhitelistManager} from './McWhitelistManager.js';

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// 配置文件路径
const configPath = path.join(__dirname, "config.yaml")

// 工具函数：读配置
function loadConfig() {
  if (fs.existsSync(configPath)) {
    const file = fs.readFileSync(configPath, "utf8")
    return YAML.parse(file) || {}
  }
  return {}
}

let config = loadConfig();

// 支持锅巴
export function supportGuoba() {
  let groupList = Array.from(Bot.gl.values())
  groupList = groupList.map(item => item = { label: `${item.group_name}-${item.group_id}`, value: item.group_id })
  return {
    // 插件信息，将会显示在前端页面
    // 如果你的插件没有在插件库里，那么需要填上补充信息
    // 如果存在的话，那么填不填就无所谓了，填了就以你的信息为准
    pluginInfo: {
      name: 'mcwhitelist-plugin',
      title: 'mcwhitelist-plugin',
      author: '@zmal',
      authorLink: 'https://github.com/kmizmal',
      link: 'https://github.com/kmizmal/mcwhitelist-plugin',
      isV3: true,
      isV2: false,
      description: '通过聊天命令即可添加白名单，无需进入服务器后台操作。',
      // 显示图标，此为个性化配置
      // 图标可在 https://icon-sets.iconify.design 这里进行搜索
      icon: 'bx:atom',
      // 图标颜色，例：#FF0000 或 rgb(255, 0, 0)
      iconColor: 'rgb(241,212,152)',
      // 如果想要显示成图片，也可以填写图标路径（绝对路径）
      // iconPath: path.join(_paths.pluginRoot, 'resources/images/icon.png'),
    },
    // 配置项信息
    configInfo: {
      // 配置项 schemas，用于前端渲染 UI
      schemas: [
        {
          component: 'Divider',
          label: 'MC 白名单管理配置'
        },
        {
          field: 'mcwhapi',
          label: 'API 地址',
          bottomHelpMessage: 'Minecraft 白名单 HTTP API 地址，需要带上 http:// 或 https://',
          component: 'Input',
          required: true,
          componentProps: {
            placeholder: '例如：http://127.0.0.1:6626'
          }
        },
        {
          field: 'mcwhkey',
          label: '鉴权密钥',
          bottomHelpMessage: 'API Bearer Token，用于请求鉴权',
          component: 'InputPassword',
          required: true,
          componentProps: {
            placeholder: '请输入鉴权密钥'
          }
        },
        {
          field: 'maxbind',
          label: '单个用户最大绑定数',
          component: 'InputNumber',
          required: true,
          componentProps: {
            addonAfter: '个'
          }
        },
        {
          field: 'serverName',
          label: '服务器名称',
          bottomHelpMessage: '用于状态查询显示',
          component: 'Input',
          required: false,
          componentProps: {
            placeholder: '请输入服务器名称'
          }
        },
        {
          field: 'mcserver',
          label: '服务器地址',
          bottomHelpMessage: '用于状态查询显示，格式为 ip:port（默认的25565可省略）',
          component: 'Input',
          required: false,
          componentProps: {
            placeholder: '例如：mc.example.com:25565'
          }
        },
      ],

      // 读取配置，用于前端显示
      getConfigData() {
        return {
          mcwhapi: config.mcwhapi || '',
          mcwhkey: config.mcwhkey || '',
          maxbind: config.maxbind || 3,
        }
      },

      // 保存配置（写回 config.yaml）
      setConfigData(data, { Result }) {
        // 合并已有配置
        config = { ...config, ...data }

        // 写回文件
        fs.writeFileSync(configPath, YAML.stringify(config), 'utf8')
        McWhitelistManager.config = config

        return Result.ok({}, '配置已保存~')
      }
    }
  }
}

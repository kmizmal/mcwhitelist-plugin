import fetch from 'node-fetch';
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import YAML from "yaml";

// 获取当前插件目录
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const configPath = path.join(__dirname, "config.yaml");

let config = {};
if (fs.existsSync(configPath)) {
    const file = fs.readFileSync(configPath, "utf8");
    config = YAML.parse(file);
} else {
    console.warn("配置文件被我吃掉力", configPath);
}
const listPath = path.join(__dirname, "list.json");
let list = {};
if (fs.existsSync(listPath)) {
    try {
        const content = fs.readFileSync(listPath, "utf8").trim();
        list = content ? JSON.parse(content) : {};
    } catch (err) {
        console.error("解析 list.json 失败，初始化为空对象", err);
        list = {};
    }
}
// logger.mark("mcw配置内容:", config);

logger.mark("Ciallo～(∠・ω＜ )⌒★")

export class TextMsg extends plugin {
    constructor() {
        super({
            name: 'mcwhitelist',
            dsc: '便捷管理mc服务器白名单',
            event: 'message',
            priority: 6,
            rule: [
                {
                    reg: '^#mcl\\s*(.*)$',
                    fnc: 'run'
                },
                {
                    reg: '^#mcwl$',
                    fnc: 'queryList'
                }
            ]
        })

    }

    async run(e) {

        if (!list[e.user_id]) list[e.user_id] = [];
        console.log({
            user_id: e.user_id,
            message: e.message,
            nickname: e.nickname,
            sender: e.sender
        });
        const user_id = e.user_id;
        const player = e.msg.match(/^#mcl\s*(.*)/)[1]
        if (!player) {
            e.reply("人家猜不到小笨蛋的名字喵~", true, { recallMsg: 15 })
            return true
        }
        // 输出 player（调试用）
        // logger.mark(`player = ${player}`)

        if (list[e.user_id].includes(player)) {
            e.reply(`${player}已经在白名单了喵~`, true, { recallMsg: 15 });
            return true;
        }

        const res = await this.getapi(player);
        if (res == false) {
            e.reply("请求出错，请检查配置或联系管理员喵~", true, { recallMsg: 15 })
        } else {
            const match = res.match(/Player\s+(\S+)\s+added/i);
            const actualPlayer = match ? match[1] : null;
            e.reply(`${actualPlayer}添加白名单了喵，若无效请联系管理员~`, true, { recallMsg: 15 })
            e.reply(`已添加${list[user_id].length + 1}个白名单`, true);
        }


        list[user_id].push(player);
        fs.writeFileSync(listPath, JSON.stringify(list, null, 2), "utf8");

        return true
    }

    async getapi(player) {
        try {
            const apiUrl = config.mcwhapi.startsWith('http') ? config.mcwhapi : `http://${config.mcwhapi}`;
            const response = await fetch(`${apiUrl}/whitelist/add?player=${player}`, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json',
                    'Authorization': `Bearer ${config.mcwhkey}`
                }
            });

            if (response.status == 401) { console.warn('鉴权密钥错误'); return false }
            // console.log(response.status)
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

            const data = await response.text();
            // console.log('GET 返回数据:', data);

            return data;
        } catch (err) {
            console.error('GET 请求出错:', err);
            return false;
        }
    }
    async queryList(e) {
        let user;
        if (e.at) user = e.at;else user = e.sender;
        console.log(user);
        if (!list[user.user_id] || list[e.user_id].length === 0) {
            e.reply("你还没有添加任何白名单喵~", true, { recallMsg: 15 });
            return true;
        } else {
            const players = list[user.user_id].join("\n");
            e.reply(`你已添加的白名单有:\n${players}`, true);
            return true;
        }
    }


}
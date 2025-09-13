import fetch from 'node-fetch';
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import YAML from "yaml";

// 获取当前插件目录
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const configPath = path.join(__dirname, "config.yaml");
const expampleconfigPath = path.join(__dirname, "config.example.yaml");
const listPath = path.join(__dirname, "list.json");
const cacheavatars = path.join(__dirname, 'resources/avatars/avatar-cache.json');
const avatarDir = path.join(__dirname, 'resources/avatars');
const bgPath = path.join(__dirname, 'resources/background.jpg');

if (!fs.existsSync(avatarDir)) {
    fs.mkdirSync(avatarDir, { recursive: true });
}
let avatarCache = {};


if (fs.existsSync(cacheavatars)) {
    try {
        avatarCache = JSON.parse(fs.readFileSync(cacheavatars, 'utf-8'));
    } catch (err) {
        console.error("解析头像缓存失败，初始化为空对象", err);
        avatarCache = {};
    }
}


const today = new Date().toISOString().slice(0, 10); // yyyy-mm-dd


if (!fs.existsSync(configPath)) {
    console.warn("配置文件被小笨蛋吃掉力");
    try {
        fs.promises.copyFile(expampleconfigPath, configPath);
        console.info("成功创建新的配置文件", configPath);
    } catch (err) {
        console.error("创建配置文件失败", err);
    }
}


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
                    reg: '^#?mcwl',
                    fnc: 'queryList'
                },
                {
                    reg: '^#?mcw\\s*删\\s*(\\S+)?$',
                    fnc: 'deletePlayer'
                },
                {
                    reg: '^#?mcw(?!l)\\s+(\\S+)$',
                    fnc: 'run'
                },
                {
                    reg: '^#?mcw(?:help|帮助)$',
                    fnc: 'help'
                },
                {
                    reg: '^#?mcwf(\\S+)$',
                    fnc: 'queryuesr'
                },
                {
                    reg: '^#?mcws',
                    fnc: 'status'
                },

            ]
        })

    }
    async queryList(e) {
        let user;
        if (e.at) {
            const curGroup = e.group || Bot?.pickGroup(e.group_id);
            const membersMap = await curGroup?.getMemberMap();
            user = membersMap.get(parseInt(e.at));
        } else {
            user = e.sender;
        }
        console.log(user);
        if (!list[user.user_id] || list[user.user_id].length === 0) {
            e.reply("你还没有添加任何白名单喵~", true, { recallMsg: 15 });
            return true;
        } else {
            const players = list[user.user_id].join("\n");
            e.reply(`你已添加的白名单有:\n${players}`, true);
            return true;
        }
    }
    async run(e) {
        const user_id = e.user_id;
        if (!list[user_id]) list[user_id] = [];
        // console.log({
        //     user_id: e.user_id,
        //     message: e.message,
        //     nickname: e.nickname,
        //     sender: e.sender
        // });

        const match = e.msg.match(/^#?mcw(?!l)\s+(\S+)$/);
        if (!match) {
            e.reply("人家猜不到小笨蛋的名字喵~", true, { recallMsg: 15 });
            return true;
        }

        const player = match[1].trim();
        if (!player) {
            e.reply("人家猜不到小笨蛋的名字喵~", true, { recallMsg: 15 })
            return true
        }
        // 输出 player（调试用）
        // logger.mark(`player = ${player}`)

        if (list[user_id].includes(player)) {
            e.reply(`${player}已经在白名单了喵~`, true, { recallMsg: 15 });
            return true;
        }

        if (list[user_id].length >= YAML.parse(fs.readFileSync(configPath, "utf8")).maxbind) {
            e.reply(`你添加的白名单数已达上限喵~,也许你可以通过[#mcw删 <用户名>]的方式删掉一些。(可以通过[#mcwl]查询已绑定的情况)`, true);
            return true;
        }

        const res = await this.getapi(player, "add");
        if (res == false) {
            e.reply("请求出错，请检查配置或联系管理员喵~", true, { recallMsg: 15 })
        } else {
            const match = res.match(/Player\s+(\S+)\s+added/i);
            const actualPlayer = match ? match[1] : null;
            e.reply(`${actualPlayer}添加白名单了喵，若无效请联系管理员~`, true, { recallMsg: 15 })
            list[user_id].push(player);
            fs.writeFileSync(listPath, JSON.stringify(list, null, 2), "utf8");
            e.reply(`已添加${list[user_id].length}个白名单`, true);
        }

        return true
    }

    async getapi(player, work) {
        try {
            const file = fs.readFileSync(configPath, "utf8");
            const config = YAML.parse(file);

            const apiUrl = config.mcwhapi.startsWith('http') ? config.mcwhapi : `http://${config.mcwhapi}`;
            const response = await fetch(`${apiUrl}/whitelist/${work}?player=${player}`, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json',
                    'Authorization': `Bearer ${config.mcwhkey}`
                },
                timeout: 10000 // 设置超时时间为10秒
            });

            if (response.status == 401) { console.warn('鉴权密钥错误'); return false }
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

            const data = await response.text();

            return data;
        } catch (err) {
            console.error('GET 请求出错:', err);
            return false;
        }
    }

    async deletePlayer(e) {
        let user;
        if (e.at) {
            // 如果命令带了 @，就根据 at 的 QQ 获取群成员
            const curGroup = e.group || Bot?.pickGroup(e.group_id);
            const membersMap = await curGroup?.getMemberMap();
            user = membersMap.get(parseInt(e.at));
        } else {
            // 否则就用消息发送者自己
            user = e.sender;
        }
        console.log(user);
        const match = e.msg.match(/^#?mcw\s*删\s*(\S+)?$/);

        const player = match ? match[1].trim() : null;
        if (player) {
            if (!list[user.user_id] || list[user.user_id].length === 0) {
                e.reply("你还没有添加任何白名单喵~", true, { recallMsg: 15 });
                return true;
            } else {
                const index = list[user.user_id].findIndex(p => p.toLowerCase() === player.toLowerCase());

                if (index === -1) {
                    e.reply(`${player}不在你的白名单里喵~`, true, { recallMsg: 15 });
                    return true;
                } else {
                    list[user.user_id].splice(index, 1);
                    fs.writeFileSync(listPath, JSON.stringify(list, null, 2), "utf8");
                    //todo: 从服务器删除指定玩家
                    e.reply(`已删除${player}`, true);
                    return true;
                }
            }
        }
    }

    async help(e) {
        e.reply(`白名单管理帮助：
    1. 添加白名单: #mcw 玩家名
    2. 查询白名单: #mcwl （可@别人）
    3. 查询玩家绑定情况: #mcwf 玩家名
    4. 删除白名单: #mcw 删 玩家名 （或不写玩家名则删除最后一个）
    5. 查看帮助: #mcwhelp / mcw帮助
    6. 查询服务器状态: #mcws
    `, true);

        return true;
    }
    async queryuesr(e) {
        const match = e.msg.match(/^#?mcwf(\S+)$/);
        const player = match ? match[1].trim() : null;
        if (!player) {
            e.reply("请检查输入喵~", true, { recallMsg: 15 })
            return true
        }
        const playerLower = player.toLowerCase();
        for (const [user_id, players] of Object.entries(list)) {
            if (players.some(p => p.toLowerCase() === playerLower)) {
                e.reply(`${player}在 ${user_id} 的白名单里喵~`, true);
                return true;
            }
        }
        e.reply(`未找到${player}`)
        return true;
    }

    async status(e) {
        const file = fs.readFileSync(configPath, "utf8");
        const config = YAML.parse(file);
        const server = config.mcserver;
        if (server == null || server.trim() === "") {
            e.reply("请先在配置文件中设置mcserver喵~", true);
            return true;
        }
        const serverName = (typeof config.serverName === 'string' && config.serverName.trim() !== "")
            ? config.serverName.trim()
            : "mcwhitelist";

        // console.log(e.runtime.render.toString())
        const url = `https://api.mcstatus.io/v2/status/java/${server}`;

        try {
            const response = await fetch(url);
            const json = await response.json();

            const online = json.online;
            if (!online) { e.reply("服务器离线喵~", true); return true; }
            const players = json.players;
            let arkCount = 0;


            const filteredListPromises = players.list.map(async (p, index) => {
                if (p.uuid === '00000000-0000-0000-0000-000000000000') {
                    arkCount++;
                    return null;
                }

                const filePath = path.join(avatarDir, `${p.uuid}.png`);

                // 检查是否需要更新头像
                if (avatarCache[p.uuid] !== today || !fs.existsSync(filePath)) {
                    await new Promise(resolve => setTimeout(resolve, index * 100 * (Math.random() + 0.2)));
                    const avatarUrl = `https://crafatar.com/renders/head/${p.uuid}?size=64&overlay`;
                    try {
                        const res = await fetch(avatarUrl);
                        if (!res.ok) throw new Error(`无法获取${p.uuid}的头像: ${res.status}`);
                        const buffer = await res.arrayBuffer();
                        await fs.promises.writeFile(filePath, Buffer.from(buffer));
                        avatarCache[p.uuid] = today;
                    } catch (err) {
                        console.error("下载头像失败:", err);
                        return null;
                    }
                }

                return { uuid: p.uuid, name: p.name_clean };
            });

            try {
                const res = await fetch("https://t.alcy.cc/moe");
                const buffer = Buffer.from(await res.arrayBuffer());
                await fs.promises.writeFile(bgPath, buffer);
            } catch (err) {
                console.error("下载背景图失败:", err);
            }

            let filteredList = (await Promise.all(filteredListPromises)).filter(p => p && p.uuid !== '00000000-0000-0000-0000-000000000000');
            // console.log(filteredList);

            try {
                fs.writeFileSync(cacheavatars, JSON.stringify(avatarCache, null, 2));
            } catch (err) {
                console.error("保存头像缓存失败:", err);
            }

            // console.log("渲染数据:", {
            //     players: filteredList,
            //     arkCount,
            //     server,
            //     serverName
            // });

            return await e.runtime.render('mcwhitelist-plugin', 'status.html', { players: filteredList, arkCount, server, serverName }, { scale: 1.2, e });

        } catch (err) {
            console.error("获取服务器状态失败:", err);
            e.reply("获取服务器状态失败", true);
        }

        return true;

    }
}
import fetch from 'node-fetch';
import fs from "fs/promises";
import fsSync from "fs";
import path from "path";
import { fileURLToPath } from "url";
import YAML from "yaml";

// 获取当前插件目录
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 路径配置
const PATHS = {
    config: path.join(__dirname, "config.yaml"),
    exampleConfig: path.join(__dirname, "config.example.yaml"),
    list: path.join(__dirname, "list.json"),
    avatarCache: path.join(__dirname, 'resources/avatars/avatar-cache.json'),
    avatarDir: path.join(__dirname, 'resources/avatars'),
    background: path.join(__dirname, 'resources/background.jpg')
};

// 常量配置
const CONFIG = {
    REQUEST_TIMEOUT: 10000,
    AVATAR_SIZE: 64,
    RENDER_SCALE: 1.2,
    RECALL_TIME: 15,
    AVATAR_DELAY_RANGE: { min: 20, max: 200 } // ms
};

class McWhitelistManager {
    constructor() {
        this.avatarCache = {};
        this.list = {};
        this.config = null;
        this.today = new Date().toISOString().slice(0, 10);
    }

    async initialize() {
        try {
            // 确保头像目录存在
            await this.ensureDirectoryExists(PATHS.avatarDir);

            // 初始化配置文件
            await this.initializeConfig();

            // 加载缓存数据
            await Promise.all([
                this.loadAvatarCache(),
                this.loadPlayerList()
            ]);

            logger.mark("Ciallo～(∠・ω＜ )⌒★ - McWhitelist插件初始化完成");
        } catch (error) {
            console.error("插件初始化失败:", error);
            throw error;
        }
    }

    async ensureDirectoryExists(dir) {
        try {
            await fs.access(dir);
        } catch {
            await fs.mkdir(dir, { recursive: true });
        }
    }

    async initializeConfig() {
        try {
            await fs.access(PATHS.config);
        } catch {
            console.warn("配置文件不存在，正在创建...");
            try {
                await fs.copyFile(PATHS.exampleConfig, PATHS.config);
                console.info("成功创建新的配置文件:", PATHS.config);
            } catch (err) {
                console.error("创建配置文件失败:", err);
                throw err;
            }
        }
    }

    async loadConfig() {
        try {
            const configFile = await fs.readFile(PATHS.config, "utf8");
            this.config = YAML.parse(configFile);
            return this.config;
        } catch (error) {
            console.error("加载配置文件失败:", error);
            throw error;
        }
    }

    async loadAvatarCache() {
        try {
            const cacheData = await fs.readFile(PATHS.avatarCache, 'utf-8');
            this.avatarCache = JSON.parse(cacheData);
        } catch {
            this.avatarCache = {};
        }
    }

    async loadPlayerList() {
        try {
            const content = await fs.readFile(PATHS.list, "utf8");
            this.list = content.trim() ? JSON.parse(content) : {};
        } catch {
            this.list = {};
        }
    }

    async savePlayerList() {
        try {
            await fs.writeFile(PATHS.list, JSON.stringify(this.list, null, 2), "utf8");
        } catch (error) {
            console.error("保存玩家列表失败:", error);
            throw error;
        }
    }

    async saveAvatarCache() {
        try {
            await fs.writeFile(PATHS.avatarCache, JSON.stringify(this.avatarCache, null, 2));
        } catch (error) {
            console.error("保存头像缓存失败:", error);
        }
    }

    async makeApiRequest(player, action) {
        try {
            const config = await this.loadConfig();
            const apiUrl = config.mcwhapi.startsWith('http') 
                ? config.mcwhapi 
                : `http://${config.mcwhapi}`;

            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), CONFIG.REQUEST_TIMEOUT);

            const response = await fetch(`${apiUrl}/whitelist/${action}?player=${player}`, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json',
                    'Authorization': `Bearer ${config.mcwhkey}`
                },
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (response.status === 401) {
                console.warn('鉴权密钥错误');
                return false;
            }

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            return await response.text();
        } catch (error) {
            if (error.name === 'AbortError') {
                console.error('API请求超时');
            } else {
                console.error('API请求出错:', error);
            }
            return false;
        }
    }

    async downloadAvatar(uuid, index = 0) {
        const filePath = path.join(PATHS.avatarDir, `${uuid}.png`);
        
        // 检查是否需要更新头像
        if (this.avatarCache[uuid] === this.today && fsSync.existsSync(filePath)) {
            return true;
        }

        try {
            // 添加随机延迟以避免请求过于频繁
            const delay = Math.random() * 
                (CONFIG.AVATAR_DELAY_RANGE.max - CONFIG.AVATAR_DELAY_RANGE.min) + 
                CONFIG.AVATAR_DELAY_RANGE.min;
            await new Promise(resolve => setTimeout(resolve, index * delay));

            const avatarUrl = `https://crafatar.com/renders/head/${uuid}?size=${CONFIG.AVATAR_SIZE}&overlay`;
            const response = await fetch(avatarUrl);

            if (!response.ok) {
                throw new Error(`无法获取${uuid}的头像: ${response.status}`);
            }

            const buffer = await response.arrayBuffer();
            await fs.writeFile(filePath, Buffer.from(buffer));
            this.avatarCache[uuid] = this.today;
            return true;
        } catch (error) {
            console.error(`下载头像失败 (${uuid}):`, error);
            return false;
        }
    }

    async downloadBackground() {
        try {
            const response = await fetch("https://t.alcy.cc/moe");
            if (response.ok) {
                const buffer = Buffer.from(await response.arrayBuffer());
                await fs.writeFile(PATHS.background, buffer);
            }
        } catch (error) {
            console.error("下载背景图失败:", error);
        }
    }

    getUserFromMessage(e) {
        if (e.at) {
            const curGroup = e.group || Bot?.pickGroup(e.group_id);
            return curGroup?.getMemberMap()?.then(map => map.get(parseInt(e.at)));
        }
        return Promise.resolve(e.sender);
    }

    createErrorMessage(message, recallTime = CONFIG.RECALL_TIME) {
        return { message, recall: true, recallMsg: recallTime };
    }
}

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
                    fnc: 'addPlayer'
                },
                {
                    reg: '^#?mcw(?:help|帮助)$',
                    fnc: 'help'
                },
                {
                    reg: '^#?mcwf(\\S+)$',
                    fnc: 'queryUser'
                },
                {
                    reg: '^#?mcws',
                    fnc: 'status'
                }
            ]
        });

        this.manager = new McWhitelistManager();
        this.initPromise = this.manager.initialize();
    }

    async ensureInitialized() {
        await this.initPromise;
    }

    async queryList(e) {
        await this.ensureInitialized();
        
        try {
            const user = await this.manager.getUserFromMessage(e);
            const userList = this.manager.list[user.user_id] || [];

            if (userList.length === 0) {
                e.reply("你还没有添加任何白名单喵~", true, { recallMsg: CONFIG.RECALL_TIME });
                return true;
            }

            const players = userList.join("\n");
            e.reply(`你已添加的白名单有:\n${players}`, true);
            return true;
        } catch (error) {
            console.error("查询白名单失败:", error);
            e.reply("查询失败，请稍后重试喵~", true, { recallMsg: CONFIG.RECALL_TIME });
            return true;
        }
    }

    async addPlayer(e) {
        await this.ensureInitialized();
        
        const user_id = e.user_id;
        if (!this.manager.list[user_id]) {
            this.manager.list[user_id] = [];
        }

        const match = e.msg.match(/^#?mcw(?!l)\s+(\S+)$/);
        if (!match) {
            e.reply("人家猜不到小笨蛋的名字喵~", true, { recallMsg: CONFIG.RECALL_TIME });
            return true;
        }

        const player = match[1].trim();
        if (!player) {
            e.reply("人家猜不到小笨蛋的名字喵~", true, { recallMsg: CONFIG.RECALL_TIME });
            return true;
        }

        // 检查是否已在白名单
        if (this.manager.list[user_id].includes(player)) {
            e.reply(`${player}已经在白名单了喵~`, true, { recallMsg: CONFIG.RECALL_TIME });
            return true;
        }

        // 检查数量限制
        const config = await this.manager.loadConfig();
        if (this.manager.list[user_id].length >= config.maxbind) {
            e.reply(
                `你添加的白名单数已达上限喵~,也许你可以通过[#mcw删 <用户名>]的方式删掉一些。(可以通过[#mcwl]查询已绑定的情况)`, 
                true
            );
            return true;
        }

        try {
            const result = await this.manager.makeApiRequest(player, "add");
            if (result === false) {
                e.reply("请求出错，请检查配置或联系管理员喵~", true, { recallMsg: CONFIG.RECALL_TIME });
                return true;
            }

            const match = result.match(/Player\s+(\S+)\s+added/i);
            const actualPlayer = match ? match[1] : player;
            
            this.manager.list[user_id].push(player);
            await this.manager.savePlayerList();
            
            e.reply(`${actualPlayer}添加白名单了喵，若无效请联系管理员~`, true, { recallMsg: CONFIG.RECALL_TIME });
            e.reply(`已添加${this.manager.list[user_id].length}个白名单`, true);
            return true;
        } catch (error) {
            console.error("添加玩家失败:", error);
            e.reply("添加失败，请稍后重试喵~", true, { recallMsg: CONFIG.RECALL_TIME });
            return true;
        }
    }

    async deletePlayer(e) {
        await this.ensureInitialized();
        
        try {
            const user = await this.manager.getUserFromMessage(e);
            const match = e.msg.match(/^#?mcw\s*删\s*(\S+)?$/);
            const player = match ? match[1]?.trim() : null;

            if (!this.manager.list[user.user_id] || this.manager.list[user.user_id].length === 0) {
                e.reply("你还没有添加任何白名单喵~", true, { recallMsg: CONFIG.RECALL_TIME });
                return true;
            }

            if (!player) {
                // 删除最后一个玩家
                const removedPlayer = this.manager.list[user.user_id].pop();
                await this.manager.savePlayerList();
                e.reply(`已删除${removedPlayer}`, true);
                return true;
            }

            const index = this.manager.list[user.user_id].findIndex(
                p => p.toLowerCase() === player.toLowerCase()
            );

            if (index === -1) {
                e.reply(`${player}不在你的白名单里喵~`, true, { recallMsg: CONFIG.RECALL_TIME });
                return true;
            }

            this.manager.list[user.user_id].splice(index, 1);
            await this.manager.savePlayerList();
            
            // TODO: 从服务器删除指定玩家
            e.reply(`已删除${player}`, true);
            return true;
        } catch (error) {
            console.error("删除玩家失败:", error);
            e.reply("删除失败，请稍后重试喵~", true, { recallMsg: CONFIG.RECALL_TIME });
            return true;
        }
    }

    async help(e) {
        const helpText = `白名单管理帮助：
1. 添加白名单: #mcw 玩家名
2. 查询白名单: #mcwl （可@别人）
3. 查询玩家绑定情况: #mcwf 玩家名
4. 删除白名单: #mcw 删 玩家名 （或不写玩家名则删除最后一个）
5. 查看帮助: #mcwhelp / mcw帮助
6. 查询服务器状态: #mcws`;

        e.reply(helpText, true);
        return true;
    }

    async queryUser(e) {
        await this.ensureInitialized();
        
        const match = e.msg.match(/^#?mcwf(\S+)$/);
        const player = match ? match[1].trim() : null;
        
        if (!player) {
            e.reply("请检查输入喵~", true, { recallMsg: CONFIG.RECALL_TIME });
            return true;
        }

        const playerLower = player.toLowerCase();
        for (const [user_id, players] of Object.entries(this.manager.list)) {
            if (players.some(p => p.toLowerCase() === playerLower)) {
                e.reply(`${player}在 ${user_id} 的白名单里喵~`, true);
                return true;
            }
        }
        
        e.reply(`未找到${player}`, true);
        return true;
    }

    async status(e) {
        await this.ensureInitialized();
        
        try {
            const config = await this.manager.loadConfig();
            const server = config.mcserver;
            
            if (!server || server.trim() === "") {
                e.reply("请先在配置文件中设置mcserver喵~", true);
                return true;
            }

            const serverName = (typeof config.serverName === 'string' && config.serverName.trim() !== "")
                ? config.serverName.trim()
                : "mcwhitelist";

            const url = `https://api.mcstatus.io/v2/status/java/${server}`;
            const response = await fetch(url);
            const json = await response.json();

            if (!json.online) {
                e.reply("服务器离线喵~", true);
                return true;
            }

            const players = json.players;
            let arkCount = 0;

            // 并发下载头像
            const avatarPromises = players.list.map(async (player, index) => {
                if (player.uuid === '00000000-0000-0000-0000-000000000000') {
                    arkCount++;
                    return null;
                }

                await this.manager.downloadAvatar(player.uuid, index);
                return { uuid: player.uuid, name: player.name_clean };
            });

            // 同时下载背景图
            const backgroundPromise = this.manager.downloadBackground();

            const [avatarResults] = await Promise.all([
                Promise.all(avatarPromises),
                backgroundPromise
            ]);

            const filteredList = avatarResults.filter(p => p !== null);

            // 保存头像缓存
            await this.manager.saveAvatarCache();

            return await e.runtime.render('mcwhitelist-plugin', 'status.html', {
                players: filteredList,
                arkCount,
                server,
                serverName
            }, { scale: CONFIG.RENDER_SCALE, e });

        } catch (error) {
            console.error("获取服务器状态失败:", error);
            e.reply("获取服务器状态失败喵~", true);
            return true;
        }
    }
}
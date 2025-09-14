import fetch from 'node-fetch';
import {CONFIG,McWhitelistManager} from "./McWhitelistManager.js";

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
            const match = e.msg.match(/^#?mcw\s*删\s*(\S+)?$/); // 正则匹配玩家名
            const player = match ? match[1]?.trim() : null;

            // 如果没有玩家名，默认删除最后一个玩家
            if (!player) {
                if (this.manager.list[user.user_id] && this.manager.list[user.user_id].length > 0) {
                    const removedPlayer = this.manager.list[user.user_id].pop(); // 删除最后一个
                    await this.manager.savePlayerList(); // 保存更新后的白名单
                    e.reply(`已删除 ${removedPlayer} 的白名单喵~`, true); // 回复删除的玩家
                    return true;
                } else {
                    e.reply("你还没有添加任何白名单喵~", true, { recallMsg: CONFIG.RECALL_TIME });
                    return true;
                }
            }

            // 查找该玩家是否在白名单中
            const index = this.manager.list[user.user_id].findIndex(p => p.toLowerCase() === player.toLowerCase());

            if (index === -1) {
                e.reply(`${player}不在你的白名单里喵~`, true, { recallMsg: CONFIG.RECALL_TIME });
                return true;
            }

            // 删除指定玩家
            this.manager.list[user.user_id].splice(index, 1); // 删除指定玩家
            await this.manager.savePlayerList(); // 保存更新后的白名单

            try {
                const result = await this.manager.makeApiRequest(player, "remove");
                if (result === false) {
                    e.reply("请求出错，请检查配置或联系管理员喵~", true, { recallMsg: CONFIG.RECALL_TIME });
                    return true;
                }

                const match = result.match(/Player\s+(\S+)\s+removed/i);
                const actualPlayer = match ? match[1] : player;

                e.reply(`已从服务器中删除 ${actualPlayer} 的白名单喵~`, true); // 回复删除成功
            } catch (error) {
                console.error("删除玩家API请求失败:", error);
                e.reply("从服务器删除玩家失败，请稍后重试喵~", true, { recallMsg: CONFIG.RECALL_TIME });
                return true;
            }

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
            const players = json.players.list;
            let arkCount = 0;
            // console.log(players);

            // 并发下载头像
            const avatarPromises = players.map(async (player, index) => {
                if (player.uuid === '00000000-0000-0000-0000-000000000000') {
                    arkCount++;
                    return null;
                }
                try {
                    if (this.avatarCache[player.uuid] === this.today) {
                        return null;
                    }
                } catch {
                    //没必要处理
                }

                await this.manager.downloadAvatar(player.uuid, index)

                return { uuid: player.uuid, name: player.name_clean };
            });

            // 同时下载背景图
            const backgroundPromise = this.manager.downloadBackground();

            const [avatarResults] = await Promise.all([
                Promise.all(avatarPromises),
                backgroundPromise
            ]);

            const filteredList = avatarResults.filter(p => p !== null);
            let tpsData = -1;
            try {
                const apiUrl = config.mcwhapi.startsWith('http')
                    ? config.mcwhapi
                    : `http://${config.mcwhapi}`;

                const tpsRes = await fetch(`${apiUrl}/server/tps`, {
                    method: 'GET',
                    headers: {
                        'Accept': 'application/json',
                        'Authorization': `Bearer ${config.mcwhkey}`
                    }
                });
                tpsData = parseFloat(await tpsRes.text()).toFixed(2);
            } catch (error) {
                console.error('获取TPS失败:', error);
                e.reply("获取TPS失败喵~");
            }

            // 保存头像缓存
            await this.manager.saveAvatarCache();

            return await e.runtime.render('mcwhitelist-plugin', 'status.html', {
                players: filteredList,
                arkCount,
                server,
                serverName,
                tps: tpsData,
            }, { scale: CONFIG.RENDER_SCALE, e });

        } catch (error) {
            console.error("获取服务器状态失败:", error);
            e.reply("获取服务器状态失败喵~", true);
            return true;
        }
    }
}
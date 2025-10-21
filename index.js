import { CONFIG, McWhitelistManager } from "./McWhitelistManager.js";

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
                    reg: '^#?mcwp',
                    fnc: 'queryplay'
                },
                {
                    reg: '^#?mcw\\s*删\\s*(\\S+)?$',
                    fnc: 'deletePlayer'
                },
                {
                    reg: '^#?mcw\\s+(\\S+)$',
                    fnc: 'addPlayer'
                },
                {
                    reg: '^#?mcw(?:help|帮助)$',
                    fnc: 'help'
                },
                {
                    reg: '^#?mcwf\\S+$',
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
        const config = await this.manager.loadConfig();

        const user_id = e.user_id;
        if (!this.manager.list[user_id]) {
            this.manager.list[user_id] = [];
        }

        const match = e.msg.match(/^#?mcw(?!l)\s+(\S+)$/);
        const player = match ? match[1].trim() : null;

        if (!player) {
            e.reply("人家猜不到小笨蛋的名字喵~", true, { recallMsg: CONFIG.RECALL_TIME });
            return true;
        }

        if (this.manager.list[user_id].includes(player)) {
            e.reply(`${player} 已在白名单中喵~`, true, { recallMsg: CONFIG.RECALL_TIME });
            return true;
        }


        if (this.manager.list[user_id].length >= Number(config.maxbind)) {
            e.reply(
                `你已达到白名单上限，请删除一些不需要的玩家喵~`,
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

            this.manager.list[user_id].push(player);
            await this.manager.savePlayerList();
            e.reply(`${player} 已添加到白名单喵~`, true);
            e.reply(`你已添加 ${this.manager.list[user_id].length} 个白名单`, true);
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

            // 如果没有玩家名，默认删除最后一个玩家
            if (!player) {
                if (this.manager.list[user.user_id] && this.manager.list[user.user_id].length > 0) {
                    const removedPlayer = this.manager.list[user.user_id].pop(); // 删除最后一个
                    await this.manager.savePlayerList(); // 保存更新后的白名单
                    e.reply(`已删除 ${removedPlayer} 的白名单喵~`, true);
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

                e.reply(`已从服务器中删除 ${actualPlayer} 的白名单喵~`, true);
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

        const match = e.msg.match(/^#?mcwf\S+$/);
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
            const response = await this.manager.fetchWithRetry(url);
            if (!response.ok) {
                throw new Error(`状态接口响应失败: ${response.status}`);
            }
            const json = await response.json();

            if (!json.online) {
                e.reply("服务器离线喵~", true);
                return true;
            }
            const players = json.players.list;
            let arkCount = 0;
            const today = new Date().toISOString().slice(0, 10);
            // 并发下载头像
            const avatarPromises = players.map(async (player, index) => {
                if (player.uuid === '00000000-0000-0000-0000-000000000000') {
                    arkCount++;
                    return null;
                }
                try {
                    if (McWhitelistManager.avatarCache[player.uuid] != today) {
                        await this.manager.downloadAvatar(player.uuid, index)
                    }
                } catch {
                    await this.manager.downloadAvatar(player.uuid, index)
                }


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

                const tpsRes = await this.manager.fetchWithRetry(`${apiUrl}/server/tps`, {
                    method: 'GET',
                    headers: {
                        'Accept': 'application/json',
                        'Authorization': `Bearer ${config.mcwhkey}`
                    }
                });
                if (!tpsRes.ok) {
                    throw new Error(`TPS接口响应失败: ${tpsRes.status}`);
                }
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
    async queryplay(e) {
        await this.ensureInitialized();

        const user = await this.manager.getUserFromMessage(e);
        const userList = this.manager.list[user.user_id] || [];
        // console.log(userList);
        if (userList.length === 0) {
            e.reply("你还没有绑定角色喵~", true, { recallMsg: CONFIG.RECALL_TIME });
            return true;
        }
        // console.log(userList[0]);

        const player = userList ? userList[0].trim() : null;

        if (!player) {
            e.reply("请检查输入喵~", true, { recallMsg: CONFIG.RECALL_TIME });
            return true;
        }

        try {
            const config = await this.manager.loadConfig();
            const apiUrl = config.mcwhapi.startsWith('http')
                ? config.mcwhapi
                : `http://${config.mcwhapi}`;

            const StatsRes = await this.manager.fetchWithRetry(`${apiUrl}/server/playStats/?player=${player}`, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json',
                    'Authorization': `Bearer ${config.mcwhkey}`
                }
            });
            if (!StatsRes.ok) {
                throw new Error(`玩家统计接口响应失败: ${StatsRes.status}`);
            }
            // console.log(await StatsRes.text()); 
            const playStats = await StatsRes.json();
            // console.log(playStats);
            const uuid = playStats.uuid;
            const custom = playStats.custom;
            const playtime = await this.ticksToTime(custom['minecraft:play_time'])
            const sleep = custom['minecraft:sleep_in_bed'] ?? 0

            const fly = custom['minecraft:fly_one_cm'] / 100
            const walk = custom['minecraft:walk_one_cm'] / 100

            const fish = custom['minecraft:fish_caught'] ?? 0;
            const traded = custom['minecraft:traded_with_villager'] ?? 0;

            const deaths = custom['minecraft:deaths'] ?? 0
            const killed = playStats.killed ?? 0
            const totalKills = this.sumObjectValues(killed);

            const mined = playStats.mined
            const totalMineds = this.sumObjectValues(mined);

            const debris = (playStats.mined["minecraft:ancient_debris"] ?? 0).toFixed(0);
            const diamondOre = playStats.mined["minecraft:diamond_ore"] ?? 0;
            const deepslateDiamondOre = playStats.mined["minecraft:deepslate_diamond_ore"] ?? 0;
            const diamond = (diamondOre + deepslateDiamondOre).toFixed(0);

            const today = new Date().toISOString().slice(0, 10);
            try {
                if (McWhitelistManager.skinCache[uuid] != today) {
                    await this.manager.downloadSkin(uuid)
                }
            } catch (error) {
                await this.manager.downloadSkin(uuid)
            }
            await this.manager.downloadBackground();
            await this.manager.saveSkinCache()


            return await e.runtime.render('mcwhitelist-plugin', 'play.html', {
                uuid,
                playtime,
                deaths,
                totalKills,
                totalMineds,
                diamond,
                debris,
                fish,
                traded,
                fly: fly.toFixed(0),
                walk: walk.toFixed(0),
                sleep
            }, { scale: CONFIG.RENDER_SCALE, e });
        } catch (error) {
            console.error('获取统计信息失败:', error);
            e.reply("获取统计信息失败喵~");
        }

    }
    async ticksToTime(ticks) {
        const totalSeconds = ticks / 20;
        const timeUnits = [
            { unit: '年', value: 365 * 24 * 60 * 60 },
            { unit: '个月', value: 30 * 24 * 60 * 60 },
            { unit: '天', value: 24 * 60 * 60 },
            { unit: '小时', value: 60 * 60 },
            { unit: '分', value: 60 },
            { unit: '秒', value: 1 }
        ];

        let remaining = totalSeconds;
        const result = [];

        for (const { unit, value } of timeUnits) {
            if (remaining >= value) {
                const count = Math.floor(remaining / value);
                remaining %= value;

                if (count > 0) {
                    result.push(`${count}${unit}`);

                    // 最多显示2个时间单位（如：1天3小时，而不是1天3小时25分）
                    if (result.length >= 2) {
                        break;
                    }
                }
            }
        }

        if (result.length === 0 && totalSeconds > 0) {
            return '1秒';
        }

        return result.join('') || '0秒';
    }
    sumObjectValues(obj) {
        if (!obj || typeof obj !== 'object') return 0;

        let sum = 0;
        for (const key in obj) {
            if (Object.prototype.hasOwnProperty.call(obj, key)) {
                sum += obj[key];
            }
        }
        return sum;
    }

}

import fs from "fs/promises";
import YAML from "yaml";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PATHS = {
    config: path.join(__dirname, "config.yaml"),
    exampleConfig: path.join(__dirname, "config.example.yaml"),
    avatarDir: path.join(__dirname, 'resources/avatars'),
    skinDir: path.join(__dirname, 'resources/skins'),
    background: path.join(__dirname, 'resources/background.jpg')
};
export const CONFIG = {
    REQUEST_TIMEOUT: 10000,
    REQUEST_RETRIES: 2,
    REQUEST_RETRY_DELAY: 500,
    REQUEST_BACKOFF_FACTOR: 2,
    RETRY_STATUS_CODES: [408, 425, 429, 500, 502, 503, 504],
    AVATAR_SIZE: 64,
    RENDER_SCALE: 1.2,
    RECALL_TIME: 15,
    AVATAR_DELAY_RANGE: { min: 120, max: 500 } // ms
};
export class McWhitelistManager {
    constructor() {
        this.avatarCache = {};
        this.skinCache = {};
        this.list = {};
        this.config = null;
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    isRetryableError(error) {
        if (!error) return false;
        if (error.name === 'AbortError') {
            return true;
        }
        const retryableCodes = ['ECONNRESET', 'ECONNREFUSED', 'EPIPE', 'ETIMEDOUT', 'EAI_AGAIN', 'ECONNABORTED', 'ENOTFOUND'];
        return retryableCodes.includes(error.code) || error.type === 'system';
    }

    async fetchWithRetry(url, options = {}, overrides = {}) {
        const {
            timeout = CONFIG.REQUEST_TIMEOUT,
            retries = CONFIG.REQUEST_RETRIES,
            retryDelay = CONFIG.REQUEST_RETRY_DELAY,
            backoffFactor = CONFIG.REQUEST_BACKOFF_FACTOR,
            retryOnStatuses = CONFIG.RETRY_STATUS_CODES
        } = overrides;

        const maxAttempts = Math.max(1, retries + 1);
        let lastError = null;

        for (let attempt = 0; attempt < maxAttempts; attempt++) {
            const controller = new AbortController();
            const attemptOptions = { ...options, signal: controller.signal };
            const timeoutId = setTimeout(() => controller.abort(), timeout);

            try {
                const response = await fetch(url, attemptOptions);
                clearTimeout(timeoutId);

                if (!response.ok && retryOnStatuses.includes(response.status) && attempt + 1 < maxAttempts) {
                    await this.delay(retryDelay * Math.pow(backoffFactor, attempt));
                    continue;
                }

                return response;
            } catch (error) {
                clearTimeout(timeoutId);
                lastError = error;

                if (attempt + 1 >= maxAttempts || !this.isRetryableError(error)) {
                    throw error;
                }

                await this.delay(retryDelay * Math.pow(backoffFactor, attempt));
            }
        }

        throw lastError ?? new Error('Request failed after retries');
    }

    async initialize() {
        try {
            // 初始化配置文件
            await this.initializeConfig();

            // 加载缓存数据
            await Promise.all([
                this.loadAvatarCache(),
                this.loadPlayerList(),
                this.loadSkinCache()
            ]);
            try {
                // 检查目录是否存在
                await fs.access(PATHS.avatarDir);
                await fs.access(PATHS.skinDir);
            } catch (error) {
                // 如果目录不存在或有其他错误，创建目录
                try {
                    await fs.mkdir(PATHS.avatarDir, { recursive: true });
                    await fs.mkdir(PATHS.skinDir, { recursive: true });
                } catch (mkdirError) {
                    console.error('目录创建失败:', mkdirError);
                }
            }

            logger.mark("Ciallo～(∠・ω＜ )⌒★ - McWhitelist插件初始化完成");
        } catch (error) {
            console.error("插件初始化失败:", error);
            throw error;
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
        if (this.config) {
            return this.config;
        }
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
            // let cacheData = await redis.get('avatarCache');
            // if (cacheData) {
            //     // 如果旧键存在，迁移到新键 'mcw:avatarCache'
            //     await redis.set('mcw:avatarCache', cacheData);  // 设置到新键
            //     await redis.del('avatarCache');  // 删除旧键（可选）
            // }

            let cacheData = await redis.get('mcw:avatarCache');

            if (cacheData) {
                this.avatarCache = JSON.parse(cacheData);
            } else {
                this.avatarCache = {};
            }
        } catch (error) {
            console.error("加载头像缓存失败:", error);
        }
    }

    async loadPlayerList() {
        try {
            // let content = await redis.get('playerList');
            // if (content) {
            //     // 如果旧键存在，迁移到新键 'mcw:playerList'
            //     await redis.set('mcw:playerList', content);  // 设置到新键
            //     await redis.del('playerList');  // 删除旧键（可选）
            // }

            let content = await redis.get('mcw:playerList');

            if (content) {
                this.list = JSON.parse(content);
            } else {
                this.list = {};
            }
        } catch (error) {
            console.error("加载玩家列表失败:", error);
            this.list = {};
        }
    }
    async loadSkinCache() {
        try {
            let cacheData = await redis.get('mcw:skinCache');
            if (cacheData) {
                this.skinCache = JSON.parse(cacheData);
            } else {
                this.skinCache = {};
            }
        } catch (error) {
            console.error("加载皮肤缓存失败:", error);
            this.skinCache = {};
        }
    }



    async savePlayerList() {
        try {
            await redis.set('mcw:playerList', JSON.stringify(this.list));
        } catch (error) {
            console.error("保存玩家列表失败:", error);
        }
    }

    async saveAvatarCache() {
        try {
            await redis.set('mcw:avatarCache', JSON.stringify(this.avatarCache));
        } catch (error) {
            console.error("保存头像缓存失败:", error);
        }
    }
    async saveSkinCache() {
        try {
            await redis.set('mcw:skinCache', JSON.stringify(this.skinCache));
        } catch (error) {
            console.error("保存皮肤缓存失败:", error);
        }
    }

    async makeApiRequest(player, action) {
        try {
            const config = await this.loadConfig();
            const apiUrl = config.mcwhapi.startsWith('http')
                ? config.mcwhapi
                : `http://${config.mcwhapi}`;

            const response = await this.fetchWithRetry(`${apiUrl}/whitelist/${action}?player=${player}`, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json',
                    'Authorization': `Bearer ${config.mcwhkey}`
                }
            });

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

        try {
            const today = new Date().toISOString().slice(0, 10);
            const delay = Math.random() * (CONFIG.AVATAR_DELAY_RANGE.max - CONFIG.AVATAR_DELAY_RANGE.min) + CONFIG.AVATAR_DELAY_RANGE.min;
            await new Promise(resolve => setTimeout(resolve, index * delay));

            const avatarUrl = `https://crafatar.com/renders/head/${uuid}?size=${CONFIG.AVATAR_SIZE}&overlay`;
            const response = await this.fetchWithRetry(avatarUrl);

            if (!response.ok) {
                throw new Error(`无法获取 ${uuid} 的头像: ${response.status}`);
            }

            const buffer = await response.arrayBuffer();
            await fs.writeFile(filePath, Buffer.from(buffer));
            this.avatarCache[uuid] = today;  // 更新缓存

            return true;
        } catch (error) {
            console.error(`下载头像失败 (${uuid}):`, error);
            return false;
        }
    }

    async downloadSkin(uuid) {
        const filePath = path.join(PATHS.skinDir, `${uuid}.png`);
        try {
            const today = new Date().toISOString().slice(0, 10);
            const skinUrl = `https://crafatar.com/renders/body/${uuid}`;
            const response = await this.fetchWithRetry(skinUrl);
            if (!response.ok) {
                throw new Error(`无法获取 ${uuid} 的皮肤: ${response.status}`);
            }
            const buffer = await response.arrayBuffer();
            await fs.writeFile(filePath, Buffer.from(buffer));
            this.skinCache[uuid] = today;  // 更新缓存
            return true;
        } catch (error) {
            console.error(`下载皮肤失败 (${uuid}):`, error);
            return false;
        }
    }

    async downloadBackground() {
        try {
            const response = await this.fetchWithRetry("https://t.alcy.cc/moez");
            if (response.ok) {
                const buffer = Buffer.from(await response.arrayBuffer());
                await fs.writeFile(PATHS.background, buffer);
            } else {
                console.warn(`下载背景图失败，状态码: ${response.status}`);
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

}

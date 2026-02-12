const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const http = require('http'); // أضفنا هذا السطر

// === إضافة سيرفر بسيط لإرضاء منصة ريندر ===
http.createServer((req, res) => {
    res.write('Quantum Bot is Running!');
    res.end();
}).listen(process.env.PORT || 3000);

// ====================== CONFIG ======================
// سحب التوكن من إعدادات ريندر التي جهزناها سابقاً لزيادة الأمان
const TOKEN = process.env.BOT_TOKEN || '8227730255:AAHhre--nWuw45MNZvdEjR0buRaCS40iefw';
const ADMIN_ID = '6590369604';
const VERSION = 'Quantum v2.0';

const bot = new TelegramBot(TOKEN, { polling: true });
// ... باقي الكود الخاص بك يستمر من هنا كما هو تماماً ...
const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

// ====================== CONFIG ======================
const TOKEN = '8227730255:AAHhre--nWuw45MNZvdEjR0buRaCS40iefw';
const ADMIN_ID = '6590369604';
const VERSION = 'Quantum v2.0';

const bot = new TelegramBot(TOKEN, { polling: true });

// ====================== DATABASE ======================
const DB_FILE = path.join(__dirname, 'quantum_db.json');

function loadDB() {
    try {
        if (fs.existsSync(DB_FILE)) {
            return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
        }
    } catch (e) {}
    return {
        signals: [],
        performance: { total_trades: 0, winning_trades: 0, losing_trades: 0, total_profit: 0, win_rate: 0 },
        users: {},
        settings: { learning_factor: 1.02 }
    };
}

function saveDB(db) {
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}

let db = loadDB();

// ====================== SYMBOLS ======================
let SYMBOLS = ['BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'SOLUSDT', 'XRPUSDT', 'ADAUSDT', 'DOGEUSDT', 'DOTUSDT', 'MATICUSDT', 'LINKUSDT'];

// ====================== TECHNICAL ANALYSIS ======================
function calculateRSI(prices) {
    if (prices.length < 15) return 50;
    let gains = 0, losses = 0;
    for (let i = 1; i <= 14; i++) {
        const diff = prices[i] - prices[i - 1];
        if (diff > 0) gains += diff;
        else losses -= diff;
    }
    const avgGain = gains / 14;
    const avgLoss = losses / 14;
    if (avgLoss === 0) return 100;
    return 100 - (100 / (1 + (avgGain / avgLoss)));
}

function calculateMACD(prices) {
    if (prices.length < 26) return { macd: 0, signal: 0, histogram: 0 };
    const ema12 = calculateEMA(prices, 12);
    const ema26 = calculateEMA(prices, 26);
    const macd = ema12 - ema26;
    const signal = calculateEMA(prices.slice(-9), 9) || 0;
    return { macd, signal, histogram: macd - signal };
}

function calculateEMA(prices, period) {
    if (prices.length < period) return null;
    const multiplier = 2 / (period + 1);
    let ema = prices[0];
    for (let i = 1; i < prices.length; i++) {
        ema = (prices[i] - ema) * multiplier + ema;
    }
    return ema;
}

function findKeyLevels(highs, lows) {
    const levels = [];
    const tolerance = 0.003;
    const allPrices = [...highs, ...lows].sort((a, b) => a - b);
    let cluster = [];
    for (let i = 0; i < allPrices.length; i++) {
        if (cluster.length === 0) cluster.push(allPrices[i]);
        else if (Math.abs(allPrices[i] - cluster[0]) / cluster[0] < tolerance) cluster.push(allPrices[i]);
        else {
            if (cluster.length >= 3) {
                levels.push({
                    price: cluster.reduce((a, b) => a + b, 0) / cluster.length,
                    type: highs.includes(cluster[0]) ? 'resistance' : 'support',
                    strength: cluster.length
                });
            }
            cluster = [allPrices[i]];
        }
    }
    return levels.sort((a, b) => b.strength - a.strength).slice(0, 2);
}

async function analyzeSymbol(symbol) {
    try {
        const [klinesRes, tickerRes] = await Promise.all([
            axios.get(`https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=1h&limit=100`),
            axios.get(`https://api.binance.com/api/v3/ticker/24hr?symbol=${symbol}`)
        ]);

        const klines = klinesRes.data;
        const ticker = tickerRes.data;
        
        const closes = klines.map(k => parseFloat(k[4]));
        const highs = klines.map(k => parseFloat(k[2]));
        const lows = klines.map(k => parseFloat(k[3]));
        
        const price = parseFloat(ticker.lastPrice);
        const volume = parseFloat(ticker.quoteVolume);
        const change = parseFloat(ticker.priceChangePercent);
        
        const rsi = calculateRSI(closes);
        const macd = calculateMACD(closes);
        const levels = findKeyLevels(highs, lows);
        
        let signal = 'HOLD', confidence = 50;
        if (rsi < 30) { signal = 'BUY'; confidence = 75; }
        else if (rsi > 70) { signal = 'SELL'; confidence = 75; }
        else if (macd.histogram > 0 && change > 0) { signal = 'BUY'; confidence = 65; }
        else if (macd.histogram < 0 && change < 0) { signal = 'SELL'; confidence = 65; }
        
        return { symbol, price, volume, change, rsi, macd, levels, signal, confidence };
    } catch (e) {
        return null;
    }
}

// ====================== SIGNAL MANAGER ======================
function generateSignal(analysis) {
    if (!analysis || analysis.signal === 'HOLD') return null;
    if (analysis.confidence < 65) return null;
    if (analysis.volume < 30000000) return null;
    
    const isBuy = analysis.signal === 'BUY';
    const entry = analysis.price;
    const learning = db.settings.learning_factor || 1.02;
    
    const targets = [
        entry,
        isBuy ? entry * 1.015 : entry * 0.985,
        isBuy ? entry * 1.03 : entry * 0.97,
        isBuy ? entry * 1.045 : entry * 0.955
    ];
    
    const stopLoss = isBuy ? entry * 0.985 : entry * 1.015;
    const riskReward = ((targets[1] - entry) / Math.abs(entry - stopLoss)).toFixed(2);
    
    return {
        symbol: analysis.symbol,
        type: isBuy ? 'LONG' : 'SHORT',
        entry: entry,
        targets: targets,
        stopLoss: stopLoss,
        confidence: analysis.confidence,
        riskReward: riskReward,
        rsi: analysis.rsi,
        change: analysis.change,
        volume: analysis.volume,
        levels: analysis.levels
    };
}

function formatArabicMessage(signal) {
    const isBuy = signal.type === 'LONG';
    const icon = isBuy ? '📈' : '📉';
    const action = isBuy ? 'شراء / طويل' : 'بيع / قصير';
    const bg = isBuy ? '━━━━━━━ صعودي ━━━━━━━' : '━━━━━━━ هبوطي ━━━━━━━';
    const binanceLink = `https://www.binance.com/en/trade/${signal.symbol.replace('USDT', '_USDT')}`;
    
    let msg = `${icon} كابيتال إيدج كوانتوم ${icon}\n`;
    msg += `${bg}\n\n`;
    msg += `⚡ [🚀 تداول على بينانس](${binanceLink})\n\n`;
    msg += `💎 **${signal.symbol}**\n`;
    msg += `${isBuy ? '🟢' : '🔴'} **الإجراء:** ${action}\n`;
    msg += `🔥 **الثقة:** ${signal.confidence}%\n\n`;
    msg += `📍 **سعر الدخول:** ${signal.entry.toFixed(4)}\n`;
    msg += `🎯 **الهدف 1:** ${signal.targets[1].toFixed(4)} (${((signal.targets[1] - signal.entry) / signal.entry * 100).toFixed(2)}%)\n`;
    msg += `🎯 **الهدف 2:** ${signal.targets[2].toFixed(4)} (${((signal.targets[2] - signal.entry) / signal.entry * 100).toFixed(2)}%)\n`;
    msg += `🎯 **الهدف 3:** ${signal.targets[3].toFixed(4)} (${((signal.targets[3] - signal.entry) / signal.entry * 100).toFixed(2)}%)\n`;
    msg += `🛡️ **وقف الخسارة:** ${signal.stopLoss.toFixed(4)} (${Math.abs((signal.stopLoss - signal.entry) / signal.entry * 100).toFixed(2)}%)\n`;
    msg += `⚖️ **المخاطرة/العائد:** 1:${signal.riskReward}\n\n`;
    msg += `━━━━━━ المؤشرات الفنية ━━━━━━\n`;
    msg += `📊 **RSI:** ${signal.rsi.toFixed(2)} ${signal.rsi < 30 ? '🔻' : signal.rsi > 70 ? '🔺' : '➖'}\n`;
    msg += `📈 **التغير اليومي:** ${signal.change > 0 ? '+' : ''}${signal.change.toFixed(2)}%\n`;
    msg += `💧 **الحجم:** ${(signal.volume / 1000000).toFixed(1)}M\n`;
    msg += `📶 **الاتجاه:** ${isBuy ? 'صعودي' : 'هبوطي'}\n\n`;
    
    if (signal.levels && signal.levels.length > 0) {
        msg += `━━━━ المستويات الرئيسية ━━━━\n`;
        signal.levels.forEach(level => {
            const levelIcon = level.type === 'support' ? '🟢' : '🔴';
            const levelType = level.type === 'support' ? 'الدعم' : 'المقاومة';
            const distance = ((level.price - signal.entry) / signal.entry * 100).toFixed(2);
            msg += `${levelIcon} **${levelType}:** ${level.price.toFixed(4)} (${distance}%)\n`;
        });
        msg += `\n`;
    }
    
    const now = new Date();
    msg += `⏱️ ${now.toLocaleTimeString('ar-SA', { timeZone: 'Asia/Riyadh' })}\n`;
    msg += `💼 نظام التداول الكوانتوم ${VERSION}\n\n`;
    msg += `[📱 فتح في التطبيق](binance://) | [📊 عرض الرسم البياني](${binanceLink})`;
    
    return { message: msg, options: { parse_mode: 'Markdown', disable_web_page_preview: false } };
}

function formatEnglishMessage(signal) {
    const isBuy = signal.type === 'LONG';
    const icon = isBuy ? '📈' : '📉';
    const action = isBuy ? 'LONG / BUY' : 'SHORT / SELL';
    const bg = isBuy ? '━━━━━━━ BULLISH ━━━━━━━' : '━━━━━━━ BEARISH ━━━━━━━';
    const binanceLink = `https://www.binance.com/en/trade/${signal.symbol.replace('USDT', '_USDT')}`;
    
    let msg = `${icon} CAPITAL EDGE QUANTUM ${icon}\n`;
    msg += `${bg}\n\n`;
    msg += `⚡ [🚀 TRADE ON BINANCE](${binanceLink})\n\n`;
    msg += `💎 **${signal.symbol}**\n`;
    msg += `${isBuy ? '🟢' : '🔴'} **ACTION:** ${action}\n`;
    msg += `🔥 **CONFIDENCE:** ${signal.confidence}%\n\n`;
    msg += `📍 **ENTRY:** ${signal.entry.toFixed(4)}\n`;
    msg += `🎯 **TP 1:** ${signal.targets[1].toFixed(4)} (${((signal.targets[1] - signal.entry) / signal.entry * 100).toFixed(2)}%)\n`;
    msg += `🎯 **TP 2:** ${signal.targets[2].toFixed(4)} (${((signal.targets[2] - signal.entry) / signal.entry * 100).toFixed(2)}%)\n`;
    msg += `🎯 **TP 3:** ${signal.targets[3].toFixed(4)} (${((signal.targets[3] - signal.entry) / signal.entry * 100).toFixed(2)}%)\n`;
    msg += `🛡️ **SL:** ${signal.stopLoss.toFixed(4)} (${Math.abs((signal.stopLoss - signal.entry) / signal.entry * 100).toFixed(2)}%)\n`;
    msg += `⚖️ **R:R:** 1:${signal.riskReward}\n\n`;
    msg += `━━━━━━ TECHNICALS ━━━━━━\n`;
    msg += `📊 **RSI:** ${signal.rsi.toFixed(2)} ${signal.rsi < 30 ? '🔻' : signal.rsi > 70 ? '🔺' : '➖'}\n`;
    msg += `📈 **24H:** ${signal.change > 0 ? '+' : ''}${signal.change.toFixed(2)}%\n`;
    msg += `💧 **VOL:** ${(signal.volume / 1000000).toFixed(1)}M\n`;
    msg += `📶 **TREND:** ${isBuy ? 'BULLISH' : 'BEARISH'}\n\n`;
    
    if (signal.levels && signal.levels.length > 0) {
        msg += `━━━━ KEY LEVELS ━━━━\n`;
        signal.levels.forEach(level => {
            const levelIcon = level.type === 'support' ? '🟢' : '🔴';
            const levelType = level.type === 'support' ? 'SUPPORT' : 'RESISTANCE';
            const distance = ((level.price - signal.entry) / signal.entry * 100).toFixed(2);
            msg += `${levelIcon} **${levelType}:** ${level.price.toFixed(4)} (${distance}%)\n`;
        });
        msg += `\n`;
    }
    
    msg += `⏱️ ${new Date().toISOString().split('T')[1].split('.')[0]} UTC\n`;
    msg += `💼 Quantum Trading System ${VERSION}\n\n`;
    msg += `[📱 Open in App](binance://) | [📊 View Chart](${binanceLink})`;
    
    return { message: msg, options: { parse_mode: 'Markdown', disable_web_page_preview: false } };
}

// ====================== SCANNER ======================
let isScanning = true;

async function startScan() {
    if (!isScanning) return;
    console.log('🔍 Scanning markets...');
    
    for (const symbol of SYMBOLS) {
        const analysis = await analyzeSymbol(symbol);
        if (analysis) {
            const signal = generateSignal(analysis);
            if (signal) {
                const msgData = formatArabicMessage(signal);
                bot.sendMessage(ADMIN_ID, msgData.message, msgData.options);
                console.log(`✅ Signal sent for ${symbol}`);
                
                db.signals.push({ ...signal, timestamp: Date.now() });
                db.performance.total_trades++;
                saveDB(db);
            }
        }
        await new Promise(r => setTimeout(r, 1000));
    }
    
    setTimeout(startScan, 600000);
}

// ====================== BOT COMMANDS ======================
bot.onText(/\/start/, (msg) => {
    bot.sendMessage(msg.chat.id, 
        `🚀 **مرحباً بك في كابيتال إيدج كوانتوم!** 🚀\n\n` +
        `**الأوامر المتاحة:**\n` +
        `• اكتب اسم العملة: BTC, ETH, SOL\n` +
        `• /تحليل BTC - تحليل مفصل\n` +
        `• /عربي - تعيين العربية\n` +
        `• /english - English language\n` +
        `• /مساعدة - المساعدة\n\n` +
        `⚡ **روابط بينانس السريعة في كل إشارة!**`,
        { parse_mode: 'Markdown' }
    );
});

bot.onText(/\/english/, (msg) => {
    const user = db.users[msg.from.id] || { lang: 'en' };
    user.lang = 'en';
    db.users[msg.from.id] = user;
    saveDB(db);
    bot.sendMessage(msg.chat.id, '✅ English language set');
});

bot.onText(/\/عربي/, (msg) => {
    const user = db.users[msg.from.id] || { lang: 'ar' };
    user.lang = 'ar';
    db.users[msg.from.id] = user;
    saveDB(db);
    bot.sendMessage(msg.chat.id, '✅ تم تعيين اللغة العربية');
});

bot.onText(/\/تحليل (.+)/, async (msg, match) => {
    const symbol = match[1].toUpperCase().replace('USDT', '') + 'USDT';
    bot.sendMessage(msg.chat.id, `🔍 جاري تحليل ${symbol}...`);
    
    const analysis = await analyzeSymbol(symbol);
    if (!analysis) {
        bot.sendMessage(msg.chat.id, `❌ لا يمكن تحليل ${symbol}`);
        return;
    }
    
    const signal = generateSignal(analysis);
    if (signal) {
        const msgData = formatArabicMessage(signal);
        bot.sendMessage(msg.chat.id, msgData.message, msgData.options);
    } else {
        const binanceLink = `https://www.binance.com/en/trade/${symbol.replace('USDT', '_USDT')}`;
        bot.sendMessage(msg.chat.id,
            `📊 **تحليل ${symbol}** 📊\n\n` +
            `⚡ [🚀 تداول على بينانس](${binanceLink})\n\n` +
            `💰 **السعر:** ${analysis.price.toFixed(4)}\n` +
            `📈 **التغير:** ${analysis.change > 0 ? '+' : ''}${analysis.change.toFixed(2)}%\n` +
            `📊 **RSI:** ${analysis.rsi.toFixed(2)}\n` +
            `💧 **الحجم:** ${(analysis.volume / 1000000).toFixed(1)}M\n\n` +
            `⚠️ لا توجد إشارة تداول قوية حالياً`,
            { parse_mode: 'Markdown', disable_web_page_preview: false }
        );
    }
});

bot.onText(/\/analyze (.+)/, async (msg, match) => {
    const symbol = match[1].toUpperCase().replace('USDT', '') + 'USDT';
    bot.sendMessage(msg.chat.id, `🔍 Analyzing ${symbol}...`);
    
    const analysis = await analyzeSymbol(symbol);
    if (!analysis) {
        bot.sendMessage(msg.chat.id, `❌ Cannot analyze ${symbol}`);
        return;
    }
    
    const signal = generateSignal(analysis);
    if (signal) {
        const user = db.users[msg.from.id] || { lang: 'en' };
        const msgData = user.lang === 'ar' ? formatArabicMessage(signal) : formatEnglishMessage(signal);
        bot.sendMessage(msg.chat.id, msgData.message, msgData.options);
    } else {
        const binanceLink = `https://www.binance.com/en/trade/${symbol.replace('USDT', '_USDT')}`;
        bot.sendMessage(msg.chat.id,
            `📊 **${symbol} ANALYSIS** 📊\n\n` +
            `⚡ [🚀 TRADE ON BINANCE](${binanceLink})\n\n` +
            `💰 **Price:** ${analysis.price.toFixed(4)}\n` +
            `📈 **Change:** ${analysis.change > 0 ? '+' : ''}${analysis.change.toFixed(2)}%\n` +
            `📊 **RSI:** ${analysis.rsi.toFixed(2)}\n` +
            `💧 **Volume:** ${(analysis.volume / 1000000).toFixed(1)}M\n\n` +
            `⚠️ No strong trading signal currently`,
            { parse_mode: 'Markdown', disable_web_page_preview: false }
        );
    }
});

bot.onText(/^([A-Z]{2,10})$/i, async (msg, match) => {
    const symbol = match[1].toUpperCase().replace('USDT', '') + 'USDT';
    const analysis = await analyzeSymbol(symbol);
    
    if (!analysis) {
        bot.sendMessage(msg.chat.id, `❌ ${symbol} not found`);
        return;
    }
    
    const signal = generateSignal(analysis);
    if (signal) {
        const user = db.users[msg.from.id] || { lang: 'en' };
        const msgData = user.lang === 'ar' ? formatArabicMessage(signal) : formatEnglishMessage(signal);
        bot.sendMessage(msg.chat.id, msgData.message, msgData.options);
    } else {
        const binanceLink = `https://www.binance.com/en/trade/${symbol.replace('USDT', '_USDT')}`;
        const user = db.users[msg.from.id] || { lang: 'en' };
        
        if (user.lang === 'ar') {
            bot.sendMessage(msg.chat.id,
                `📊 **${symbol}** 📊\n\n` +
                `⚡ [🚀 تداول على بينانس](${binanceLink})\n\n` +
                `💰 **السعر:** ${analysis.price.toFixed(4)}\n` +
                `📈 **التغير:** ${analysis.change > 0 ? '+' : ''}${analysis.change.toFixed(2)}%\n` +
                `💧 **الحجم:** ${(analysis.volume / 1000000).toFixed(1)}M`,
                { parse_mode: 'Markdown', disable_web_page_preview: false }
            );
        } else {
            bot.sendMessage(msg.chat.id,
                `📊 **${symbol}** 📊\n\n` +
                `⚡ [🚀 TRADE ON BINANCE](${binanceLink})\n\n` +
                `💰 **Price:** ${analysis.price.toFixed(4)}\n` +
                `📈 **Change:** ${analysis.change > 0 ? '+' : ''}${analysis.change.toFixed(2)}%\n` +
                `💧 **Volume:** ${(analysis.volume / 1000000).toFixed(1)}M`,
                { parse_mode: 'Markdown', disable_web_page_preview: false }
            );
        }
    }
});

bot.onText(/\/add (.+)/, (msg, match) => {
    if (msg.from.id.toString() !== ADMIN_ID) return;
    const symbol = match[1].toUpperCase().replace('USDT', '') + 'USDT';
    if (!SYMBOLS.includes(symbol)) {
        SYMBOLS.push(symbol);
        bot.sendMessage(msg.chat.id, `✅ Added ${symbol}`);
    }
});

bot.onText(/\/remove (.+)/, (msg, match) => {
    if (msg.from.id.toString() !== ADMIN_ID) return;
    const symbol = match[1].toUpperCase().replace('USDT', '') + 'USDT';
    SYMBOLS = SYMBOLS.filter(s => s !== symbol);
    bot.sendMessage(msg.chat.id, `✅ Removed ${symbol}`);
});

bot.onText(/\/list/, (msg) => {
    if (msg.from.id.toString() !== ADMIN_ID) return;
    bot.sendMessage(msg.chat.id, `📊 **Monitored Symbols:**\n${SYMBOLS.join('\n')}`);
});

bot.onText(/\/stats/, (msg) => {
    if (msg.from.id.toString() !== ADMIN_ID) return;
    bot.sendMessage(msg.chat.id,
        `📊 **SYSTEM STATS**\n\n` +
        `Total Signals: ${db.signals.length}\n` +
        `Win Rate: ${db.performance.win_rate.toFixed(1)}%\n` +
        `Learning Factor: ${db.settings.learning_factor.toFixed(4)}`
    );
});

// ====================== ERROR HANDLING ======================
bot.on('polling_error', (error) => console.log('Polling error:', error.message));

// ====================== START BOT ======================
console.log('🚀 Starting Capital Edge Quantum...');
bot.sendMessage(ADMIN_ID, 
    `🚀 **CAPITAL EDGE QUANTUM STARTED** 🚀\n\n` +
    `📊 **Symbols:** ${SYMBOLS.length}\n` +
    `🔄 **Scan:** Every 10 min\n` +
    `🌐 **Language:** English & Arabic\n` +
    `⚡ **Binance Links:** Enabled`,
    { parse_mode: 'Markdown' }
);

setTimeout(startScan, 5000);

// ====================== SHUTDOWN ======================
process.on('SIGINT', () => {
    saveDB(db);
    process.exit(0);
});
npm install
node capital-edge-quantum.js

const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');
const http = require('http');

// إعداد السيرفر لضمان البقاء متصلاً (Port Binding)
const port = process.env.PORT || 10000;
http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.write('Quantum Pro System is Active');
    res.end();
}).listen(port, '0.0.0.0');

// إعدادات البوت
const TOKEN = '8227730255:AAHhre--nWuw45MNZvdEjR0buRaCS40iefw';
const bot = new TelegramBot(TOKEN, { polling: true });

// دالة حساب مؤشر RSI (خوارزمية تحليل)
function calculateRSI(prices) {
    if (prices.length < 15) return 50;
    let gains = 0, losses = 0;
    for (let i = 1; i <= 14; i++) {
        const diff = prices[i] - prices[i-1];
        diff > 0 ? gains += diff : losses -= diff;
    }
    const rs = gains / (losses || 1);
    return 100 - (100 / (1 + rs));
}

// الأمر الرئيسي للتفعيل
bot.onText(/\/start/, (msg) => {
    bot.sendMessage(msg.chat.id, "💎 أهلاً بك في نظام **Capital Trading Pro** المطور.\n\nالآن البوت مجهز بخوارزميات تتبع السيولة وتحليل RSI.\nأرسل اسم العملة (مثل BTC) للحصول على تحليل فني فوري.");
});

// نظام التحليل الذكي
bot.onText(/^([A-Z]{2,10})$/i, async (msg, match) => {
    const symbol = match[1].toUpperCase() + 'USDT';
    const chatId = msg.chat.id;
    
    bot.sendMessage(chatId, `🔍 جاري سحب البيانات من Binance وتحليل ${symbol}...`);

    try {
        const [ticker, klines] = await Promise.all([
            axios.get(`https://api.binance.com/api/v3/ticker/24hr?symbol=${symbol}`),
            axios.get(`https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=1h&limit=20`)
        ]);

        const price = parseFloat(ticker.data.lastPrice);
        const change = parseFloat(ticker.data.priceChangePercent);
        const closes = klines.data.map(k => parseFloat(k[4]));
        const rsi = calculateRSI(closes);

        let advice = "⚖️ انتظار";
        if (rsi < 35) advice = "🟢 منطقة شراء (Oversold)";
        else if (rsi > 65) advice = "🔴 منطقة بيع (Overbought)";

        const report = `📊 **تقرير كوانتوم لـ ${symbol}**\n\n` +
                       `💰 السعر الحالي: $${price}\n` +
                       `📈 تغير 24س: ${change}%\n` +
                       `📉 مؤشر RSI: ${rsi.toFixed(2)}\n` +
                       `⚡ الإشارة: ${advice}\n\n` +
                       `⚠️ *هذه تحليلات تقنية وليست نصيحة استثمارية.*`;

        bot.sendMessage(chatId, report, { parse_mode: 'Markdown' });

    } catch (e) {
        bot.sendMessage(chatId, "❌ فشل النظام في العثور على العملة. تأكد من الرمز (مثال: SOL, ETH, BTC).");
    }
});

console.log('🚀 Quantum Pro System Started Successfully!');

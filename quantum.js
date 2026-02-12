const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');
const http = require('http');

// حل مشكلة Port Binding التي طلبها دعم Render
const port = process.env.PORT || 10000; 
http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.write('Quantum Bot is Live!');
    res.end();
}).listen(port, '0.0.0.0', () => {
    console.log(`✅ Server is listening on port ${port}`);
});

// التوكن الخاص بك
const TOKEN = '8227730255:AAHhre--nWuw45MNZvdEjR0buRaCS40iefw';
const bot = new TelegramBot(TOKEN, { polling: true });

bot.onText(/\/start/, (msg) => {
    bot.sendMessage(msg.chat.id, "🚀 البوت يعمل الآن بنجاح يا Jimi!\nأرسل اسم أي عملة (مثال: BTC) للتحليل.");
});

bot.onText(/^([A-Z]{2,10})$/i, async (msg, match) => {
    const symbol = match[1].toUpperCase() + 'USDT';
    try {
        const res = await axios.get(`https://api.binance.com/api/v3/ticker/24hr?symbol=${symbol}`);
        const price = parseFloat(res.data.lastPrice);
        bot.sendMessage(msg.chat.id, `📊 تحليل ${symbol}:\n💰 السعر الحالي: ${price}$`);
    } catch (e) {
        bot.sendMessage(msg.chat.id, "❌ لم أجد هذه العملة، تأكد من كتابة الرمز بشكل صحيح.");
    }
});

console.log('🚀 Quantum Bot started successfully!');

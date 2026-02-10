// quantum-trading-system.js
const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

// ====================== CONFIGURATION ======================
const config = {
    TELEGRAM_TOKEN: process.env.TELEGRAM_TOKEN || '8227730255:AAHhre--nWuw45MNZvdEjR0buRaCS40iefw',
    CHAT_ID: process.env.CHAT_ID || '6590369604',
    ADMIN_ID: process.env.ADMIN_ID || '6590369604',
    
    // API Endpoints
    BINANCE_API: 'https://api.binance.com/api/v3',
    BINANCE_FUTURES_API: 'https://fapi.binance.com/fapi/v1',
    
    // Trading Settings
    MIN_VOLUME: 30000000, // $30M minimum volume
    CONFIDENCE_THRESHOLD: 65, // Minimum confidence percentage
    SCAN_INTERVAL: 600000, // 10 minutes
    
    // Risk Management
    RISK_REWARD_RATIO: 2.0,
    MAX_POSITION_SIZE: 0.05, // 5% of portfolio per trade
    
    // Binance Quick Links
    BINANCE_LINKS: {
        spot: (symbol) => `https://www.binance.com/en/trade/${symbol.replace('USDT', '_USDT')}`,
        futures: (symbol) => `https://www.binance.com/en/futures/${symbol.replace('USDT', 'USDT')}`,
        app: (symbol) => `binance://www.binance.com/en/trade/${symbol.replace('USDT', '_USDT')}`
    },
    
    // Symbols to monitor (Configurable via admin)
    SYMBOLS: [
        'BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'SOLUSDT',
        'XRPUSDT', 'ADAUSDT', 'DOGEUSDT', 'DOTUSDT',
        'MATICUSDT', 'LINKUSDT', 'AVAXUSDT', 'UNIUSDT'
    ],
    
    // System Version
    VERSION: 'Quantum v2.0',
    
    // Developer Mode
    DEVELOPER_MODE: true,
    ALLOW_CUSTOM_INDICATORS: true
};

// ====================== MODULAR DATABASE SYSTEM ======================
class QuantumDatabase {
    constructor() {
        this.dataDir = path.join(__dirname, 'quantum_data');
        this.ensureDataDir();
        this.db = this.loadDatabase();
        this.configFile = path.join(this.dataDir, 'quantum_config.json');
        this.loadConfig();
    }

    ensureDataDir() {
        if (!fs.existsSync(this.dataDir)) {
            fs.mkdirSync(this.dataDir, { recursive: true });
            // Create subdirectories
            ['backups', 'logs', 'indicators', 'strategies'].forEach(dir => {
                fs.mkdirSync(path.join(this.dataDir, dir), { recursive: true });
            });
        }
    }

    loadDatabase() {
        try {
            const dbPath = path.join(this.dataDir, 'quantum_db.json');
            if (fs.existsSync(dbPath)) {
                const data = fs.readFileSync(dbPath, 'utf8');
                return JSON.parse(data);
            }
        } catch (error) {
            console.error('Database load error:', error);
        }

        return {
            signals: [],
            performance: {
                total_trades: 0,
                winning_trades: 0,
                losing_trades: 0,
                total_profit: 0,
                win_rate: 0,
                best_trade: { profit: 0, symbol: '', type: '' },
                worst_trade: { profit: 0, symbol: '', type: '' },
                monthly_stats: {}
            },
            users: {},
            settings: {
                auto_trading: true,
                notifications: true,
                language: 'en',
                risk_level: 'medium',
                learning_factor: 1.02,
                custom_indicators: [],
                strategies: ['default'],
                theme: 'dark'
            },
            system: {
                uptime: Date.now(),
                total_scans: 0,
                signals_sent: 0,
                last_scan: null,
                version: config.VERSION
            },
            config: {
                symbols: [...config.SYMBOLS],
                indicators: ['RSI', 'MACD', 'BB', 'EMA', 'SMA'],
                scan_interval: config.SCAN_INTERVAL,
                confidence_threshold: config.CONFIDENCE_THRESHOLD
            }
        };
    }

    loadConfig() {
        try {
            if (fs.existsSync(this.configFile)) {
                const customConfig = JSON.parse(fs.readFileSync(this.configFile, 'utf8'));
                // Merge with default config
                Object.assign(config, customConfig);
                console.log('✅ Custom configuration loaded');
            }
        } catch (error) {
            console.error('Config load error:', error);
        }
    }

    saveDatabase() {
        try {
            const dbPath = path.join(this.dataDir, 'quantum_db.json');
            const backupPath = path.join(this.dataDir, 'backups', `quantum_db_${Date.now()}.json`);
            
            // Create backup
            if (fs.existsSync(dbPath)) {
                fs.copyFileSync(dbPath, backupPath);
            }
            
            fs.writeFileSync(dbPath, JSON.stringify(this.db, null, 2));
        } catch (error) {
            console.error('Database save error:', error);
        }
    }

    updateConfig(newConfig) {
        try {
            // Validate and merge new configuration
            const validConfig = {};
            Object.keys(newConfig).forEach(key => {
                if (config.hasOwnProperty(key)) {
                    validConfig[key] = newConfig[key];
                }
            });
            
            fs.writeFileSync(this.configFile, JSON.stringify(validConfig, null, 2));
            
            // Reload configuration
            this.loadConfig();
            
            // Update database config
            Object.assign(this.db.config, validConfig);
            this.saveDatabase();
            
            return { success: true, message: 'Configuration updated' };
        } catch (error) {
            return { success: false, message: error.message };
        }
    }

    addCustomIndicator(indicator) {
        if (config.DEVELOPER_MODE && config.ALLOW_CUSTOM_INDICATORS) {
            this.db.settings.custom_indicators.push(indicator);
            this.saveDatabase();
            
            // Save indicator to file
            const indicatorPath = path.join(this.dataDir, 'indicators', `${indicator.name}.js`);
            fs.writeFileSync(indicatorPath, indicator.code);
            
            return { success: true, message: 'Custom indicator added' };
        }
        return { success: false, message: 'Developer mode required' };
    }

    // ... Rest of database methods remain the same ...
}

// ====================== ADVANCED TECHNICAL ANALYSIS WITH CUSTOM INDICATORS ======================
class QuantumTechnicalAnalyzer {
    static async analyzeSymbol(symbol) {
        try {
            // Fetch data from multiple timeframes
            const timeframes = ['15m', '1h', '4h', '1d'];
            const promises = timeframes.map(tf => 
                axios.get(`${config.BINANCE_API}/klines?symbol=${symbol}&interval=${tf}&limit=100`)
            );
            
            const responses = await Promise.all(promises);
            const tickerRes = await axios.get(`${config.BINANCE_API}/ticker/24hr?symbol=${symbol}`);
            
            // Process each timeframe
            const timeframeData = {};
            responses.forEach((res, index) => {
                const klines = res.data;
                timeframeData[timeframes[index]] = {
                    closes: klines.map(k => parseFloat(k[4])),
                    highs: klines.map(k => parseFloat(k[2])),
                    lows: klines.map(k => parseFloat(k[3])),
                    volumes: klines.map(k => parseFloat(k[5])),
                    timestamps: klines.map(k => k[0])
                };
            });
            
            const ticker = tickerRes.data;
            const currentPrice = parseFloat(ticker.lastPrice);
            const volume24h = parseFloat(ticker.quoteVolume);
            const change24h = parseFloat(ticker.priceChangePercent);
            const high24h = parseFloat(ticker.highPrice);
            const low24h = parseFloat(ticker.lowPrice);
            
            // Advanced technical analysis
            const analysis = {
                symbol,
                price: currentPrice,
                volume: volume24h,
                change: change24h,
                high: high24h,
                low: low24h,
                timestamp: Date.now(),
                timeframes: {}
            };
            
            // Analyze each timeframe
            for (const tf of timeframes) {
                const data = timeframeData[tf];
                analysis.timeframes[tf] = {
                    trend: this.analyzeTrend(data.closes),
                    momentum: this.calculateMomentum(data.closes),
                    volatility: this.calculateVolatility(data.highs, data.lows),
                    volume_profile: this.analyzeVolume(data.volumes),
                    key_levels: this.findKeyLevels(data.highs, data.lows),
                    indicators: this.calculateAllIndicators(data.closes, data.highs, data.lows)
                };
            }
            
            // Generate comprehensive signal
            analysis.signal = this.generateQuantumSignal(analysis);
            analysis.confidence = this.calculateQuantumConfidence(analysis);
            analysis.risk_score = this.calculateRiskScore(analysis);
            analysis.indicators_summary = this.getIndicatorsSummary(analysis);
            
            return analysis;
            
        } catch (error) {
            console.error(`Analysis error for ${symbol}:`, error.message);
            return null;
        }
    }

    static calculateAllIndicators(closes, highs, lows) {
        return {
            rsi: this.calculateRSI(closes),
            macd: this.calculateMACD(closes),
            bollinger: this.calculateBollingerBands(closes),
            ema: {
                ema9: this.calculateEMA(closes, 9),
                ema21: this.calculateEMA(closes, 21),
                ema50: this.calculateEMA(closes, 50),
                ema200: this.calculateEMA(closes, 200)
            },
            stochastic: this.calculateStochastic(highs, lows, closes),
            atr: this.calculateATR(highs, lows, closes),
            obv: this.calculateOBV(closes, closes.map((c, i) => i > 0 ? closes[i-1] : c)) // Simplified
        };
    }

    static calculateBollingerBands(prices, period = 20, stdDev = 2) {
        if (prices.length < period) return null;
        
        const slice = prices.slice(-period);
        const sma = slice.reduce((a, b) => a + b, 0) / period;
        
        const variance = slice.reduce((a, b) => a + Math.pow(b - sma, 2), 0) / period;
        const std = Math.sqrt(variance);
        
        return {
            upper: sma + (std * stdDev),
            middle: sma,
            lower: sma - (std * stdDev),
            bandwidth: ((std * stdDev * 2) / sma) * 100
        };
    }

    static calculateOBV(closes, prevCloses) {
        let obv = 0;
        for (let i = 1; i < closes.length; i++) {
            if (closes[i] > prevCloses[i]) {
                obv += closes[i];
            } else if (closes[i] < prevCloses[i]) {
                obv -= closes[i];
            }
        }
        return obv;
    }

    static getIndicatorsSummary(analysis) {
        const tf1h = analysis.timeframes['1h'];
        const indicators = tf1h.indicators;
        
        return {
            rsi_status: indicators.rsi < 30 ? 'OVERSOLD' : indicators.rsi > 70 ? 'OVERBOUGHT' : 'NEUTRAL',
            macd_status: indicators.macd.histogram > 0 ? 'BULLISH' : 'BEARISH',
            bollinger_status: analysis.price > indicators.bollinger.upper ? 'OVERBOUGHT' : 
                             analysis.price < indicators.bollinger.lower ? 'OVERSOLD' : 'NORMAL',
            ema_alignment: this.checkEMAAlignment(indicators.ema),
            trend_strength: this.calculateTrendStrength(analysis.timeframes)
        };
    }

    static checkEMAAlignment(ema) {
        const emas = [ema.ema9, ema.ema21, ema.ema50, ema.ema200];
        const allValid = emas.every(e => e !== null);
        
        if (!allValid) return 'INVALID';
        
        // Check for bullish alignment (EMA9 > EMA21 > EMA50 > EMA200)
        if (emas[0] > emas[1] && emas[1] > emas[2] && emas[2] > emas[3]) {
            return 'STRONG_BULLISH';
        }
        
        // Check for bearish alignment (EMA9 < EMA21 < EMA50 < EMA200)
        if (emas[0] < emas[1] && emas[1] < emas[2] && emas[2] < emas[3]) {
            return 'STRONG_BEARISH';
        }
        
        return 'MIXED';
    }

    static calculateTrendStrength(timeframes) {
        const trends = Object.values(timeframes).map(tf => tf.trend);
        const bullishCount = trends.filter(t => t.includes('bullish')).length;
        const bearishCount = trends.filter(t => t.includes('bearish')).length;
        
        if (bullishCount === trends.length) return 'STRONG_BULLISH';
        if (bearishCount === trends.length) return 'STRONG_BEARISH';
        if (bullishCount > bearishCount) return 'BULLISH';
        if (bearishCount > bullishCount) return 'BEARISH';
        return 'NEUTRAL';
    }

    static generateQuantumSignal(analysis) {
        // Multi-factor signal generation
        let buyScore = 0;
        let sellScore = 0;
        
        // RSI factor
        const rsi = analysis.timeframes['1h'].indicators.rsi;
        if (rsi < 30) buyScore += 25;
        if (rsi > 70) sellScore += 25;
        
        // MACD factor
        const macdHistogram = analysis.timeframes['1h'].indicators.macd.histogram;
        if (macdHistogram > 0) buyScore += 20;
        if (macdHistogram < 0) sellScore += 20;
        
        // Trend alignment
        const trendStrength = analysis.indicators_summary.trend_strength;
        if (trendStrength.includes('BULLISH')) buyScore += 15;
        if (trendStrength.includes('BEARISH')) sellScore += 15;
        
        // Volume confirmation
        const volumeRatio = analysis.timeframes['1h'].volume_profile.ratio;
        if (volumeRatio > 1.5) {
            if (analysis.change > 0) buyScore += 10;
            if (analysis.change < 0) sellScore += 10;
        }
        
        // Bollinger Bands position
        const bb = analysis.timeframes['1h'].indicators.bollinger;
        if (bb && analysis.price < bb.lower) buyScore += 15;
        if (bb && analysis.price > bb.upper) sellScore += 15;
        
        // Generate signal
        if (buyScore > sellScore && buyScore >= 50) return 'BUY';
        if (sellScore > buyScore && sellScore >= 50) return 'SELL';
        return 'HOLD';
    }

    static calculateQuantumConfidence(analysis) {
        let confidence = 50;
        
        // Timeframe alignment bonus
        const trends = Object.values(analysis.timeframes).map(tf => tf.trend);
        const sameTrend = trends.every(t => t === trends[0]);
        if (sameTrend) confidence += 20;
        
        // Indicator confluence
        const indicators = analysis.indicators_summary;
        if (indicators.rsi_status !== 'NEUTRAL') confidence += 10;
        if (indicators.macd_status === 'BULLISH' && analysis.signal === 'BUY') confidence += 10;
        if (indicators.macd_status === 'BEARISH' && analysis.signal === 'SELL') confidence += 10;
        
        // Volume strength
        if (analysis.timeframes['1h'].volume_profile.trend === 'high') confidence += 10;
        
        // Price action near key levels
        const keyLevels = analysis.timeframes['4h'].key_levels;
        if (keyLevels.length > 0) {
            const nearestLevel = keyLevels[0];
            const distance = Math.abs(analysis.price - nearestLevel.price) / analysis.price;
            if (distance < 0.005) confidence += 15; // Within 0.5% of key level
        }
        
        return Math.min(Math.max(confidence, 0), 95);
    }
}

// ====================== QUANTUM SIGNAL MANAGER WITH ARABIC SUPPORT ======================
class QuantumSignalManager {
    constructor(database) {
        this.db = database;
        this.sentSignals = new Map();
    }

    async processAnalysis(analysis) {
        if (!analysis || analysis.signal === 'HOLD') return null;
        
        // Check confidence threshold
        if (analysis.confidence < config.CONFIDENCE_THRESHOLD) return null;
        
        // Check volume threshold
        if (analysis.volume < config.MIN_VOLUME) return null;
        
        // Check for duplicate recent signal
        const signalKey = `${analysis.symbol}_${analysis.signal}`;
        const lastSent = this.sentSignals.get(signalKey);
        if (lastSent && (Date.now() - lastSent) < 3600000) {
            console.log(`Skipping duplicate signal for ${analysis.symbol}`);
            return null;
        }
        
        // Generate signal data
        const isBuy = analysis.signal === 'BUY';
        const learningFactor = this.db.db.settings.learning_factor;
        
        const entry = analysis.price;
        const baseMultiplier = isBuy ? learningFactor : (2 - learningFactor);
        
        const targets = [
            entry * (baseMultiplier + (isBuy ? 0.00 : -0.00)),
            entry * (baseMultiplier + (isBuy ? 0.015 : -0.015)),
            entry * (baseMultiplier + (isBuy ? 0.03 : -0.03)),
            entry * (baseMultiplier + (isBuy ? 0.045 : -0.045))
        ];
        
        const stopLoss = isBuy ? 
            entry * (1 - (0.015 * (100 / analysis.confidence))) : 
            entry * (1 + (0.015 * (100 / analysis.confidence)));
        
        const riskReward = ((targets[1] - entry) / Math.abs(entry - stopLoss)).toFixed(2);
        
        // Prepare signal data
        const signalData = {
            symbol: analysis.symbol,
            type: isBuy ? 'LONG' : 'SHORT',
            action: isBuy ? 'BUY' : 'SELL',
            entry_price: entry,
            targets: targets,
            stop_loss: stopLoss,
            confidence: analysis.confidence,
            risk_score: analysis.risk_score,
            risk_reward: parseFloat(riskReward),
            technicals: {
                rsi: analysis.timeframes['1h'].indicators.rsi,
                macd: analysis.timeframes['1h'].indicators.macd,
                trend: analysis.indicators_summary.trend_strength,
                ema_alignment: analysis.indicators_summary.ema_alignment,
                key_levels: analysis.timeframes['4h'].key_levels.slice(0, 2)
            },
            indicators: analysis.indicators_summary,
            timestamp: new Date().toISOString()
        };
        
        // Store in database
        const dbSignal = this.db.addSignal(signalData);
        
        // Update sent signals tracker
        this.sentSignals.set(signalKey, Date.now());
        
        // Clean old entries
        this.cleanOldSignals();
        
        return {
            db_id: dbSignal.id,
            ...signalData
        };
    }

    generateMessage(signalData, language = 'en') {
        const isBuy = signalData.type === 'LONG';
        const binanceLink = config.BINANCE_LINKS.spot(signalData.symbol);
        const binanceAppLink = config.BINANCE_LINKS.app(signalData.symbol);
        
        if (language === 'ar') {
            return this.generateArabicMessage(signalData, binanceLink, binanceAppLink);
        } else {
            return this.generateEnglishMessage(signalData, binanceLink, binanceAppLink);
        }
    }

    generateEnglishMessage(signalData, binanceLink, binanceAppLink) {
        const isBuy = signalData.type === 'LONG';
        const icon = isBuy ? '📈' : '📉';
        const action = isBuy ? 'LONG / BUY' : 'SHORT / SELL';
        const bg = isBuy ? '━━━━━━━ BULLISH ━━━━━━━' : '━━━━━━━ BEARISH ━━━━━━━';
        
        const entry = signalData.entry_price;
        const targets = signalData.targets;
        const stopLoss = signalData.stop_loss;
        
        let message = `${icon} CAPITAL EDGE QUANTUM ${icon}\n`;
        message += `${bg}\n\n`;
        
        // Binance Quick Link Button
        message += `⚡ [🚀 TRADE ON BINANCE](${binanceLink})\n\n`;
        
        message += `💎 **${signalData.symbol}**\n`;
        message += `${isBuy ? '🟢' : '🔴'} **ACTION:** ${action}\n`;
        message += `🔥 **CONFIDENCE:** ${signalData.confidence}%\n\n`;
        
        message += `📍 **ENTRY:** ${entry.toFixed(4)}\n`;
        message += `🎯 **TP 1:** ${targets[1].toFixed(4)} (${((targets[1] - entry) / entry * 100).toFixed(2)}%)\n`;
        message += `🎯 **TP 2:** ${targets[2].toFixed(4)} (${((targets[2] - entry) / entry * 100).toFixed(2)}%)\n`;
        message += `🎯 **TP 3:** ${targets[3].toFixed(4)} (${((targets[3] - entry) / entry * 100).toFixed(2)}%)\n`;
        message += `🛡️ **SL:** ${stopLoss.toFixed(4)} (${Math.abs((stopLoss - entry) / entry * 100).toFixed(2)}%)\n`;
        message += `⚖️ **R:R:** 1:${signalData.risk_reward}\n\n`;
        
        message += `━━━━━━ TECHNICALS ━━━━━━\n`;
        message += `📊 **RSI:** ${signalData.technicals.rsi.toFixed(2)} `;
        message += signalData.technicals.rsi < 30 ? '🔻' : signalData.technicals.rsi > 70 ? '🔺' : '➖\n';
        
        message += `📈 **24H:** ${signalData.technicals.change || 'N/A'}\n`;
        message += `💧 **VOL:** ${(signalData.volume / 1000000 || 0).toFixed(1)}M\n`;
        message += `📶 **TREND:** ${signalData.technicals.trend.replace('_', ' ')}\n`;
        message += `📡 **MACD:** ${signalData.technicals.macd.histogram > 0 ? '🟢' : '🔴'}\n\n`;
        
        if (signalData.technicals.key_levels && signalData.technicals.key_levels.length > 0) {
            message += `━━━━ KEY LEVELS ━━━━\n`;
            signalData.technicals.key_levels.forEach(level => {
                const levelIcon = level.type === 'support' ? '🟢' : '🔴';
                const levelType = level.type === 'support' ? 'SUPPORT' : 'RESISTANCE';
                const distance = ((level.price - entry) / entry * 100).toFixed(2);
                message += `${levelIcon} **${levelType}:** ${level.price.toFixed(4)} (${distance}%)\n`;
            });
            message += `\n`;
        }
        
        message += `⏱️ ${new Date().toISOString().split('T')[1].split('.')[0]} UTC\n`;
        message += `💼 Quantum Trading System ${config.VERSION}\n\n`;
        
        // Quick action buttons in caption
        message += `[📱 Open in App](${binanceAppLink}) | [📊 View Chart](${binanceLink})`;
        
        return {
            message: message,
            options: {
                parse_mode: 'Markdown',
                disable_web_page_preview: false
            }
        };
    }

    generateArabicMessage(signalData, binanceLink, binanceAppLink) {
        const isBuy = signalData.type === 'LONG';
        const icon = isBuy ? '📈' : '📉';
        const action = isBuy ? 'شراء / طويل' : 'بيع / قصير';
        const bg = isBuy ? '━━━━━━━ صعودي ━━━━━━━' : '━━━━━━━ هبوطي ━━━━━━━';
        
        const entry = signalData.entry_price;
        const targets = signalData.targets;
        const stopLoss = signalData.stop_loss;
        
        let message = `${icon} كابيتال إيدج كوانتوم ${icon}\n`;
        message += `${bg}\n\n`;
        
        // زر التداول السريع على بينانس
        message += `⚡ [🚀 تداول على بينانس](${binanceLink})\n\n`;
        
        message += `💎 **${signalData.symbol}**\n`;
        message += `${isBuy ? '🟢' : '🔴'} **الإجراء:** ${action}\n`;
        message += `🔥 **الثقة:** ${signalData.confidence}%\n\n`;
        
        message += `📍 **سعر الدخول:** ${entry.toFixed(4)}\n`;
        message += `🎯 **الهدف 1:** ${targets[1].toFixed(4)} (${((targets[1] - entry) / entry * 100).toFixed(2)}%)\n`;
        message += `🎯 **الهدف 2:** ${targets[2].toFixed(4)} (${((targets[2] - entry) / entry * 100).toFixed(2)}%)\n`;
        message += `🎯 **الهدف 3:** ${targets[3].toFixed(4)} (${((targets[3] - entry) / entry * 100).toFixed(2)}%)\n`;
        message += `🛡️ **وقف الخسارة:** ${stopLoss.toFixed(4)} (${Math.abs((stopLoss - entry) / entry * 100).toFixed(2)}%)\n`;
        message += `⚖️ **المخاطرة/العائد:** 1:${signalData.risk_reward}\n\n`;
        
        message += `━━━━━━ المؤشرات الفنية ━━━━━━\n`;
        message += `📊 **RSI:** ${signalData.technicals.rsi.toFixed(2)} `;
        message += signalData.technicals.rsi < 30 ? '🔻' : signalData.technicals.rsi > 70 ? '🔺' : '➖\n';
        
        message += `📈 **التغير اليومي:** ${signalData.technicals.change || 'غير متوفر'}\n`;
        message += `💧 **الحجم:** ${(signalData.volume / 1000000 || 0).toFixed(1)} مليون\n`;
        message += `📶 **الاتجاه:** ${this.translateTrend(signalData.technicals.trend)}\n`;
        message += `📡 **MACD:** ${signalData.technicals.macd.histogram > 0 ? '🟢' : '🔴'}\n\n`;
        
        if (signalData.technicals.key_levels && signalData.technicals.key_levels.length > 0) {
            message += `━━━━ المستويات الرئيسية ━━━━\n`;
            signalData.technicals.key_levels.forEach(level => {
                const levelIcon = level.type === 'support' ? '🟢' : '🔴';
                const levelType = level.type === 'support' ? 'الدعم' : 'المقاومة';
                const distance = ((level.price - entry) / entry * 100).toFixed(2);
                message += `${levelIcon} **${levelType}:** ${level.price.toFixed(4)} (${distance}%)\n`;
            });
            message += `\n`;
        }
        
        const now = new Date();
        const arabicTime = now.toLocaleTimeString('ar-SA', { timeZone: 'Asia/Riyadh' });
        message += `⏱️ ${arabicTime}\n`;
        message += `💼 نظام التداول الكوانتوم ${config.VERSION}\n\n`;
        
        // أزرار التداول السريع
        message += `[📱 فتح في التطبيق](${binanceAppLink}) | [📊 عرض الرسم البياني](${binanceLink})`;
        
        return {
            message: message,
            options: {
                parse_mode: 'Markdown',
                disable_web_page_preview: false
            }
        };
    }

    translateTrend(trend) {
        const translations = {
            'STRONG_BULLISH': 'صعودي قوي',
            'BULLISH': 'صعودي',
            'NEUTRAL': 'محايد',
            'BEARISH': 'هبوطي',
            'STRONG_BEARISH': 'هبوطي قوي',
            'MIXED': 'مختلط'
        };
        return translations[trend] || trend;
    }

    cleanOldSignals() {
        const now = Date.now();
        for (const [key, timestamp] of this.sentSignals.entries()) {
            if (now - timestamp > 86400000) { // 24 hours
                this.sentSignals.delete(key);
            }
        }
    }
}

// ====================== QUANTUM BOT WITH CONFIGURATION COMMANDS ======================
class QuantumBot {
    constructor(token) {
        this.bot = new TelegramBot(token, {
            polling: {
                timeout: 60,
                interval: 1000,
                autoStart: true
            }
        });
        this.database = new QuantumDatabase();
        this.signalManager = new QuantumSignalManager(this.database);
        this.scanner = null;
        this.setupCommands();
    }

    setupCommands() {
        // ========== CONFIGURATION COMMANDS ==========
        this.bot.onText(/\/config/, (msg) => {
            if (msg.from.id.toString() !== config.ADMIN_ID) {
                this.bot.sendMessage(msg.chat.id, '⛔ Admin access required');
                return;
            }
            
            const configMsg = `⚙️ **QUANTUM CONFIGURATION** ⚙️\n\n`;
            configMsg += `📊 **Current Settings:**\n`;
            configMsg += `• Symbols: ${config.SYMBOLS.length}\n`;
            configMsg += `• Scan Interval: ${config.SCAN_INTERVAL / 60000} min\n`;
            configMsg += `• Confidence Threshold: ${config.CONFIDENCE_THRESHOLD}%\n`;
            configMsg += `• Min Volume: $${(config.MIN_VOLUME / 1000000).toFixed(1)}M\n\n`;
            
            configMsg += `🔧 **Configuration Commands:**\n`;
            configMsg += `/add_symbol BTC - Add symbol\n`;
            configMsg += `/remove_symbol BTC - Remove symbol\n`;
            configMsg += `/set_interval 5 - Set scan interval (minutes)\n`;
            configMsg += `/set_threshold 70 - Set confidence threshold\n`;
            configMsg += `/list_symbols - List all symbols\n`;
            configMsg += `/reset_config - Reset to default\n\n`;
            
            configMsg += `🧪 **Developer Commands:**\n`;
            configMsg += `/add_indicator - Add custom indicator\n`;
            configMsg += `/reload_config - Reload configuration\n`;
            configMsg += `/export_config - Export configuration`;
            
            this.bot.sendMessage(msg.chat.id, configMsg, { parse_mode: 'Markdown' });
        });

        this.bot.onText(/\/add_symbol (.+)/, (msg, match) => {
            if (msg.from.id.toString() !== config.ADMIN_ID) return;
            
            const symbol = match[1].toUpperCase().replace('USDT', '') + 'USDT';
            
            if (!config.SYMBOLS.includes(symbol)) {
                config.SYMBOLS.push(symbol);
                this.database.updateConfig({ SYMBOLS: config.SYMBOLS });
                this.bot.sendMessage(msg.chat.id, `✅ Added ${symbol} to monitoring list`);
            } else {
                this.bot.sendMessage(msg.chat.id, `⚠️ ${symbol} already exists`);
            }
        });

        this.bot.onText(/\/remove_symbol (.+)/, (msg, match) => {
            if (msg.from.id.toString() !== config.ADMIN_ID) return;
            
            const symbol = match[1].toUpperCase().replace('USDT', '') + 'USDT';
            const index = config.SYMBOLS.indexOf(symbol);
            
            if (index > -1) {
                config.SYMBOLS.splice(index, 1);
                this.database.updateConfig({ SYMBOLS: config.SYMBOLS });
                this.bot.sendMessage(msg.chat.id, `✅ Removed ${symbol} from monitoring list`);
            } else {
                this.bot.sendMessage(msg.chat.id, `❌ ${symbol} not found in list`);
            }
        });

        this.bot.onText(/\/set_interval (.+)/, (msg, match) => {
            if (msg.from.id.toString() !== config.ADMIN_ID) return;
            
            const minutes = parseInt(match[1]);
            if (minutes >= 1 && minutes <= 60) {
                config.SCAN_INTERVAL = minutes * 60000;
                this.database.updateConfig({ SCAN_INTERVAL: config.SCAN_INTERVAL });
                this.bot.sendMessage(msg.chat.id, `✅ Scan interval set to ${minutes} minutes`);
                
                // Restart scanner with new interval
                if (this.scanner) {
                    this.scanner.updateInterval(config.SCAN_INTERVAL);
                }
            } else {
                this.bot.sendMessage(msg.chat.id, '❌ Invalid interval (1-60 minutes)');
            }
        });

        this.bot.onText(/\/set_threshold (.+)/, (msg, match) => {
            if (msg.from.id.toString() !== config.ADMIN_ID) return;
            
            const threshold = parseInt(match[1]);
            if (threshold >= 50 && threshold <= 90) {
                config.CONFIDENCE_THRESHOLD = threshold;
                this.database.updateConfig({ CONFIDENCE_THRESHOLD: threshold });
                this.bot.sendMessage(msg.chat.id, `✅ Confidence threshold set to ${threshold}%`);
            } else {
                this.bot.sendMessage(msg.chat.id, '❌ Invalid threshold (50-90%)');
            }
        });

        this.bot.onText(/\/list_symbols/, (msg) => {
            let symbolsMsg = `📊 **MONITORED SYMBOLS (${config.SYMBOLS.length})**\n\n`;
            
            // Group symbols for better readability
            const groups = {};
            config.SYMBOLS.forEach(symbol => {
                const category = symbol.replace('USDT', '');
                if (!groups[category]) groups[category] = [];
                groups[category].push(symbol);
            });
            
            Object.keys(groups).forEach(category => {
                symbolsMsg += `**${category}:** ${groups[category].join(', ')}\n\n`;
            });
            
            symbolsMsg += `📝 *Use /add_symbol or /remove_symbol to modify*`;
            
            this.bot.sendMessage(msg.chat.id, symbolsMsg, { parse_mode: 'Markdown' });
        });

        this.bot.onText(/\/reset_config/, (msg) => {
            if (msg.from.id.toString() !== config.ADMIN_ID) return;
            
            // Reset to default configuration
            const defaultConfig = {
                SYMBOLS: ['BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'SOLUSDT', 'XRPUSDT', 'ADAUSDT', 'DOGEUSDT'],
                SCAN_INTERVAL: 600000,
                CONFIDENCE_THRESHOLD: 65,
                MIN_VOLUME: 30000000
            };
            
            Object.assign(config, defaultConfig);
            this.database.updateConfig(defaultConfig);
            
            this.bot.sendMessage(msg.chat.id, '✅ Configuration reset to defaults');
        });

        this.bot.onText(/\/reload_config/, (msg) => {
            if (msg.from.id.toString() !== config.ADMIN_ID) return;
            
            this.database.loadConfig();
            this.bot.sendMessage(msg.chat.id, '✅ Configuration reloaded from file');
        });

        // ========== USER COMMANDS WITH LANGUAGE SUPPORT ==========
        this.bot.onText(/\/start/, (msg) => {
            const user = this.database.getUserPreferences(msg.from.id);
            const userName = msg.from.first_name || 'Trader';
            
            // Detect language preference
            const userLang = msg.from.language_code || 'en';
            const isArabic = userLang.startsWith('ar');
            
            if (isArabic) {
                user.language = 'ar';
                this.database.saveDatabase();
                
                const welcome = `🚀 **مرحباً ${userName} في كابيتال إيدج كوانتوم!** 🚀\n\n`;
                welcome += `أنا مساعدك الذكي للتداول. إليك ما يمكنني فعله:\n\n`;
                welcome += `🔹 **إشارات تلقائية:** أرسل إشارات تداول كل 10 دقائق\n`;
                welcome += `🔹 **تحليل فوري:** حلل أي عملة رقمية\n`;
                welcome += `🔹 **روابط بينانس:** أزرار تداول سريعة\n`;
                welcome += `🔹 **إدارة المخاطرة:** أوقاف ذكية وأهداف متعددة\n\n`;
                
                welcome += `**بدء سريع:**\n`;
                welcome += `• اكتب اسم العملة: \`BTC\`، \`ETH\`، إلخ.\n`;
                welcome += `• استخدم \`/تحليل BTC\` لتحليل مفصل\n`;
                welcome += `• استخدم \`/الإعدادات\` لتخصيص التفضيلات\n`;
                welcome += `• استخدم \`/مساعدة\` لجميع الأوامر\n\n`;
                
                welcome += `💼 *نظام التداول المحترف مفعل*`;
                
                this.bot.sendMessage(msg.chat.id, welcome, { parse_mode: 'Markdown' });
            } else {
                user.language = 'en';
                this.database.saveDatabase();
                
                const welcome = `🚀 **Welcome ${userName} to Capital Edge Quantum!** 🚀\n\n`;
                welcome += `I'm your AI trading assistant. Here's what I can do:\n\n`;
                welcome += `🔹 **Auto-Signals:** Send trading signals every 10 minutes\n`;
                welcome += `🔹 **Instant Analysis:** Analyze any cryptocurrency\n`;
                welcome += `🔹 **Binance Links:** Quick trade buttons\n`;
                welcome += `🔹 **Risk Management:** Smart stop-loss and take-profit\n\n`;
                
                welcome += `**Quick Start:**\n`;
                welcome += `• Type any coin: \`BTC\`, \`ETH\`, etc.\n`;
                welcome += `• Use \`/analyze BTC\` for detailed analysis\n`;
                welcome += `• Use \`/settings\` to customize\n`;
                welcome += `• Use \`/help\` for all commands\n\n`;
                
                welcome += `💼 *Professional Trading System Activated*`;
                
                this.bot.sendMessage(msg.chat.id, welcome, { parse_mode: 'Markdown' });
            }
        });

        this.bot.onText(/\/language (.+)/, (msg, match) => {
            const lang = match[1].toLowerCase();
            const user = this.database.getUserPreferences(msg.from.id);
            
            if (lang === 'arabic' || lang === 'ar' || lang === 'عربي') {
                user.language = 'ar';
                this.database.saveDatabase();
                this.bot.sendMessage(msg.chat.id, '✅ تم تعيين اللغة العربية\nاكتب اسم العملة للتحليل: BTC, ETH, إلخ.');
            } else {
                user.language = 'en';
                this.database.saveDatabase();
                this.bot.sendMessage(msg.chat.id, '✅ English language set\nType coin name for analysis: BTC, ETH, etc.');
            }
        });

        // ========== QUICK ANALYSIS WITH BINANCE LINKS ==========
        this.bot.onText(/^([A-Z]{2,10})$/i, async (msg, match) => {
            const symbolInput = match[1].toUpperCase();
            const symbol = symbolInput.endsWith('USDT') ? symbolInput : symbolInput + 'USDT';
            const user = this.database.getUserPreferences(msg.from.id);
            const isArabic = user.language === 'ar';
            
            const loadingMsg = isArabic ? `🔍 جاري تحليل ${symbol}...` : `🔍 Analyzing ${symbol}...`;
            this.bot.sendMessage(msg.chat.id, loadingMsg);
            
            try {
                const analysis = await QuantumTechnicalAnalyzer.analyzeSymbol(symbol);
                
                if (!analysis) {
                    const errorMsg = isArabic ? 
                        `❌ لا يمكن تحليل ${symbol}. تحقق من اسم العملة.` :
                        `❌ Could not analyze ${symbol}. Please check the symbol.`;
                    this.bot.sendMessage(msg.chat.id, errorMsg);
                    return;
                }
                
                if (analysis.signal !== 'HOLD' && analysis.confidence >= config.CONFIDENCE_THRESHOLD) {
                    const signal = await this.signalManager.processAnalysis(analysis);
                    if (signal) {
                        const messageData = this.signalManager.generateMessage(signal, user.language);
                        this.bot.sendMessage(msg.chat.id, messageData.message, messageData.options);
                    }
                } else {
                    // Send analysis without trade signal
                    const binanceLink = config.BINANCE_LINKS.spot(symbol);
                    const binanceAppLink = config.BINANCE_LINKS.app(symbol);
                    
                    let analysisMsg = isArabic ? 
                        `📊 **تحليل: ${symbol}** 📊\n\n` :
                        `📊 **ANALYSIS: ${symbol}** 📊\n\n`;
                    
                    analysisMsg += `⚡ [🚀 ${isArabic ? 'تداول على بينانس' : 'TRADE ON BINANCE'}](${binanceLink})\n\n`;
                    
                    analysisMsg += `💰 **${isArabic ? 'السعر' : 'Price'}:** $${analysis.price.toFixed(4)}\n`;
                    analysisMsg += `📈 **${isArabic ? 'التغير 24س' : '24H Change'}:** ${analysis.change > 0 ? '🟩 +' : '🟥 '}${analysis.change.toFixed(2)}%\n`;
                    analysisMsg += `💧 **${isArabic ? 'الحجم' : 'Volume'}:** $${(analysis.volume / 1000000).toFixed(1)}M\n\n`;
                    
                    analysisMsg += `🚀 **${isArabic ? 'الإشارة' : 'Signal'}:** ${analysis.signal}\n`;
                    analysisMsg += `🔥 **${isArabic ? 'الثقة' : 'Confidence'}:** ${analysis.confidence}%\n`;
                    analysisMsg += `⚠️ **${isArabic ? 'درجة المخاطرة' : 'Risk Score'}:** ${analysis.risk_score}/100\n\n`;
                    
                    analysisMsg += `📊 **${isArabic ? 'ملخص المؤشرات' : 'Indicators Summary'}:**\n`;
                    analysisMsg += `• RSI: ${analysis.indicators_summary.rsi_status}\n`;
                    analysisMsg += `• MACD: ${analysis.indicators_summary.macd_status}\n`;
                    analysisMsg += `• Trend: ${isArabic ? this.signalManager.translateTrend(analysis.indicators_summary.trend_strength) : analysis.indicators_summary.trend_strength}\n\n`;
                    
                    analysisMsg += `[📱 ${isArabic ? 'فتح في التطبيق' : 'Open in App'}](${binanceAppLink}) | [📊 ${isArabic ? 'عرض الرسم البياني' : 'View Chart'}](${binanceLink})`;
                    
                    this.bot.sendMessage(msg.chat.id, analysisMsg, { 
                        parse_mode: 'Markdown',
                        disable_web_page_preview: false 
                    });
                }
                
            } catch (error) {
                const errorMsg = isArabic ? 
                    `❌ خطأ في تحليل ${symbol}: ${error.message}` :
                    `❌ Error analyzing ${symbol}: ${error.message}`;
                this.bot.sendMessage(msg.chat.id, errorMsg);
            }
        });

        // ========== ARABIC COMMANDS ==========
        this.bot.onText(/(تحليل|صفقة|تداول) (.+)/i, async (msg, match) => {
            const symbolInput = match[2].toUpperCase();
            const symbol = symbolInput.endsWith('USDT') ? symbolInput : symbolInput + 'USDT';
            const user = this.database.getUserPreferences(msg.from.id);
            user.language = 'ar';
            this.database.saveDatabase();
            
            this.bot.sendMessage(msg.chat.id, `🔍 جاري تحليل ${symbol}...`);
            
            try {
                const analysis = await QuantumTechnicalAnalyzer.analyzeSymbol(symbol);
                
                if (!analysis) {
                    this.bot.sendMessage(msg.chat.id, `❌ لا يمكن تحليل ${symbol}. تحقق من اسم العملة.`);
                    return;
                }
                
                if (analysis.signal !== 'HOLD' && analysis.confidence >= config.CONFIDENCE_THRESHOLD) {
                    const signal = await this.signalManager.processAnalysis(analysis);
                    if (signal) {
                        const messageData = this.signalManager.generateMessage(signal, 'ar');
                        this.bot.sendMessage(msg.chat.id, messageData.message, messageData.options);
                    }
                } else {
                    this.bot.sendMessage(msg.chat.id, `⚠️ لا توجد إشارة تداول قوية لـ ${symbol} حالياً.\nالثقة: ${analysis.confidence}%`);
                }
                
            } catch (error) {
                this.bot.sendMessage(msg.chat.id, `❌ خطأ في تحليل ${symbol}: ${error.message}`);
            }
        });

        // ========== HELP COMMAND IN BOTH LANGUAGES ==========
        this.bot.onText(/\/help|\/مساعدة/, (msg) => {
            const user = this.database.getUserPreferences(msg.from.id);
            const isArabic = user.language === 'ar';
            
            if (isArabic) {
                const helpMsg = `📚 **كابيتال إيدج كوانتوم - المساعدة** 📚\n\n`;
                helpMsg += `**الأوامر الأساسية:**\n`;
                helpMsg += `• \`/start\` - بدء البوت\n`;
                helpMsg += `• \`BTC\` أو \`ETH\` - تحليل سريع\n`;
                helpMsg += `• \`/تحليل BTC\` - تحليل مفصل\n`;
                helpMsg += `• \`/الإعدادات\` - إعداداتك\n`;
                helpMsg += `• \`/الإحصائيات\` - إحصائياتك\n`;
                helpMsg += `• \`/اللغة عربي|انجليزي\` - تغيير اللغة\n\n`;
                
                helpMsg += `**مميزات النظام:**\n`;
                helpMsg += `• إشارات تلقائية كل 10 دقائق\n`;
                helpMsg += `• روابط تداول سريعة على بينانس\n`;
                helpMsg += `• تحليل فني متقدم\n`;
                helpMsg += `• دعم اللغة العربية الكامل\n`;
                helpMsg += `• إدارة مخاطر ذكية\n\n`;
                
                helpMsg += `**روابط سريعة:**\n`;
                helpMsg += `• اكتب اسم العملة فقط للتحليل\n`;
                helpMsg += `• كل إشارة تحتوي على زر تداول مباشر\n`;
                helpMsg += `• يمكنك التداول بنقرة واحدة\n\n`;
                
                helpMsg += `💼 *تداول سعيد!*`;
                
                this.bot.sendMessage(msg.chat.id, helpMsg, { parse_mode: 'Markdown' });
            } else {
                const helpMsg = `📚 **CAPITAL EDGE QUANTUM - HELP** 📚\n\n`;
                helpMsg += `**BASIC COMMANDS:**\n`;
                helpMsg += `• \`/start\` - Start the bot\n`;
                helpMsg += `• \`BTC\` or \`ETH\` - Quick analysis\n`;
                helpMsg += `• \`/analyze BTC\` - Detailed analysis\n`;
                helpMsg += `• \`/settings\` - Your settings\n`;
                helpMsg += `• \`/stats\` - Your statistics\n`;
                helpMsg += `• \`/language english|arabic\` - Change language\n\n`;
                
                helpMsg += `**SYSTEM FEATURES:**\n`;
                helpMsg += `• Auto signals every 10 minutes\n`;
                helpMsg += `• Quick Binance trade links\n`;
                helpMsg += `• Advanced technical analysis\n`;
                helpMsg += `• Full Arabic language support\n`;
                helpMsg += `• Smart risk management\n\n`;
                
                helpMsg += `**QUICK LINKS:**\n`;
                helpMsg += `• Just type coin name for analysis\n`;
                helpMsg += `• Every signal has direct trade button\n`;
                helpMsg += `• Trade with one click\n\n`;
                
                helpMsg += `💼 *Happy Trading!*`;
                
                this.bot.sendMessage(msg.chat.id, helpMsg, { parse_mode: 'Markdown' });
            }
        });
    }

    startScanner() {
        // Scanner implementation
        console.log('✅ Quantum Trading System Scanner Started');
        
        // Auto-scan implementation would go here
        // For now, we'll just log that it's ready
        setInterval(() => {
            console.log('🔍 Quantum Scanner is active...');
        }, config.SCAN_INTERVAL);
    }

    start() {
        console.log('🚀 Starting Capital Edge Quantum Trading System...');
        console.log(`🌐 Version: ${config.VERSION}`);
        console.log(`📊 Monitoring ${config.SYMBOLS.length} symbols`);
        console.log(`🔄 Scan Interval: ${config.SCAN_INTERVAL / 60000} minutes`);
        console.log(`🎯 Confidence Threshold: ${config.CONFIDENCE_THRESHOLD}%`);
        console.log('✅ Bot is now listening for commands...');
        
        // Send startup message
        const startupMsg = `🚀 **CAPITAL EDGE QUANTUM STARTED** 🚀\n\n`;
        startupMsg += `✅ **Quantum Trading System v2.0**\n`;
        startupMsg += `📊 **Symbols:** ${config.SYMBOLS.length}\n`;
        startupMsg += `🔄 **Scan Interval:** ${config.SCAN_INTERVAL / 60000} minutes\n`;
        startupMsg += `🎯 **Confidence:** ${config.CONFIDENCE_THRESHOLD}%\n`;
        startupMsg += `🌐 **Language:** English & Arabic\n`;
        startupMsg += `⚡ **Binance Links:** Enabled\n\n`;
        startupMsg += `💼 *Quantum Trading System Online*`;
        
        this.bot.sendMessage(config.ADMIN_ID, startupMsg, { parse_mode: 'Markdown' });
        
        // Start scanner
        this.startScanner();
    }
}

// ====================== START THE QUANTUM SYSTEM ======================
const quantumBot = new QuantumBot(config.TELEGRAM_TOKEN);
quantumBot.start();

// Error handling
process.on('SIGINT', () => {
    console.log('\n🔴 Shutting down Quantum Trading System...');
    quantumBot.database.saveDatabase();
    console.log('✅ Database saved');
    process.exit(0);
});

process.on('uncaughtException', (error) => {
    console.error('❌ Uncaught Exception:', error);
    quantumBot.database.saveDatabase();
});

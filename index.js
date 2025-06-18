require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');
const { createClient } = require('@supabase/supabase-js');

// Supabase setup
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// Telegram & Clash setup
const token = process.env.TELEGRAM_BOT_TOKEN;
const clashToken = process.env.CLASH_API_TOKEN;
const bot = new TelegramBot(token, { polling: true });

// Helper to fetch Clash data
async function fetchData(url) {
  try {
    const response = await axios.get(url, {
      headers: {
        Authorization: `Bearer ${clashToken}`
      }
    });
    return { success: true, data: response.data };
  } catch (error) {
    return { success: false, error };
  }
}

// /link <tag> command
bot.onText(/\/link (.+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const telegramId = msg.from.id;
  const tag = match[1].trim();
  
  try {
    const { error } = await supabase
      .from('players')
      .upsert({ telegramId, tag }, { onConflict: ['telegramId'] });
    
    if (error) throw error;
    
    bot.sendMessage(chatId, `✅ Your player tag ${tag} has been linked to your Telegram account.`);
  } catch (err) {
    bot.sendMessage(chatId, `❌ Failed to link your tag. Error: ${err.message}`);
  }
});

// /player [optional tag]
bot.onText(/\/player(?:\s+(.+))?/, async (msg, match) => {
  const chatId = msg.chat.id;
  const telegramId = msg.from.id;
  let tag = match[1];
  
  try {
    if (!tag) {
      const { data, error } = await supabase
        .from('players')
        .select('tag')
        .eq('telegramId', telegramId)
        .single();
      
      if (error || !data || !data.tag) {
        return bot.sendMessage(chatId, "❌ You haven't linked your tag yet. Use /link <tag> to link.");
      }
      
      tag = data.tag;
    }
    
    const cleanTag = tag.replace('#', '%23');
    const res = await fetchData(`https://cocproxy.royaleapi.dev/v1/players/${cleanTag}`);
    if (!res.success) throw new Error("API error");
    
    const p = res.data;
    const message = `
🏆 Player: ${p.name}
🏅 Tag: ${p.tag}
🏠 Town Hall: ${p.townHallLevel}
⭐ Trophies: ${p.trophies}
🏅 Clan: ${p.clan ? p.clan.name : 'No Clan'}
    `;
    bot.sendMessage(chatId, message);
  } catch (err) {
    bot.sendMessage(chatId, `❌ Failed to fetch player data. Error: ${err.message}`);
  }
});

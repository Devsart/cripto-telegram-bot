const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');

// replace the value below with the Telegram token you receive from @BotFather
const token = '';

// Create a bot that uses 'polling' to fetch new updates
const bot = new TelegramBot(token, {polling: true});

// Matches "/echo [whatever]"
bot.onText(/\/preco (.+)/, async (msg, match) => {
  // 'msg' is the received Message from Telegram
  // 'match' is the result of executing the regexp above on the text content
  // of the message
  var token = match[1];
  switch(match[1]){
      case ("pvu"||"PVU"):
          token = "plant-vs-undead-token"
          break;
      case ("btc"||"BTC"):
          token = "bitcoin"
          break;
      case ("ltc"||"LTC"):
          token = "litecoin"
          break;
  }

  const chatId = msg.chat.id;
  const resp = await axios.get(`https://api.coingecko.com/api/v3/coins/${token}`); // the captured "whatever"
  var preco = resp.data.market_data.current_price.usd;
  var mensagem = `O preço de ${match[1]} atualmente é USD ${preco}`
  // send back the matched "whatever" to the chat
  bot.sendMessage(chatId, mensagem);
});

bot.onText(/\/alerta (.+)/, async (msg, match) => {
    // 'msg' is the received Message from Telegram
    // 'match' is the result of executing the regexp above on the text content
    // of the message
    var moeda = match[1].split(' ');
    var nome = moeda[0];
    var valor = moeda[1];
    switch(nome){
        case ("pvu"||"PVU"):
            nome = "plant-vs-undead-token"
            break;
        case ("btc"||"BTC"):
            nome = "bitcoin"
            break;
        case ("ltc"||"LTC"):
            nome = "litecoin"
            break;
        case ("xrp"||"XRP"):
            nome = "ripple"
            break;
    }

    const chatId = msg.chat.id;
    try{
        const resp = await axios.get(`https://api.coingecko.com/api/v3/coins/${nome}`);
        var preco = resp.data.market_data.current_price.usd;
        var mensagem_inicial = `O atual preço de ${nome} é de USD ${preco}... Eu te avisarei quando o preço chegar a USD ${valor}!`
        bot.sendMessage(chatId, mensagem_inicial);
    }
    catch(e){
        var mensagem_erro = `Desculpe, mas não consegui verificar o preço para ${nome}. Por favor, verifique se há algum erro de digitação ou se o Token realmente existe.`
        bot.sendMessage(chatId,mensagem_erro);
        throw new Error("Whooops! parece que você tentou acessar algum token inexistente.")
    }
    if(preco < valor){
        do{
            var status_alerta_alta = true;
            const resp = await axios.get(`https://api.coingecko.com/api/v3/coins/${nome}`); 
            var preco = resp.data.market_data.current_price.usd;
            if(preco >= valor){
                var mensagem = `O preço de ${nome} SUBIU atingiu o valor de USD ${preco}!! Corre lá!`
                bot.sendMessage(chatId, mensagem);
                status_alerta_alta = false;
            }
        }
        while(status_alerta_alta)
    }
    else{
        do{
            var status_alerta_baixa = true;
            const resp = await axios.get(`https://api.coingecko.com/api/v3/coins/${nome}`); // the captured "whatever"
            var preco = resp.data.market_data.current_price.usd;
            if(preco <= valor){
                var mensagem = `O preço de ${nome} CAIU e atingiu o valor de USD ${preco}!! Corre lá!`
                // send back the matched "whatever" to the chat
                bot.sendMessage(chatId, mensagem);
                status_alerta_baixa = false;
            }
        }
        while(status_alerta_baixa)
    }
  });


const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');
var express = require('express');
require('dotenv').config()
// replace the value below with the Telegram token you receive from @BotFather

var app = express();
app.set('port', (process.env.PORT || 5000));

app.get('/', function(request, response) {
    var result = 'App is running'
    response.send(result);
    }).listen(app.get('port'), function() {
    console.log('App is running, server is listening on port ', app.get('port'));
    });

const token = process.env.BOTTOKEN;

const bot = new TelegramBot(token, {polling: true});

bot.onText(/\/preco (.+)/, async (msg, match) => {
  var nome = match[1];
  equivalenciaNome(nome);

  const chatId = msg.chat.id;
  try{
    const resp = await axios.get(`https://api.coingecko.com/api/v3/coins/${nome}`); // the captured "whatever"
    var preco = resp.data.market_data.current_price.usd;
    var mensagem = `O preço de ${nome} atualmente é USD ${preco}`
    bot.sendMessage(chatId, mensagem);
  }
  catch(e){
    var mensagem_erro = `Desculpe, mas não consegui encontrar o token ${nome}. Por favor, verifique se há algum erro de digitação ou se o Token realmente existe.`
    bot.sendMessage(chatId,mensagem_erro);
    throw new Error("Whooops! parece que você tentou acessar algum token inexistente.")
  }
});

bot.onText(/\/alerta (.+)/, async (msg, match) => {
    var moeda = match[1].split(' ');
    var nome = moeda[0];
    var valor = moeda[1];
    equivalenciaNome(nome);

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
                bot.sendMessage(chatId, mensagem);
                status_alerta_baixa = false;
            }
        }
        while(status_alerta_baixa)
    }
  });

  function equivalenciaNome(nome){
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
  }


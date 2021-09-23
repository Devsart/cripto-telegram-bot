const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');
var express = require('express');
require('dotenv').config();
const { Client } = require('pg');
// replace the value below with the Telegram token you receive from @BotFather

const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false
    }
  });

client.connect();

client.query('SELECT table_schema,table_name FROM information_schema.tables;', (err, res) => {
    if (err) throw err;
    for (let row of res.rows) {
      console.log(JSON.stringify(row));
    }
    client.end();
  });

var app = express();

app.use(express.json());

app.set('port', (process.env.PORT || 5000));

app.get('/', function(request, response) {
    var result = 'App is running'
    response.send(result);
    }).listen(app.get('port'), function() {
    console.log('App is running, server is listening on port ', app.get('port'));
    });

app.post(`/${process.env.BOTTOKEN}`, (req, res) => {
    bot.processUpdate(req.body);
    res.status(200).json({ message: 'ok' });
   });

const token = process.env.BOTTOKEN;
let bot;

if (process.env.NODE_ENV === 'production') {
    bot = new TelegramBot(token);
    bot.setWebHook(process.env.HEROKU_URL + bot.token);
 } else {
    bot = new TelegramBot(token, { polling: true });
 }
bot.onText(/\/preco (.+)/, async (msg, match) => {
  var nome = match[1];

  const chatId = msg.chat.id;
  try{
    const resplist = await axios.get(`https://api.coingecko.com/api/v3/coins/list`);
    resplist.data.forEach((x) => {
        if(x.symbol == nome.toLowerCase()){
            nome = x.id;
        }
    });
    const resp = await axios.get(`https://api.coingecko.com/api/v3/coins/${nome}`)
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

    const chatId = msg.chat.id;
    try{
        const resplist = await axios.get(`https://api.coingecko.com/api/v3/coins/list`);
        resplist.data.forEach((x) => {
            if(x.symbol == nome.toLowerCase()){
                nome = x.id;
            }
        });
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
  async function getToken(symbol){
    try{
        const resp = await axios.get(`https://api.coingecko.com/api/v3/coins/list`);
        resp.data.forEach((x) => {
            if(x.symbol == symbol.toLowerCase()){
                symbol = x.id;
            }
        });
        console.log(symbol);
    }
    catch(e){
        console.log(e.message)    
        }
    }
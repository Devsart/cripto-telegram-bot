const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');
var express = require('express');
require('dotenv').config();
const { Client } = require('pg');
// const { Axios } =  require('axios-observable');
// replace the value below with the Telegram token you receive from @BotFather

const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false
    }
  });

client.connect();

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
bot.onText(/\/preço (.+)/, async (msg, match) => {
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

bot.onText(/\/listar (.+)/, async (msg, match) => {
    var lista = match[1];
    const chatId = msg.chat.id;
    try{
      var user_id = msg.from.id;
      var cripto_list = lista.split(' ');
      const precos_list = await getPrices(cripto_list);
      console.log(cripto_list);
      console.log(precos_list);
      client.query(`SELECT * FROM tb_criptolist WHERE user_id = '${user_id}';`, (err, res) => {
        if (err) 
          throw err;
        else if(res.rowCount>=1) {
          var user_list = res.row[0].cripto_list.split(',');
          var user_precos = res.row[0].precos_list.split(',');
          for([index,cripto] of cripto_list.entries()){
            if(user_list.indexOf(cripto)==-1){
              user_list.push(cripto);
              user_precos.push(precos_list[index]);
            }
          }
          client.query(`UPDATE tb_criptolist SET cripto_list = '${user_list}',precos_list ='${user_precos}' WHERE user_id = '${user_id}';`, (err, res) => {
            if (err){
              throw err;
            }
            console.log(`tabela atualizada para usuário ${user_id}`)            
          })
        }
        else{
          client.query(`INSERT INTO tb_criptolist VALUES ('${user_id}','${cripto_list}','${precos_list}');`, (err, res) => {
            if (err) throw err;
          });
        }    
      });
      var mensagem = `Sua lista de criptoativos foi atualizada. Para verificá-los basta enviar /monitorar`
      bot.sendMessage(chatId, mensagem);
    }
    catch(e){
      var mensagem_erro = `Desculpe, mas não consegui encontrar o token. Por favor, verifique se há algum erro de digitação ou se o Token realmente existe.`
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

  async function getPrices(cripto_list){
    var precos_list = []
    for(const cripto of cripto_list) {
      await axios.get(`https://api.coingecko.com/api/v3/coins/${cripto}`).then(
        response => {
          var preco = response.data.market_data.current_price.usd;
          console.log(preco);
          precos_list.push(preco);
        },
        error => console.log(error));
    };
    console.log(precos_list);
    return precos_list;
  }

async function getUsuario(user_id){
  client.query(`SELECT * FROM tb_criptolist WHERE user_id = '${user_id}';`, (err, res) => {
    if(res)  
      return res.rowCount;
    if (err) 
      throw err;
  });
}
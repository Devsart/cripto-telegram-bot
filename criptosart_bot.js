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
bot.onText(/\/p (.+)/, async (msg, match) => {
  var nome = match[1];

  const chatId = msg.chat.id;
  try{
    const resplist = await getList();
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
      const resplist = await getList();
      for([index,cripto] of cripto_list.entries()){
        resplist.data.forEach((x) => {
          if(x.symbol == cripto.toLowerCase()){
            cripto_list[index] = x.id;
          }
        });
      };
      const precos_list = await getPrices(cripto_list);
      console.log(cripto_list);
      console.log(precos_list);
      if(cripto_list.length != precos_list.length){
        var mensagem = `Hmmm... Parece que você está tentando listar um token que não conheço 🤔. Tem certeza que escreveu o nome correto?`
        return bot.sendMessage(chatId, mensagem, { parse_mode: 'Markdown' });
      }
      client.query(`SELECT * FROM tb_criptolist WHERE user_id = '${user_id}';`, (err, res) => {
        if (err) 
          throw err;
        else if(res.rowCount>=1) {
          var user_list = res.rows[0].cripto_list.split(',');
          var user_precos = res.rows[0].precos_list.split(',');
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
      var mensagem = `Sua lista de criptoativos foi atualizada 🤗. Para verificá-los basta enviar /monitorar`
      bot.sendMessage(chatId, mensagem, { parse_mode: 'Markdown' });
    }
    catch(e){
      var mensagem_erro = `Desculpe, mas não consegui encontrar o token. Por favor, verifique se há algum erro de digitação ou se o Token realmente existe.`
      bot.sendMessage(chatId,mensagem_erro);
      throw new Error("Whooops! parece que você tentou acessar algum token inexistente.")
    }
});

bot.onText(/\/atualizar (.+)/, async (msg, match) => {
  var lista = match[1];
  const chatId = msg.chat.id;
  try{
    var user_id = msg.from.id;
    var moeda_preco = lista.split(' ');
    const nome_moeda = moeda_preco[0];
    const resplist = await getList();
    resplist.data.forEach((x) => {
      if(x.symbol == moeda_preco[0].toLowerCase()){
        moeda_preco[0] = x.id;
      }
    });
    client.query(`SELECT * FROM tb_criptolist WHERE user_id = '${user_id}';`, (err, res) => {
      if (err) 
        throw err;
      else if(res.rowCount>=1) {
        var user_list = res.rows[0].cripto_list.split(',');
        var user_precos = res.rows[0].precos_list.split(',');
        if(user_list.indexOf(moeda_preco[0])!=-1 && moeda_preco[1] > 0){
          var att_index = user_list.indexOf(moeda_preco[0])
          user_precos[att_index] = moeda_preco[1];
        }
        else{
          var mensagem = `Hmmm...🧐 parece que você está tentando atualizar o preço de uma moeda que não está na sua lista. Verifique os campos e refaça o procedimento caso necessário.  😓`;
          return bot.sendMessage(chatId, mensagem, { parse_mode: 'Markdown' });
        }
        client.query(`UPDATE tb_criptolist SET cripto_list = '${user_list}',precos_list ='${user_precos}' WHERE user_id = '${user_id}';`, (err, res) => {
          if (err){
            throw err;
          }
          var mensagem = `Acabei de atualizar o seu preço de compra de *${nome_moeda}* para *US$ ${moeda_preco[1]}*. Você pode verificar a atualização em /monitorar. 🤑`
          bot.sendMessage(chatId, mensagem, { parse_mode: 'Markdown' });
          console.log(`tabela atualizada para usuário ${user_id}`);           
        })
      }
      else{
        var mensagem = `Hmmm... Parece que você ainda não tem uma lista de criptoativos 🤔. Você pode criar uma usando o comando /listar`
        bot.sendMessage(chatId, mensagem, { parse_mode: 'Markdown' });
      }    
    });
  }
  catch(e){
    var mensagem_erro = `Desculpe. Mas algo deu errado e não consegui atualizar a tabela. Tente novamente mais tarde.`
    bot.sendMessage(chatId,mensagem_erro);
    throw new Error("Erro ao atualizar preço na tabela")
  }
});

bot.onText(/\/limpar/, async (msg, match) => {
  const chatId = msg.chat.id;
  try{
    var user_id = msg.from.id;
    client.query(`SELECT * FROM tb_criptolist WHERE user_id = '${user_id}';`, (err, res) => {
      if (err) 
        throw err;
      else if(res.rowCount>=1) {
        client.query(`DELETE FROM tb_criptolist WHERE user_id = '${user_id}';`, (err, res) => {
          if (err){
            throw err;
          }
          var mensagem = `Sua lista de criptoativos foi apagada com sucesso! 💸 Caso queira começar uma nova, adicione uma ou mais moedas com o comando /listar`
          bot.sendMessage(chatId, mensagem, { parse_mode: 'Markdown' });
          console.log(`usuário limpou seu registro ${user_id}`)            
        })
      }
      else{
        var mensagem = `Hmmm... Parece que você ainda não tem uma lista de criptoativos 🤔. Você pode criar uma usando o comando /listar`
        bot.sendMessage(chatId, mensagem, { parse_mode: 'Markdown' });
      }    
    });
  }
  catch(e){
    var mensagem_erro = `Desculpe, mas não consegui limpar sua lista. Parece que algo deu errado no processo. 😕`
    bot.sendMessage(chatId,mensagem_erro);
    throw new Error("Erro ao tentar deletar usuario.")
  }
});

bot.onText(/\/monitorar/, async (msg, match) => {
  const chatId = msg.chat.id;
  var user_id = msg.from.id;
  try{
    client.query(`SELECT * FROM tb_criptolist WHERE user_id = '${user_id}';`,async (err, res) => {
      if (err) 
        throw err;
      else if(res.rowCount>=1) {
        var user_list = res.rows[0].cripto_list.split(',');
        var user_precos = res.rows[0].precos_list.split(',');
        const list_precos = await getPrices(user_list);
        const resplist = await getList();
        var mensagem = `Bem-vind@ *${msg.from.first_name}*! Aqui está o relatório da sua lista de criptoativos 📈:\n\n`
        for([index,cripto] of user_list.entries()){
            resplist.data.forEach((x) => {
            if(x.id == cripto.toLowerCase()){
                cripto = x.symbol;
              }
            });
          var sinal = Math.sign(list_precos[index]/user_precos[index] -1) >= 0 ? "+" : "-";
          mensagem += ` 🔸 *${cripto.toUpperCase()}:*\n     • *Preço de Compra:* US$ ${user_precos[index]}\n    • *Preço Atual:* US$ ${list_precos[index]} (${sinal}${Math.round((list_precos[index]/user_precos[index] -1 +Number.EPSILON)*10000)/100}%)`;
          if(sinal == "+"){
            mensagem+=" 🟢\n"
          }
          else{
            mensagem+=" 🔴\n"
          }
        }
        mensagem += "\nEstá gostando? Nos ajude a manter o projeto, use o comando /doar."
        bot.sendMessage(chatId, mensagem, { parse_mode: 'Markdown' });
      }
      else{
        var mensagem = `Hmmm... Parece que você ainda não tem uma lista de criptoativos 🤔. Você pode criar uma usando o comando /listar`
        bot.sendMessage(chatId, mensagem, { parse_mode: 'Markdown' });
      }
    })
  }
  catch(err){

  }
});

bot.onText(/\/start/, async (msg, match) => {
  const chatId = msg.chat.id;
  var user_id = msg.from.id;
  var user_name = msg.from.first_name;
  var mensagem = `Olá *${user_name}*, seja bem-vind@!\n\nEu sou o $artinho e serei seu assistente virtual do criptoverso 🤖. Aqui está uma lista de comandos e como você pode utilizá-los para obter a melhor experiência possível:\n\n ➜ /p _moeda_ - Informa o preço atual de um determinado criptoativo.\n ➜ /listar _moeda1_ _moeda2_ ... _moedaN_ - Adiciona todas as N moedas citadas à sua lista de interesse.\n ➜ /remover _moeda1_ _moeda2_ ... _moedaN_ - Remove todas as N moedas citadas da sua lista de interesse.\n ➜ /atualizar _moeda1_ _precoDeCompra_ - Por padrão, o preço de compra é o preço no momento da listagem. Utilize este comando caso queira alterar este valor.\n ➜ /monitorar - Permite verificar os preços atuais e as variações de todos os seus ativos listados.\n ➜ /limpar - Remove todos os itens presentes na sua lista de criptoativos.\n ➜ /ajuda - Fornece de forma mais detalhada as informações sobre os comandos.\n ➜ /doar - Oferece informações para meios de doação como forma de apoio ao projeto.\n\nFaça bom proveito! 🚀`
  bot.sendMessage(chatId, mensagem, { parse_mode: 'Markdown' });
});

bot.onText(/\/ajuda/, async (msg, match) => {
  const chatId = msg.chat.id;
  var user_id = msg.from.id;
  var user_name = msg.from.first_name;
  var mensagem = `É um pássaro? Não! É um avião? Não!! Sou eu! $artinho na área pronto para tentar te ajudar 🧞‍♂️, vamos lá? Nesta aba, tentarei explicar os comandos de forma mais detalhada, para que você consiga entender de uma vez por todas o melhor jeito de me utilizar! (Pegou meio mal isso né 😅): \n\n ➜ /p _moeda_ - Informa o preço atual de um determinado criptoativo.\nPara utilizar este comando, você deve substituir _moeda_ pelo símbolo da moeda desejada.\n\n*Por exemplo:* _/p btc_ lhe retornará o preço atual do Bitcoin! Certo?\n\n ➜ /listar _moeda1_ _moeda2_ ... _moedaN_ - Adiciona todas as N moedas citadas à sua lista de interesse.\nPara utilizar este comando, você deverá substituir as _moedas_ pelos simbolos desejados, separando-as com apenas um espaço entre elas.\n\n*Exemplo:* _/listar btc eth xrp_ Colocaria o Bitcoin, o Ethereum e o XRP da Ripple na minha lista.\n\n ➜ /remover _moeda1_ _moeda2_ ... _moedaN_ - Remove todas as N moedas citadas da sua lista de interesse.\nSegue a mesma lógica do comando /listar.\n\n\n ➜ /atualizar _moeda1_ _precoDeCompra_ - Por padrão, o preço de compra é o preço no momento da listagem. Utilize este comando caso queira alterar este valor.\n\n*Exemplo:* Ao utilizar o comando _/atualizar btc 2.6_ Você estará informando que o preço pelo qual você comprou seus bitcoin foi US$ 2,60 e então seu relatório começará a ser preenchido com este valor de compra e seus lucros baseados neste valor. Seria um sonho, não é mesmo? 😅\n\n ➜ /monitorar - Permite verificar os preços atuais e as variações de todos os seus ativos listados.\nNesse caso não tem mistério, é só utilizar o comando sem adicionais mesmo para ver a magia acontecer. 🤣 Os próximos comandos obedecem a mesma regra.\n\n ➜ /limpar - Remove todos os itens presentes na sua lista de criptoativos.\n\n ➜ /ajuda - Fornece de forma mais detalhada as informações sobre os comandos.\n\n ➜ /doar - Oferece informações para meios de doação como forma de apoio ao projeto.\n\nEspero ter ajudado! 🤩`
  bot.sendMessage(chatId, mensagem, { parse_mode: 'Markdown' });
});

bot.onText(/\/doar/, async (msg, match) => {
  const chatId = msg.chat.id;
  var user_id = msg.from.id;
  var user_name = msg.from.first_name;
  var mensagem = `Obrigado pelo apoio, *${user_name}*, você deve ser uma pessoa incrível, hehehe!\n\nVocê pode doar qualquer quantia que desejar, em cripto ou reais. Basta realizar uma transferência para um dos seguintes endereços:\n\n • *Carteira BinanceSmartChain(BEP20):* 0xAf6B7f760dB2936262FE6e4B62CD694E00c86688\n • *Chave Pix:* 701d04d1-38e4-4265-bfc1-bb48ab08df16\n\nCaso tenha sugestões ou queira ajudar o projeto, entre em [contato](https://t.me/SheikPobre)! 😊`
  bot.sendMessage(chatId, mensagem, { parse_mode: 'Markdown' });
});

bot.onText(/\/remover (.+)/, async (msg, match) => {
  var lista = match[1];
  const chatId = msg.chat.id;
  try{
    var user_id = msg.from.id;
    var cripto_list = lista.split(' ');
    const resplist = await getList();
    for([index,cripto] of cripto_list.entries()){
      resplist.data.forEach((x) => {
        if(x.symbol == cripto.toLowerCase()){
          cripto_list[index] = x.id;
        }
      });
    };
    const precos_list = await getPrices(cripto_list);
    console.log(cripto_list);
    console.log(precos_list);
    client.query(`SELECT * FROM tb_criptolist WHERE user_id = '${user_id}';`, (err, res) => {
      if (err) 
        throw err;
      else if(res.rowCount>=1) {
        var user_list = res.rows[0].cripto_list.split(',');
        var user_precos = res.rows[0].precos_list.split(',');
        for([index,cripto] of cripto_list.entries()){
          if(user_list.indexOf(cripto)!=-1){
            var rm_index = user_list.indexOf(cripto)
            user_list.splice(rm_index,1);
            user_precos.splice(rm_index,1);
          }
          else{
            var mensagem = `Hmmm... Parece que você não possui o criptoativo ${cripto} em sua lista. Para verificá-la basta enviar /monitorar`
            bot.sendMessage(chatId, mensagem, { parse_mode: 'Markdown' });
          }
        }
        client.query(`UPDATE tb_criptolist SET cripto_list = '${user_list}',precos_list ='${user_precos}' WHERE user_id = '${user_id}';`, (err, res) => {
          if (err){
            throw err;
          }
          console.log(`tabela atualizada para usuário ${user_id}`);
          var mensagem = `Criptoativo removido com sucesso! ✅. Para verificar sua lista basta enviar /monitorar`
          bot.sendMessage(chatId, mensagem, { parse_mode: 'Markdown' });           
        })
      }
      else{
        var mensagem = `Hmmm... Parece que você ainda não tem uma lista de criptoativos 🤔. Você pode criar uma usando o comando /listar`
        bot.sendMessage(chatId, mensagem, { parse_mode: 'Markdown' });
      }    
    });
  }
  catch(e){
    var mensagem_erro = `Desculpe, mas não consegui encontrar o token. Por favor, verifique se há algum erro de digitação ou se o Token realmente existe.`
    bot.sendMessage(chatId,mensagem_erro);
    throw new Error("Whooops! parece que você tentou acessar algum token inexistente.")
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
    return precos_list;
  }

async function getList(){
    var resplist = await axios.get(`https://api.coingecko.com/api/v3/coins/list`);
    return resplist;
}
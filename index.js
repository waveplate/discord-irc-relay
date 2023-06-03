const IRC = require('irc-framework');
const { Client, GatewayIntentBits } = require('discord.js');

let bots = {};
let channel = null;

const ircOpts = {
    host: 'irc.efnet.org',
    port: 6697,
    chan:'#discord-relay',
    maxNickLength: 16,
}

const discordOpts = {
    channelId: '', // discord text channel id
    token: '', // discord bot token
}

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
    ],
});

client.on('ready', () => {
    console.log(`Bot is ready!`);

    channel = client.channels.cache.get(discordOpts.channelId);

    if (channel) {
        channel.guild.members.fetch().then(members => {
            members.forEach(member => {
                bots[member.user.id] = createBot(member.user.username);
            });

            bots[client.user.id].on('message', function (event) {
                if(!messageIsFromRelay(event.nick)){
                    channel.send(`<${event.nick}> ${event.message}`).catch(console.error);
                }
            });
        });
    }
});

client.on('messageCreate', message => {
    if(bots[message.author.id] == null)
        bots[message.author.id] = createBot(message.author.username);

    if(message.author.id != client.user.id)
        bots[message.author.id].say(ircOpts.chan, message.content);
});

client.login(discordOpts.token);

function createBot(nick){
    console.log(`Creating bot for ${nick}`);

    var bot = new IRC.Client();

    bot.connect({
        host: ircOpts.host,
        port: ircOpts.port,
        nick: sanitizeDiscordUsername(nick),
        tls: ircOpts.port == 6697 ? true : false,
        rejectUnauthorized: false,
    });

    bot.on('registered', () => {
        bot.join(ircOpts.chan);
    });

    return bot;
}

function sanitizeDiscordUsername(username){
    return username.replace(/[^a-zA-Z0-9]/g, '').substring(0, ircOpts.maxNickLength);
}

function messageIsFromRelay(nick){
    let isFromRelay = false;
    Object.values(bots).forEach(bot => {
        if(bot.options.nick == nick)
            isFromRelay = true;
    });

    return isFromRelay;
}
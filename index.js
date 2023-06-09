const IRC = require('irc-framework');
const { Client, GatewayIntentBits } = require('discord.js');
const fs = require('fs');

let bots = {};
let channels = {};

const config = JSON.parse(fs.readFileSync('config.json'));

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
    ],
});

client.login(config.discordToken);

client.on('ready', () => {
    console.log(`Bot is ready!`);

    Object.values(config.channels).forEach(channelId => {
        channels[channelId] = client.channels.cache.get(channelId);
    });

    bots[client.user.id] = createBot(config.nick);

    bots[client.user.id].on('message', function (event) {
        if(config.excludeNicks.includes(event.nick))
            return;

        let channel = channels[config.channels[event.target]];
        if (!messageIsFromRelay(event.nick)) {
            channel.send(`<${event.nick}> ${event.message}`).catch(console.error);
        }
    });
});

client.on('messageCreate', message => {
    if (message.author.id == client.user.id)
        return;

    if (bots[message.author.id] == null) {
        bots[message.author.id] = createBot(message.author.username, () => {
            relayMessage(message);
        });
    } else {
        relayMessage(message);
    }
});

function createBot(nick, registerCallback) {
    console.log(`Creating bot for ${nick}`);

    var bot = new IRC.Client();

    bot.connect({
        host: config.host,
        port: config.port,
        nick: sanitizeDiscordUsername(nick),
        tls: config.port == 6697 ? true : false,
        rejectUnauthorized: false,
    });

    bot.on('registered', () => {
        Object.keys(config.channels).forEach(channel => {
            bot.join(channel);
        });
        if (registerCallback != null)
            registerCallback();
    });

    return bot;
}

function relayMessage(message) {
    const ircChannel = getIrcChannelFromDiscordChannel(message.channel.id);

    bots[message.author.id].say(ircChannel, message.content);
    if (message.attachments.size > 0) {
        message.attachments.forEach(attachment => {
            bots[message.author.id].say(ircChannel, attachment.url);
        });
    }
}

function getIrcChannelFromDiscordChannel(discordChannelId) {
    let ircChannel = false;
    Object.keys(config.channels).forEach(ircChannelId => {
        if (config.channels[ircChannelId] == discordChannelId)
            ircChannel = ircChannelId;
    });
    return ircChannel;
};

function messageIsFromRelay(nick) {
    let isFromRelay = false;
    Object.values(bots).forEach(bot => {
        if (bot.options.nick == nick)
            isFromRelay = true;
    });

    return isFromRelay;
}

function sanitizeDiscordUsername(username) {
    return username.replace(/[^a-zA-Z0-9]/g, '').substring(0, config.maxNickLength);
}
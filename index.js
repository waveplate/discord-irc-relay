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
        GatewayIntentBits.GuildMembers
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
            event.nick = event.nick.replace(/\x03[0-9]{1,2}(,[0-9]{1,2})?/g, '');
            event.message = event.message.replace(/\x03[0-9]{1,2}(,[0-9]{1,2})?/g, '');
            event.nick = event.nick.replace(/[\x00-\x1F\x7F-\x9F]/g, '');
            event.message = event.message.replace(/[\x00-\x1F\x7F-\x9F]/g, '');
            channel.send(`<${event.nick}> ${event.message}`).catch(console.error);
        }
    });
});

client.on('messageCreate', message => {
    const ircChannel = getIrcChannelFromDiscordChannel(message.channel.id);

    if (!ircChannel || message.author.id == client.user.id)
        return;

    if (bots[message.author.id] == null) {
        client.guilds.fetch(message.guildId).then(guild => {
            guild.members.fetch(message.author.id).then(member => {
                bots[message.author.id] = createBot(member.nickname||message.author.username, () => {
                    relayMessage(ircChannel, message);
                });
            });
        });
    } else {
        relayMessage(ircChannel, message);
    }
});

client.on('guildMemberUpdate', (oldMember, newMember) => {
    if (bots[newMember.user.id]) {
        let newNick = sanitizeDiscordUsername(newMember.nickname||newMember.user.username);
        bots[newMember.user.id].changeNick(newNick);
        bots[newMember.user.id].options.nick = newNick;
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

function relayMessage(ircChannel, message) {
    let msg = '';

    if(message.mentions && message.mentions.repliedUser)
        msg += `${message.mentions.repliedUser.username}: `;
    msg += message.content;

    bots[message.author.id].say(ircChannel, msg);

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
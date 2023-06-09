# discord-irc-relay (1.0.0)
a better discord-irc relay that represents each discord user as a separate irc client connection on the server

### configuration

edit `config.json.example` and rename it to `config.json`

the `channels` section maps the irc channels to the discord text channels, e.g.,

```
    "channels": {
        "#sports": "237784782872424",
        "#music": "849429829924823"
    },
```

you can exclude specific nicknames from the relay by adding the nicknames to the `excludeNicks` array, in case they are youtube/twitter/title bots (discord already previews these)

### run

run `npm install`

run `node .`

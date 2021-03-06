# What is this
Datcord is a wrapper for the Discord API, primarily intended for connections to the [gateway](https://discord.com/developers/docs/topics/gateway).  
To understand how everything works, I strongly recommend you reading through the Discord docs (at least the gateway topic).  
This library pretty much takes care of the connecting (Heartbeating, Identifying).  
What it doesn't take care of is resuming/reconnecting and sharding, that would be up to you.  
For reconnecting, you'll receive a `gateway.events.RECONNECT` event, after that you should close the connection, try to reopen it, and if you're successful, [resume](https://discord.com/developers/docs/topics/gateway#resuming).

# Quick start
```javascript
const Datcord = require('./datcord');
const client = new Datcord('Bot YOUR_TOKEN');

// Events
client.on('gateway.open', () => {
    console.log('Connected to the gateway.');
    client.apiclient.post('/channels/SOME_CHANNEL_ID/messages', {
        content: 'Hello, world!',
        components: [{
            type: 1,
            components: [{
                type: 2,
                custom_id: 'examplecomponent',
                style: 2,
                label: 'Click me!'
            }]
        }]
    });
});

client.on('gateway.close', (event) => {
    console.log(`Gateway closed: ${event.code} - ${event.reason}`);
});

client.on('gateway.error', (event) => {
    console.log(`Gateway error: ${event.error.toString()}`);
});

client.on('gateway.event.INTERACTION_CREATE', (event) => {
    if (event.type === 3 && event.data.custom_id === 'examplecomponent') {
        console.log(`${event.member ? (event.member.nick || event.member.user.username) : event.user.username} clicked the button!`);
        client.apiclient.post(`/interactions/${event.id}/${event.token}/callback`, {
            type: 6,
            data: null
        });
    }
});

client.on('gateway.event.MESSAGE_CREATE', (event) => {
    /* if the message isn't coming from a webhook and it isn't sent by a bot */
    if (!event.webhook_id && !event.author.bot) {
        console.log(`${event.timestamp} >> ${event.author.username} : ${event.content}`);
    }
});
```
Replace `YOUR_TOKEN` with your Bot Token and `SOME_CHANNEL_ID` with a channel id to send the message to.  
This will connect to the gateway, send a message with a component (button) to a channel, and when a user clicks it, output to the console. It will also listen for messages and log them to the console.

# Config
The configuration object is passed to the `Datcord` constructor as a second, optional argument.  
Here is the default config:
```jsonc
{
    "api": {
        "host": "discord.com",      // The API host
        "basePath": "/api/v9",      // The base API path (build for v9, changing the version might lead to unexpected behavior)
        "port": 443                 // The API port
    },
    "gatewayQuery": "/gateway",     // API path to the GET Gateway endpoint
    "defaultPresence": {            // The initial presence, see https://discord.com/developers/docs/topics/gateway#update-presence-gateway-presence-update-structure
        "since": null,
        "activities": [],
        "status": "online",
        "afk": false
    },
    "intents": 32641,               // The gateway intents, see https://discord.com/developers/docs/topics/gateway#list-of-intents
    "cache": true                   // Whether to cache basic data, see Caching below
}
```

# Events
| Event             | Data                 | Description
| ----------------- | -------------------- | -------------------------------------------------------------------------------- 
| `socket.open`     | `{ }`                | Fired when the websocket connection is open.
| `socket.close`    | `{ code, reason }`   | Fired when the websocket connection is closed.
| `socket.error`    | `{ error }`          | Fired when the websocket connection is closed because of an error.
| `gateway.open`    | `{ ready }`          | Fired when the client is identified.
| `gateway.close`   | `{ code, reason }`   | Fired when the gateway is closed.
| `gateway.error`   | `{ error }`          | Fired when the gateway is closed because of an error.
| `gateway.message` | `{ message }`        | Fired when a message is sent to the client.
| `gateway.send`    | `{ opcode, data }`   | Fired when a message is sent to the server.
| `gateway.event.*` | `{ data }`           | Fired when the client receives a [gateway event](https://discord.com/developers/docs/topics/gateway#commands-and-events-gateway-events) (e.g. `gateway.event.MESSAGE_CREATE`). *

\* The events are not parsed/validated, they are just redirected from the gateway. Make sure you refer to the Discord docs for usage. Also, if you aren't receiving an event, make sure it is set in the `config.intents`.

# Public methods
| Type              | Name                                 | Description
| ----------------- | ------------------------------------ | ------------------------------------------------------------ 
| Datcord           | `constructor(token, config = null)`  | Creates a new client and logs in with the specified token.
| undefined         | `send(opcode, data)`                 | Sends data to the server.
| undefined         | `close(code = 4000, reason = null)`  | Closes the socket.
| ApiClient         | `apiclient`                          | The API client used by the client.

## ApiClient methods
| Type              | Name                                 | Description
| ----------------- | ------------------------------------ | ------------------------------------------------------------ 
| ApiClient         | `constructor(token, config = null)`  | Creates a new API client and with the specified token.
| Promise           | `get(path)`                          | Performs a GET request to the specified path.
| Promise           | `post(path, data)`                   | Performs a POST request to the specified path with the specified data.

For more information check the jsdoc comments.

# Caching
NOT YET IMPLEMENTED

# Todo
Cache simple data (guilds, users, messages) + helper functions (messaging, interactions)  
Make bridge to browser javascript  
Voice connections

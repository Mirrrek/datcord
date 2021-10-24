const Datcord = require('../../datcord');
const client = new Datcord('Bot YOUR_TOKEN');
const input = process.openStdin();

const channelID = 'SOME_CHANNEL_ID';

// Events
client.on('gateway.open', () => {
    console.log('Connected to the gateway.');
    input.on('data', (data) => {
        client.apiclient.post(`/channels/${channelID}/messages`, {
            content: data.toString().slice(0, -1)
        });
        process.stdout.write('You : ');
    });
    process.stdout.write('You : ');
});

client.on('gateway.close', (event) => {
    console.log(`Gateway closed: ${event.code} - ${event.reason}`);
});

client.on('gateway.error', (event) => {
    console.log(`Gateway error: ${event.error.toString()}`);
});

client.on('gateway.event.MESSAGE_CREATE', (event) => {
    if (event.channel_id === channelID && !event.webhook_id && !event.author.bot) {
        process.stdout.clearLine();
        process.stdout.cursorTo(0);
        process.stdout.write(`${event.author.username} : ${event.content}\nYou : `);
    }
});
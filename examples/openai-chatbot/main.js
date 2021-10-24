const Datcord = require('../../datcord');
const client = new Datcord('Bot YOUR_TOKEN');
const https = require('https');

const channelID = 'SOME_CHANNEL_ID';
var messages = [];

// Events
client.on('gateway.open', () => {
    console.log('Connected to the gateway.');
    client.apiclient.post(`/channels/${channelID}/messages`, {
        content: 'Starting conversation...'
    });
});

client.on('gateway.close', (event) => {
    console.log(`Gateway closed: ${event.code} - ${event.reason}`);
});

client.on('gateway.error', (event) => {
    console.log(`Gateway error: ${event.error.toString()}`);
});

client.on('gateway.event.MESSAGE_CREATE', (event) => {
    if (event.channel_id === channelID && !event.webhook_id && !event.author.bot) {
        messages.push({
            author: event.author.username,
            content: event.content
        });
        client.apiclient.post(`/channels/${channelID}/typing`, {});
        const request = https.request({
            hostname: 'api.openai.com',
            port: 443,
            path: '/v1/engines/davinci/completions',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer YOUR_OPENAI_TOKEN'
            }
        }, (response) => {
            var data = '';
            response.on('data', (chunk) => {
                data += chunk;
            });
            response.on('end', () => {
                const completion = JSON.parse(data).choices[0].text.trim();
                client.apiclient.post(`/channels/${channelID}/messages`, {
                    content: completion
                });
                messages.push({ author: 'GPT-3', content: completion });
            });
        });

        request.write(JSON.stringify({
            prompt: 'The following is a conversation between one or multiple humans and the GPT-3 algorithm acting like a human would.\n\n' + messages.map((message) => { return `${message.author}: ${message.content}` }).join('\n') + '\nGPT-3:',
            temperature: 0.8,
            max_tokens: 64,
            top_p: 1,
            frequency_penalty: 0.0,
            presence_penalty: 0.6,
            stop: ['\n']
        }));
        request.end();
    }
});
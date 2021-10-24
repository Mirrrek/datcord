const events = require('events');
const WebSocket = require('ws');
const https = require('https');

/** The configuration for the client
 * @typedef {Object} config
 * @property {Object} [api]
 * @property {string} [api.host]
 * @property {string} [api.basePath]
 * @property {number} [api.port]
 * @property {string} [gatewayQuery]
 * @property {Object} [defaultPresence]
 * @property {number} [defaultPresence.since]
 * @property {Array} [defaultPresence.activities]
 * @property {string} [defaultPresence.status]
 * @property {Boolean} [defaultPresence.afk]
 * @property {number} [intents]
 * @property {Boolean} [cache]
 */

class ApiClient {
    #token;
    #config;
    
    /** Creates a new API client and with the specified token.
     * @param {string} token The Bot / Bearer token to login with.
     * @param {config} [config] The config to use.
     */
    constructor(token, config = null) {
        this.#token = token;
        this.#config = {
            api: {
                host: (config?.api?.host !== undefined) ? config.api.host : 'discord.com',
                basePath: (config?.api?.basePath !== undefined) ? config.api.basePath : '/api/v9',
                port: (config?.api?.port !== undefined) ? config.api.port : 443
            },
            gatewayQuery: (config?.gatewayQuery !== undefined) ? config?.gatewayQuery : '/gateway',
            defaultPresence: (config?.defaultPresence !== undefined) ? config?.defaultPresence : {
                since: (config?.defaultPresence?.since !== undefined) ? config?.defaultPresence?.since : null,
                activities: (config?.defaultPresence?.activities !== undefined) ? config?.defaultPresence?.activities : [],
                status: (config?.defaultPresence?.status !== undefined) ? config?.defaultPresence?.status : 'online',
                afk: (config?.defaultPresence?.afk !== undefined) ? config?.defaultPresence?.afk : false
            },
            intents: (config?.intents !== undefined) ? config?.intents : 32767,
            cache: (config?.cache !== undefined) ? config?.cache : true
        }
    }

    /** Performs a GET request to the specified path.
     * @param {string} path The request path.
     * @returns {Promise} The requested data or an error.
     */
    get(path) {
        return new Promise((resolve, reject) => {
            const request = https.request({
                hostname: this.#config.api.host,
                port: this.#config.api.port,
                path: this.#config.api.basePath + path,
                method: 'GET',
                headers: {
                    'Authorization': this.#token
                }
            }, (response) => {
                var data = '';
                response.on('data', (chunk) => {
                    data += chunk;
                });
                response.on('end', () => {
                    try {
                        resolve(JSON.parse(data));
                    } catch (error) {
                        if (error instanceof SyntaxError) {
                            resolve(data);
                        } else {
                            reject(error);
                        }
                    }
                });
            });

            request.on('error', (error) => {
                reject(error);
            });

            request.end();
        });
    }

    /** Performs a POST request to the specified path with the specified data.
     * @param {string} path The request path.
     * @param {object} data The request data.
     * @returns {Promise} The requested data or an error.
     */
    post(path, data) {
        return new Promise((resolve, reject) => {
            const request = https.request({
                hostname: this.#config.api.host,
                port: this.#config.api.port,
                path: this.#config.api.basePath + path,
                method: 'POST',
                headers: {
                    'Authorization': this.#token,
                    'Content-Type': 'application/json'
                }
            }, (response) => {
                var data = '';
                response.on('data', (chunk) => {
                    data += chunk;
                });
                response.on('end', () => {
                    try {
                        resolve(JSON.parse(data));
                    } catch (error) {
                        if (error instanceof SyntaxError) {
                            resolve(data);
                        } else {
                            reject(error);
                        }
                    }
                });
            });

            request.on('error', (error) => {
                reject(error);
            });

            request.write(JSON.stringify(data));
            request.end();
        });
    }
}

module.exports = class Datcord extends events.EventEmitter {
    /** The API client used by the client.
     * @type {ApiClient}
     */
    apiclient;
    #token;
    #config;
    #ws;
    #opcodeWaits = [];
    #heartbeat = {
        interval: null,
        receivedLast: false,
        lastSequence: null
    }

    /** Creates a new client and logs in with the specified token.
     * @param {string} token The Bot / Bearer token to login with.
     * @param {config} [config] The config to use.
     */
    constructor(token, config = null) {
        super();
        this.#token = token;
        this.#config = {
            api: {
                host: (config?.api?.host !== undefined) ? config.api.host : 'discord.com',
                basePath: (config?.api?.basePath !== undefined) ? config.api.basePath : '/api/v9',
                port: (config?.api?.port !== undefined) ? config.api.port : 443
            },
            gatewayQuery: (config?.gatewayQuery !== undefined) ? config?.gatewayQuery : '/gateway',
            defaultPresence: (config?.defaultPresence !== undefined) ? config?.defaultPresence : {
                since: (config?.defaultPresence?.since !== undefined) ? config?.defaultPresence?.since : null,
                activities: (config?.defaultPresence?.activities !== undefined) ? config?.defaultPresence?.activities : [],
                status: (config?.defaultPresence?.status !== undefined) ? config?.defaultPresence?.status : 'online',
                afk: (config?.defaultPresence?.afk !== undefined) ? config?.defaultPresence?.afk : false
            },
            intents: (config?.intents !== undefined) ? config?.intents : 32641,
            cache: (config?.cache !== undefined) ? config?.cache : true
        }
        this.apiclient = new ApiClient(this.#token, this.#config);
        this.apiclient.get(this.#config.gatewayQuery).then((response) => {
            this.#ws = new WebSocket(response.url + '?v=9&encoding=json');
            this.#ws.on('open', () => { this.#onOpen(); });
            this.#ws.on('message', (message) => { this.#onMessage(JSON.parse(message)); });
            this.#ws.on('close', (code, reason) => { this.#onClose(code, reason); });
            this.#ws.on('error', (reason) => { this.#onError(reason); });
        });
    }

    async #onOpen() {
        this.emit('socket.open', {});

        // Wait for Hello
        const heartbeatInterval = (await this.#waitForOpcode(10)).data.heartbeat_interval;

        // Start heartbeat
        this.send(1, this.#heartbeat.lastSequence);
        this.#heartbeat.interval = setInterval(() => {
            if (!this.#heartbeat.receivedLast) {
                this.close();
            }
            this.send(1, this.#heartbeat.lastSequence);
        }, heartbeatInterval);

        // Identify
        this.send(2, {
            token: this.#token,
            properties: {
                os: 'windows',
                browser: 'custom',
                device: 'custom'
            },
            presence: this.#config.defaultPresence,
            intents: this.#config.intents
        });

        this.emit('gateway.open', {});
    }

    async #onMessage(message) {
        // Message parsing
        message = {
            opcode: message.op,
            data: message.d,
            sequence: message.s,
            event: message.t
        }

        this.emit('gateway.message', message);

        // Sequence numbering
        this.#heartbeat.lastSequence = message.sequence;

        // Opcode waits
        var waitedForOpcode = false;
        this.#opcodeWaits.forEach((wait, i) => {
            if (wait.opcode === message.opcode) {
                wait.resolve(message);
                waitedForOpcode = true;
                this.#opcodeWaits.slice(i, 1);
            }
        });
        if (waitedForOpcode) {
            return;
        }

        // Heartbeat
        if (message.opcode === 1) {
            this.send(1, this.#heartbeat.lastSequence);
            return;
        }
        if (message.opcode === 11) {
            this.#heartbeat.receivedLast = true;
            return;
        }

        // Reconnect
        if (message.opcode === 7) {
            console.log('RECONNECT');
            this.close();
        }

        // Invalid Session
        if (message.opcode === 9) {
            console.log('INVALID SESSION');
            this.close();
        }

        // Event
        if (message.opcode === 0) {
            this.emit('gateway.event.' + message.event, message.data);
        }
    }

    #onClose(code, reason) {
        this.emit('gateway.close', { code: code, reason: reason });
        if (this.#heartbeat.interval) {
            clearInterval(this.#heartbeat.interval);
            this.#heartbeat.interval = null;
        }
        this.emit('socket.close', { code: code, reason: reason });
    }

    #onError(error) {
        this.emit('gateway.error', { error: error });
        if (this.#heartbeat.interval) {
            clearInterval(this.#heartbeat.interval);
            this.#heartbeat.interval = null;
        }
        this.emit('socket.error', { error: error });
    }

    /** Sends data to the server.
     * @param {number} opcode The message opcode.
     * @param {object} data The data to send.
     */
    send(opcode, data) {
        this.#ws.send(JSON.stringify({
            op: opcode,
            d: data,
            s: null,
            t: null
        }));
        this.emit('gateway.send', { opcode: opcode, data: data });
    }


    /** Closes the socket.
     * @param {number} [code] The error code.
     * @param {string} [reason] The error reason.
     */
    close(code = 4000, reason = null) {
        this.#ws.close(code, reason);
    }

    #waitForOpcode(opcode) {
        return new Promise((resolve, reject) => {
            this.#opcodeWaits.push({
                opcode: opcode,
                resolve: resolve
            });
        });
    }
}
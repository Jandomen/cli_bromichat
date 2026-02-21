const { io } = require('socket.io-client');
const ora = require('ora');
const { client, conf } = require('../api/client');
const { clear, showBanner, chalk, emoji, inquirer, waitKey } = require('../utils/ui');
const { SOCKET_URL } = require('../utils/constants');

const startChat = async (selectedConversation = null) => {
    while (true) {
        let conversation = selectedConversation;

        // If no conversation provided, show the list
        if (!conversation) {
            clear();
            showBanner();
            const spinner = ora('Sincronizando tus canales de comunicación...').start();

            try {
                const response = await client.get('/conversation');
                const conversations = response.data;
                spinner.stop();

                if (conversations.length === 0) {
                    console.log(chalk.yellow(` ${emoji.get('warning')} Sin señales de vida. Tu lista de chats está vacía.`));
                    const { search } = await inquirer.prompt([{
                        type: 'confirm',
                        name: 'search',
                        message: '¿Quieres buscar a alguien para iniciar una comunicación?',
                        default: true
                    }]);
                    if (search) return 'search';
                    await waitKey();
                    return;
                }

                const choices = conversations.map(c => {
                    const isGroup = c.isGroup;
                    const label = isGroup
                        ? chalk.magenta(`[GRUPO] ${c.name || 'Sin nombre'}`)
                        : chalk.blue(`[CHAT] @${c.participants.find(p => p._id !== conf.get('user')._id)?.username || 'Desconocido'}`);

                    const lastMsg = c.lastMessage?.content?.substring(0, 30) || 'Contenido multimedia...';

                    return {
                        name: `${label} ${chalk.gray('-> ' + lastMsg)}`,
                        value: c
                    };
                });

                choices.push(new inquirer.Separator());
                choices.push({ name: chalk.red(`${emoji.get('arrow_left')} Volver al Menú Central`), value: 'back' });

                const { selection } = await inquirer.prompt([{
                    type: 'list',
                    name: 'selection',
                    message: 'Selecciona una frecuencia de chat:',
                    choices: choices
                }]);

                if (selection === 'back') return;
                conversation = selection;
            } catch (error) {
                spinner.fail('Falla en la señal: ' + error.message);
                await waitKey();
                break;
            }
        }

        // Enter the chosen chat
        await enterChat(conversation);

        // If we came from a specific conversation (from search), we return after exiting it
        if (selectedConversation) return;

        // Otherwise, the loop continues and shows the list again
    }
};

const enterChat = async (conversation) => {
    const user = conf.get('user');
    const isGroup = conversation.isGroup;
    const otherUser = isGroup ? null : conversation.participants.find(p => p._id !== user._id);

    clear();
    showBanner();
    const chatTitle = isGroup ? `SALA GRUPAL: ${conversation.name}` : `CANAL PRIVADO: @${otherUser?.username}`;
    console.log(chalk.bold.cyan(` ${emoji.get('messages')} CONEXIÓN ESTABLECIDA | ${chatTitle} `));
    console.log(chalk.gray(` [Escribe /back para salir] [Escribe /more para ver el pasado]\n`));

    const socket = io(SOCKET_URL, {
        auth: { userId: user._id },
        query: { userId: user._id },
        transports: ['websocket']
    });

    const roomType = isGroup ? 'group' : 'conversation';
    socket.emit(isGroup ? 'join_group' : 'join_conversation', {
        [isGroup ? 'groupId' : 'conversationId']: conversation._id
    });

    let currentPage = 1;
    const loadMessages = async (page = 1) => {
        const spinner = ora(page === 1 ? 'Recuperando transmisiones...' : 'Sincronizando más mensajes...').start();
        try {
            const endpoint = `/messages/conversation/${conversation._id}?page=${page}&limit=20`;
            const historyRes = await client.get(endpoint);
            spinner.stop();

            const messages = historyRes.data.messages || [];

            if (page === 1) {
                clear();
                showBanner();
                console.log(chalk.bold.cyan(` ${emoji.get('messages')} CONEXIÓN ESTABLECIDA | ${chatTitle} `));
            }

            // Messages arrive newest first from backend (due to reverse), so we print them
            // In enterChat they are already reversed in backend? Let's check. 
            // In controller: return res.status(200).json({ messages: processedMessages.reverse() });
            // So messages are oldest first now.
            messages.forEach(m => {
                const time = new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                const mSenderId = m.senderId?._id || m.senderId;
                const senderIdStr = mSenderId.toString();
                const isMe = senderIdStr === user._id.toString();

                let prefix = '';
                if (isMe) {
                    prefix = chalk.green('Tú: ');
                } else {
                    const senderName = isGroup ? `@${m.senderId?.username || 'miembro'}` : `@${otherUser?.username}`;
                    prefix = chalk.blue(`${senderName}: `);
                }

                let content = m.content || '';
                if (m.fileUrl) content += ` ${chalk.magenta(emoji.get('link') + ' [Link: ' + m.fileUrl + ']')}`;

                console.log(chalk.gray(`[${time}] `) + prefix + content);
            });
            return messages.length;
        } catch (err) {
            spinner.fail('Error al cargar historial.');
            return 0;
        }
    };

    await loadMessages(currentPage);

    // Listen for real-time messages (Server uses different events)
    const handleNewMessage = (data) => {
        const msg = data.message || data;
        const msgConvId = data.conversationId || msg.conversationId;

        if (msgConvId.toString() === conversation._id.toString()) {
            const mSenderId = msg.senderId?._id || msg.senderId;
            const senderIdStr = (mSenderId?._id || mSenderId || '').toString();

            if (senderIdStr !== user._id.toString()) {
                const senderName = isGroup ? `@${msg.senderId?.username || 'miembro'}` : `@${otherUser?.username}`;
                const prefix = chalk.blue(`${senderName}: `);
                console.log(`\n${prefix}${msg.content || ''}`);
                if (msg.fileUrl) console.log(chalk.magenta(` ${emoji.get('link')} [Link: ${msg.fileUrl}]`));
            }
        }
    };

    socket.on('conversation_message', handleNewMessage);
    socket.on('newGroupMessage', handleNewMessage);

    let active = true;
    while (active) {
        try {
            const { text } = await inquirer.prompt([{
                type: 'input',
                name: 'text',
                message: chalk.cyan('COMANDO>'),
                prefix: ''
            }]);

            if (text === '/back') {
                active = false;
            } else if (text === '/more') {
                currentPage++;
                await loadMessages(currentPage);
            } else if (text.trim()) {
                const payload = {
                    conversationId: conversation._id,
                    content: text
                };
                if (!isGroup) payload.recipientId = otherUser?._id;

                await client.post('/messages/send', payload);
                console.log(chalk.green(' Tú: ') + text);
            }
        } catch (err) {
            // Probably CTRL+C or prompt error
            active = false;
        }
    }

    // Clean up
    socket.off('conversation_message');
    socket.off('newGroupMessage');
    socket.disconnect();
};

module.exports = { startChat };

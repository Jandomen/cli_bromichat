const ora = require('ora');
const { client } = require('../api/client');
const { clear, showBanner, chalk, emoji, inquirer, waitKey, boxen } = require('../utils/ui');

async function getNotifications() {
    while (true) {
        clear();
        showBanner();
        console.log(chalk.yellow(` ${emoji.get('bell')} CENTRO DE NOTIFICACIONES REAL-TIME\n`));

        const spinner = ora('Sincronizando con el servidor...').start();
        try {
            const response = await client.get('/notifications');
            spinner.stop();
            const notifications = response.data;

            if (notifications.length === 0) {
                console.log(chalk.gray(` ${emoji.get('zzz')} No tienes notificaciones nuevas.`));
            } else {
                notifications.slice(0, 15).forEach(n => {
                    const time = new Date(n.createdAt).toLocaleString([], { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
                    const status = n.isRead ? chalk.gray(' [Leída] ') : chalk.bold.green(' [NUEVA] ');
                    const typeIcon = n.type === 'like' ? emoji.get('heart') : n.type === 'comment' ? emoji.get('speech_balloon') : emoji.get('bust_in_silhouette');

                    console.log(`${status}${chalk.gray(time)} ${typeIcon} ${chalk.white(n.message)}`);
                });
            }

            const { action } = await inquirer.prompt([{
                type: 'list',
                name: 'action',
                message: 'Opciones:',
                choices: [
                    { name: 'Marcar todas como leídas', value: 'read_all' },
                    { name: 'Actualizar', value: 'refresh' },
                    { name: 'Regresar al Menú', value: 'back' }
                ]
            }]);

            if (action === 'back') return;
            if (action === 'read_all') {
                await client.put('/notifications/mark-all-read');
                console.log(chalk.green('\n Todas las notificaciones marcadas como leídas.'));
                await new Promise(r => setTimeout(r, 1000));
            }

        } catch (error) {
            spinner.fail('Error al obtener notificaciones.');
            await waitKey();
            return;
        }
    }
}

module.exports = { getNotifications };

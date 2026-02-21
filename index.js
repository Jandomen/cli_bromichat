const { initialMenu, login, adminLogin, logout } = require('./src/modules/auth');
const { startChat } = require('./src/modules/chat');
const { manageProfile, lookupAnyId } = require('./src/modules/profile');
const { listPosts, createNewPost } = require('./src/modules/posts');
const { listVideos } = require('./src/modules/videos');
const { searchAndManageUsers } = require('./src/modules/users');
const { showAdminPanel } = require('./src/modules/admin');
const { getNotifications } = require('./src/modules/notifications');
const { conf } = require('./src/api/client');
const { clear, showBanner, showFooter, chalk, emoji, inquirer } = require('./src/utils/ui');

async function mainMenu() {

    if (!conf.get('has_started')) {
        clear();
        showBanner();
        console.log(chalk.yellow(` ${emoji.get('sparkles')} ¡BIENVENIDO AL ENTORNO JANDOSOFT!`));
        console.log(chalk.white(' Detectamos que es tu primera conexión desde esta terminal.\n'));
        console.log(chalk.gray(' Configurando protocolos de encriptación y acceso...'));
        await new Promise(r => setTimeout(r, 2000));
        conf.set('has_started', true);
    }

    while (true) {
        clear();
        showBanner();
        const user = conf.get('user');

        console.log(chalk.bold.green(` ${emoji.get('bust_in_silhouette')} SEÑAL ACTIVA: `) + chalk.white(`${user.name} (@${user.username})`));
        console.log(chalk.gray(` ──────── Sesión Encriptada • ${new Date().toLocaleTimeString()} ────────`));
        console.log();

        const { action } = await inquirer.prompt([{
            type: 'list',
            name: 'action',
            message: 'PROTOCOLO DE ACCIÓN:',
            choices: [
                { name: `${emoji.get('earth_americas')} Explorar Muro Global`, value: 'feed' },
                { name: `${emoji.get('movie_camera')} Canal de Clips (Reels)`, value: 'videos' },
                { name: `${emoji.get('speech_balloon')} Consola de Mensajes (Real-Time)`, value: 'chats' },
                { name: `${emoji.get('bell')} Notificaciones`, value: 'notifications' },
                { name: `${emoji.get('mag')} Buscar Usuarios y Amigos`, value: 'users' },
                { name: `${emoji.get('pencil2')} Publicar Estado`, value: 'post' },
                { name: `${emoji.get('bust_in_silhouette')} Mi Perfil y Red Social`, value: 'profile' },
                { name: `${emoji.get('mag_right')} Investigar ID Específico`, value: 'lookup' },
                new inquirer.Separator(),
                { name: `${emoji.get('door')} Cerrar Sesión`, value: 'logout' },
                { name: `${emoji.get('x')} Desactivar Terminal`, value: 'exit' },
                new inquirer.Separator(),
                { name: chalk.dim(' [ PROTOCOLO SUDO ]'), value: 'admin_panel' }
            ]
        }]);

        showFooter();

        try {
            switch (action) {
                case 'feed': await listPosts(); break;
                case 'videos': await listVideos(); break;
                case 'chats': await startChat(); break;
                case 'notifications': await getNotifications(); break;
                case 'users':
                    const chatToOpen = await searchAndManageUsers();
                    if (chatToOpen) {
                        await startChat(chatToOpen);
                    }
                    break;
                case 'post': await createNewPost(); break;
                case 'profile': await manageProfile(); break;
                case 'lookup': await lookupAnyId(); break;
                case 'logout':
                    logout();
                    if (await initialMenu()) continue;
                    else return;
                case 'admin_panel':
                    if (await adminLogin()) {
                        await showAdminPanel();
                    }
                    continue;
                case 'exit':
                    console.log(chalk.cyan(`\n ${emoji.get('wave')} Terminando procesos... ¡Regresa pronto, ${user.username}!`));
                    process.exit(0);
            }
        } catch (err) {
            console.log(chalk.red(`\n ${emoji.get('bomb')} Error en el módulo ${action}: ${err.message}`));
            await new Promise(r => setTimeout(r, 2000));
        }
    }
}

async function start() {
    if (!conf.has('token')) {
        const success = await initialMenu();
        if (success) await mainMenu();
    } else {
        await mainMenu();
    }
}

start().catch(err => {
    console.error(chalk.bold.red('\n !!! FALLO CRÍTICO DEL SISTEMA !!!'));
    console.error(chalk.red(err.stack));
    process.exit(1);
});

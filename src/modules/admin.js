const ora = require('ora');
const { client } = require('../api/client');
const { clear, showBanner, chalk, emoji, inquirer, waitKey, boxen } = require('../utils/ui');

const showAdminPanel = async () => {
    while (true) {
        clear();
        showBanner();

        console.log(chalk.bold.red(` ${emoji.get('shield')} CENTRO DE COMANDO ADMINISTRATIVO - SISTEMA MAESTRO`));
        console.log(chalk.red(' ────────────────────────────────────────────────────────────\n'));

        const spinner = ora('Sincronizando métricas globales...').start();
        let stats = { totalUsers: 0, totalPosts: 0, totalVideos: 0 };

        try {
            const res = await client.get('/admin/dashboard');
            stats = res.data.stats;
            spinner.stop();
        } catch (err) {
            spinner.fail('Error al conectar con la base de datos maestra.');
            await waitKey();
            return;
        }

        console.log(boxen(
            `${chalk.bold('INFRAESTRUCTURA ACTUAL:')}\n\n` +
            `${chalk.cyan(emoji.get('busts_in_silhouette') + ' USUARIOS TOTALES:')} ${chalk.bold(stats.totalUsers)}\n` +
            `${chalk.green(emoji.get('page_facing_up') + ' PUBLICACIONES:')} ${chalk.bold(stats.totalPosts)}\n` +
            `${chalk.magenta(emoji.get('clapper') + ' CLIPS (REELS):')} ${chalk.bold(stats.totalVideos)}\n\n` +
            `${chalk.yellow('ESTADO DEL SISTEMA: OPTIMIZADO')}`,
            { padding: 1, borderColor: 'red', borderStyle: 'double', title: ' MÉTRICAS DE RED ' }
        ));

        const { action } = await inquirer.prompt([{
            type: 'list',
            name: 'action',
            message: 'PROTOCOLO DE GESTIÓN:',
            choices: [
                { name: `${emoji.get('mag')} Gestionar Usuarios (Ban/Suspensión/Rango)`, value: 'users' },
                { name: `${emoji.get('no_entry_sign')} Moderar Contenido (Borrar Posts/Clips)`, value: 'content' },
                { name: `${emoji.get('microscope')} Auditoría Cuántica de IDs (HEX_DEEP)`, value: 'audit' },
                { name: `${emoji.get('gear')} Configuración Global (Ads/Mensajes)`, value: 'settings' },
                new inquirer.Separator(),
                { name: chalk.yellow(`${emoji.get('back')} Regresar al Modo Usuario (Monitorización)`), value: 'back' }
            ]
        }]);

        if (action === 'back') return;

        switch (action) {
            case 'users': await manageUsers(); break;
            case 'content': await moderateContent(); break;
            case 'audit': await deepIdAudit(); break;
            case 'settings': await globalSettings(); break;
        }
    }
};

const manageUsers = async () => {
    const { query } = await inquirer.prompt([{ type: 'input', name: 'query', message: 'ID o Nombre de Usuario a investigar:' }]);
    if (!query) return;

    try {
        const res = await client.get(`/admin/search?type=user&query=${query}`);
        const users = res.data;

        if (users.length === 0) {
            console.log(chalk.red(' No se encontraron registros con ese ID o alias.'));
            await waitKey();
            return;
        }

        const { targetUser } = await inquirer.prompt([{
            type: 'list',
            name: 'targetUser',
            message: 'SELECCIONA SUJETO:',
            choices: users.map(u => ({ name: `@${u.username} (${u.email}) - Rol: ${u.role}`, value: u }))
        }]);

        const { userAction } = await inquirer.prompt([{
            type: 'list',
            name: 'userAction',
            message: `ACCIÓN SOBRE @${targetUser.username}:`,
            choices: [
                { name: 'Cambiar Rango (Admin/User)', value: 'role' },
                { name: 'Suspender Temporalmente', value: 'suspend' },
                { name: 'Revocar Suspensión', value: 'unsuspend' },
                { name: `${emoji.get('skull')} BANEO PERMANENTE (CUENTA + IP)`, value: 'ban_ip' },
                { name: 'ELIMINAR CUENTA (Acción Final)', value: 'delete' },
                { name: 'Cancelar', value: 'back' }
            ]
        }]);

        if (userAction === 'back') return;

        if (userAction === 'role') {
            const { newRole } = await inquirer.prompt([{ type: 'list', name: 'newRole', message: 'Asignar Rango:', choices: ['user', 'admin'] }]);
            await client.post('/admin/user/role', { userId: targetUser._id, role: newRole });
            console.log(chalk.green(' Privilegios actualizados.'));
        } else if (userAction === 'suspend') {
            const { days, reason } = await inquirer.prompt([
                { type: 'input', name: 'days', message: 'Días de suspensión:', default: '7' },
                { type: 'input', name: 'reason', message: 'Motivo del protocolo:' }
            ]);
            await client.post('/admin/user/suspend', { userId: targetUser._id, days, reason });
            console.log(chalk.yellow(' Sujeto suspendido de la red.'));
        } else if (userAction === 'unsuspend') {
            await client.post('/admin/user/unsuspend', { userId: targetUser._id });
            console.log(chalk.green(' Acceso restaurado.'));
        } else if (userAction === 'ban_ip') {
             const { confirm } = await inquirer.prompt([{ type: 'confirm', name: 'confirm', message: chalk.red('¿BLOQUEAR IP Y CUENTA PERMANENTEMENTE?'), default: false }]);
             if (confirm) {
                await client.post('/admin/user/ban', { userId: targetUser._id, reason: 'Baneo por IP via Centro de Comando CLI' });
                console.log(chalk.red(' Terminal bloqueada. Sujeto fuera de la red.'));
             }
        } else if (userAction === 'delete') {
            const { confirm } = await inquirer.prompt([{ type: 'confirm', name: 'confirm', message: chalk.red('¿CONFIRMAR ELIMINACIÓN TOTAL?'), default: false }]);
            if (confirm) {
                await client.delete(`/admin/user/${targetUser._id}`);
                console.log(chalk.red(' Registros borrados del sistema.'));
            }
        }
        await waitKey();
    } catch (err) {
        console.log(chalk.red(' Error en la ejecución: ' + err.message));
        await waitKey();
    }
};

const moderateContent = async () => {
    const { type } = await inquirer.prompt([{ type: 'list', name: 'type', message: 'Tipo de contenido a moderar:', choices: [{ name: 'Publicaciones (Muro)', value: 'post' }, { name: 'Clips (Reels)', value: 'video' }] }]);
    const { query } = await inquirer.prompt([{ type: 'input', name: 'query', message: 'Palabra clave o ID de contenido:' }]);

    try {
        const res = await client.get(`/admin/search?type=${type}&query=${query}`);
        const items = res.data;

        if (items.length === 0) {
            console.log(chalk.red(' No hay registros coincidentes.'));
            await waitKey();
            return;
        }

        const { targetItem } = await inquirer.prompt([{
            type: 'list',
            name: 'targetItem',
            message: 'SELECCIONA REGISTRO:',
            choices: items.map(i => ({ name: `${type === 'post' ? i.content?.substring(0, 40) : i.title} (@${(i.user?.username || i.userId?.username) || 'anónimo'})`, value: i }))
        }]);

        const { confirm } = await inquirer.prompt([{ type: 'confirm', name: 'confirm', message: chalk.red('¿BORRAR CONTENIDO DEFINITIVAMENTE?'), default: false }]);
        if (confirm) {
            await client.delete(`/admin/${type}/${targetItem._id}`);
            console.log(chalk.green(' Contenido purgado con éxito.'));
        }
        await waitKey();
    } catch (err) {
        console.log(chalk.red(' Fallo en la purga: ' + err.message));
        await waitKey();
    }
};

const globalSettings = async () => {
    try {
        const res = await client.get('/admin/dashboard');
        const settings = res.data.settings;

        const { settingKey } = await inquirer.prompt([{
            type: 'list',
            name: 'settingKey',
            message: 'AJUSTAR PARÁMETRO:',
            choices: [
                { name: 'Habilitar/Deshabilitar Publicidad', value: 'adsEnabled' },
                { name: 'Cambiar Mensaje de Bienvenida/Avisos', value: 'welcomeMessage' },
                { name: 'Cancelar', value: 'back' }
            ]
        }]);

        if (settingKey === 'back') return;

        let newValue;
        if (settingKey === 'adsEnabled') {
            const current = settings.find(s => s.key === 'adsEnabled')?.value === 'true';
            const { val } = await inquirer.prompt([{ type: 'confirm', name: 'val', message: '¿Activar sistema de anuncios?', default: current }]);
            newValue = val.toString();
        } else {
            const { val } = await inquirer.prompt([{ type: 'input', name: 'val', message: 'Nuevo mensaje para la red:' }]);
            newValue = val;
        }

        await client.post('/admin/settings', { key: settingKey, value: newValue });
        console.log(chalk.green(' Parámetros globales actualizados.'));
        await waitKey();
    } catch (err) {
        console.log(chalk.red(' Error al actualizar configuración: ' + err.message));
        await waitKey();
    }
};

const deepIdAudit = async () => {
    const { id } = await inquirer.prompt([{ type: 'input', name: 'id', message: 'HEX_ID a investigar:' }]);
    if (!id) return;

    const spinner = ora('Realizando escaneo multiconfiguración...').start();
    try {
        const res = await client.get(`/admin/audit/${id}`);
        const { entityType, data } = res.data;
        spinner.stop();

        console.log(boxen(
            `${chalk.bold.yellow('ENTITY_TYPE:')} ${chalk.bold(entityType.toUpperCase())}\n` +
            `${chalk.bold.cyan('CONTENIDO:')} ${data.content || data.title || data.username || 'N/A'}\n` +
            `${chalk.bold.magenta('AUTOR/ID:')} ${data.user?.username || data._id}\n` +
            `${chalk.bold.green('REACCIONES:')} ${data.reactions?.length || 0}\n` +
            `${chalk.bold.gray('REGISTRO:')} ${new Date(data.createdAt).toLocaleString()}\n\n` +
            `${chalk.white(JSON.stringify(data, null, 2).substring(0, 500))}...`,
            { padding: 1, borderColor: 'green', borderStyle: 'round', title: ' RESULTADO DE AUDITORÍA ' }
        ));

        const { action } = await inquirer.prompt([{
            type: 'list',
            name: 'action',
            message: 'PRESIÓN OPERATIVA:',
            choices: [
                { name: 'Eliminar Registro Permanentemente', value: 'delete' },
                { name: 'Finalizar Auditoría', value: 'back' }
            ]
        }]);

        if (action === 'delete') {
            const endpoint = entityType === 'user' ? `/admin/user/${id}` : `/admin/${entityType}/${id}`;
            await client.delete(endpoint);
            console.log(chalk.green(' Registro purgado de la red.'));
        }
        await waitKey();
    } catch (err) {
        spinner.fail(err.response?.data?.error || 'ID no encontrado.');
        await waitKey();
    }
};

module.exports = { showAdminPanel };

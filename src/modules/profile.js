const ora = require('ora');
const { client, conf } = require('../api/client');
const { clear, showBanner, chalk, emoji, inquirer, waitKey, boxen } = require('../utils/ui');

const manageProfile = async () => {
    while (true) {
        clear();
        showBanner();
        const user = conf.get('user');

        console.log(boxen(
            chalk.magenta.bold(`${emoji.get('bust_in_silhouette')} IDENTIDAD: @${user.username}`) + `\n` +
            chalk.white(`Nombre: ${user.name} ${user.lastName}`),
            { padding: 1, borderStyle: 'double', borderColor: 'magenta', title: ' MI ESPACIO JANDOSOFT ' }
        ));

        const { action } = await inquirer.prompt([{
            type: 'list',
            name: 'action',
            message: 'PROTOCOLO DE GESTIÓN:',
            choices: [
                { name: `${emoji.get('eye')} Ver Mi Expediente Completo`, value: 'view_me' },
                { name: `${emoji.get('handshake')} Mis Compas (Amigos)`, value: 'friends' },
                { name: `${emoji.get('busts_in_silhouette')} Mis Seguidores`, value: 'followers' },
                { name: `${emoji.get('walking')} Usuarios que Sigo`, value: 'following' },
                { name: `${emoji.get('gear')} Configuración y Seguridad`, value: 'edit_me' },
                { name: `${emoji.get('mag')} Explorar Comunidad`, value: 'search' },
                { name: `${emoji.get('file_folder')} Purgar Mis Contenidos`, value: 'resources' },
                new inquirer.Separator(),
                { name: `${emoji.get('arrow_left')} Volver al Menú Central`, value: 'back' }
            ]
        }]);

        if (action === 'back') return;

        switch (action) {
            case 'view_me': await showMyFullProfile(); break;
            case 'friends': await listUserConnections('friends'); break;
            case 'followers': await listUserConnections('followers'); break;
            case 'following': await listUserConnections('following'); break;
            case 'edit_me': await editProfileDetails(); break;
            case 'search': await searchPeople(); break;
            case 'resources': await resourcesSubMenu(); break;
        }
    }
};

const showMyFullProfile = async () => {
    const spinner = ora('Accediendo a la base de datos central...').start();
    try {
        const res = await client.get('/user/details');
        const u = res.data.currentUser;
        spinner.stop();

        const birth = u.birthdate ? new Date(u.birthdate).toLocaleDateString() : 'N/A';

        console.log(boxen(
            `${chalk.bold.cyan('DATOS PERSONALES:')}\n` +
            ` Alias:  @${u.username}\n` +
            ` Nombre: ${u.name} ${u.lastName}\n` +
            ` Email:  ${u.email}\n` +
            ` Tel:    ${u.phone || 'No registrado'}\n` +
            ` Nacido: ${birth}\n` +
            ` Bio:    ${u.bio || 'Sin biografía'}\n\n` +
            `${chalk.bold.cyan('VÍNCULOS Y ESTADO:')}\n` +
            ` Compas:     ${res.data.friends?.length || 0}\n` +
            ` Seguidores: ${res.data.followers?.length || 0}\n` +
            ` Siguiendo:  ${res.data.following?.length || 0}\n` +
            ` Visibilidad: ${chalk.yellow(u.privacySettings?.profileVisibility || 'public')}`,
            { padding: 1, borderColor: 'magenta', borderStyle: 'round', title: ' EXPEDIENTE DE USUARIO ' }
        ));
        await waitKey();
    } catch (err) {
        spinner.fail('Fallo en la sincronización de datos.');
        handleApiError(err);
        await waitKey();
    }
};

const listUserConnections = async (type) => {
    const spinner = ora(`Escaneando tu red de ${type}...`).start();
    try {
        const res = await client.get('/user/details');
        const list = res.data[type] || [];
        spinner.stop();

        if (list.length === 0) {
            console.log(chalk.yellow(`\n No se detectan ${type} en tu red local.`));
            await waitKey();
            return;
        }

        const { selectedUser } = await inquirer.prompt([{
            type: 'list',
            name: 'selectedUser',
            message: `LISTA DE ${type.toUpperCase()}:`,
            choices: [
                ...list.map(u => ({ name: `@${u.username} (${u.name} ${u.lastName})`, value: u })),
                new inquirer.Separator(),
                { name: 'Regresar', value: 'back' }
            ]
        }]);

        if (selectedUser === 'back') return;
        await showFullUserProfile(selectedUser._id);
    } catch (err) {
        spinner.fail('Error al rastrear vínculos.');
        handleApiError(err);
        await waitKey();
    }
};

const editProfileDetails = async () => {
    const { editType } = await inquirer.prompt([{
        type: 'list',
        name: 'editType',
        message: 'SELECCIONA CATEGORÍA:',
        choices: [
            { name: '🔒 Cambiar Contraseña', value: 'password' },
            { name: '📧 Actualizar Email', value: 'email' },
            { name: '📝 Editar Biografía', value: 'bio' },
            { name: '🕵️ Configuración de Privacidad', value: 'privacy' },
            { name: 'Cancelar', value: 'back' }
        ]
    }]);

    if (editType === 'back') return;

    try {
        if (editType === 'bio') {
            const { bio } = await inquirer.prompt([{ type: 'input', name: 'bio', message: 'Escribe tu nueva bio:' }]);
            const user = conf.get('user');
            await client.put(`/user/bio/${user._id}`, { bio });
            console.log(chalk.green(' Biografía actualizada con éxito.'));
        } else if (editType === 'password') {
            const { current, newPass } = await inquirer.prompt([
                { type: 'password', name: 'current', message: 'Contraseña Actual:', mask: '*' },
                { type: 'password', name: 'newPass', message: 'Nueva Contraseña (mín 6 carac):', mask: '*' }
            ]);
            await client.put('/user/password', { currentPassword: current, newPassword: newPass });
            console.log(chalk.green(' Protocolos de seguridad renovados. Clave actualizada.'));
        } else if (editType === 'email') {
            const { newEmail } = await inquirer.prompt([{ type: 'input', name: 'newEmail', message: 'Nuevo Correo Electrónico:' }]);
            await client.put('/user/email', { newEmail });
            console.log(chalk.green(' Canal de comunicación actualizado. Revisa tu bandeja de entrada.'));
        } else if (editType === 'privacy') {
            const { visibility, msgs } = await inquirer.prompt([
                { type: 'list', name: 'visibility', message: 'Visibilidad del Perfil:', choices: ['public', 'friends', 'private'] },
                { type: 'list', name: 'msgs', message: '¿Quién puede enviarte mensajes?', choices: ['everyone', 'friends'] }
            ]);
            await client.put('/user/privacy', {
                privacySettings: { profileVisibility: visibility, messagePrivacy: msgs }
            });
            console.log(chalk.green(' Filtros de privacidad ajustados.'));
        }
        await waitKey();
    } catch (err) {
        console.log(chalk.red(' Error en la actualización de registros.'));
        handleApiError(err);
        await waitKey();
    }
};

const searchPeople = async () => {
    const { query } = await inquirer.prompt([{ type: 'input', name: 'query', message: 'Alias o nombre a rastrear:' }]);
    if (!query) return;

    const spinner = ora('Escanendo frecuencias de la red...').start();
    try {
        const res = await client.get(`/user/search?query=${query}`);
        const users = res.data.users;
        spinner.stop();

        if (users.length === 0) {
            console.log(chalk.red(' Sin resultados. No se detectan señales con ese criterio.'));
            await waitKey();
            return;
        }

        const { selectedUser } = await inquirer.prompt([{
            type: 'list',
            name: 'selectedUser',
            message: 'SUJETOS DETECTADOS:',
            choices: [
                ...users.map(u => ({ name: `@${u.username} (${u.name} ${u.lastName})`, value: u })),
                { name: 'Cancelar', value: 'cancel' }
            ]
        }]);

        if (selectedUser === 'cancel') return;
        await showFullUserProfile(selectedUser._id);
    } catch (err) {
        spinner.fail('Fallo en el rastreo satelital.');
        handleApiError(err);
        await waitKey();
    }
};

const showFullUserProfile = async (userId) => {
    const spinner = ora('Extrayendo expediente público...').start();
    try {
        const res = await client.get(`/user/profile/${userId}`);
        const u = res.data;
        spinner.stop();

        console.log(boxen(
            `${chalk.bold.cyan(`@${u.username}`)} (${u.name} ${u.lastName})\n` +
            `${chalk.gray('─────────────────────────────────────────')}\n` +
            `${chalk.bold('BIO:')} ${u.bio || 'Sin biografía'}\n` +
            `${chalk.bold('ESTADÍSTICAS:')} ${u.friends?.length || 0} Compas • ${u.followers?.length || 0} Seguidores\n` +
            `${chalk.bold('CONEXIÓN LOCAL:')} ${u.isFriend ? chalk.green('Amigo') : chalk.gray('Sujeto Externo')}`,
            { padding: 1, borderColor: 'cyan', borderStyle: 'double', title: ' INVESTIGACIÓN DE PERFIL ' }
        ));

        const { action } = await inquirer.prompt([{
            type: 'list',
            name: 'action',
            message: 'OPERACIONES DISPONIBLES:',
            choices: [
                { name: `${emoji.get('speech_balloon')} Entablar Comunicación (Chat)`, value: 'chat' },
                { name: 'Regresar', value: 'back' }
            ]
        }]);

        if (action === 'chat') {
            const chatSpinner = ora('Abriendo canal seguro...').start();
            const convRes = await client.post('/conversation/create', { participantIds: [u._id], isGroup: false });
            chatSpinner.stop();
            const { startChat } = require('./chat');
            await startChat(convRes.data.conversation || convRes.data);
        }
    } catch (err) {
        spinner.fail('Acceso denegado por los protocolos del usuario.');
        handleApiError(err);
        await waitKey();
    }
};

const resourcesSubMenu = async () => {
    while (true) {
        clear();
        showBanner();
        const { type } = await inquirer.prompt([{
            type: 'list',
            name: 'type',
            message: 'PROTOCOLO DE PURGA DE CONTENIDO:',
            choices: [
                { name: `${emoji.get('memo')} Mis Estados (Posts)`, value: 'posts' },
                { name: `${emoji.get('frame_with_picture')} Mis Fotos`, value: 'photos' },
                { name: `${emoji.get('clapper')} Mis Videos`, value: 'videos' },
                { name: `${emoji.get('broom')} LIMPIEZA TOTAL`, value: 'clean_all' },
                new inquirer.Separator(),
                { name: 'Regresar', value: 'back' }
            ]
        }]);

        if (type === 'back') return;
        if (type === 'clean_all') await performGlobalCleanup();
        else await manageSpecificResource(type);
    }
};

const manageSpecificResource = async (type) => {
    const spinner = ora(`Recuperando tus ${type}...`).start();
    try {
        let items = [];
        const user = conf.get('user');

        if (type === 'posts') {
            const res = await client.get('/posts/me/posts');
            items = res.data.map(i => ({ id: i._id, label: i.content?.substring(0, 40) || 'Sin contenido' }));
        } else if (type === 'photos') {
            const res = await client.get(`/gallery/user/${user._id}`);
            items = res.data.map(i => ({ id: i._id, label: `Imagen: ${i.imageUrl?.substring(0, 40)}...` }));
        } else if (type === 'videos') {
            const res = await client.get('/videos/user/videos');
            items = res.data.map(i => ({ id: i._id, publicId: i.publicId, label: i.title || 'Video sin título' }));
        }

        spinner.stop();
        if (items.length === 0) {
            console.log(chalk.yellow(`\n No se detectan ${type} de tu propiedad en la red.`));
            await waitKey();
            return;
        }

        const { selectedId } = await inquirer.prompt([{
            type: 'list',
            name: 'selectedId',
            message: 'SELECCIONA RECURSO PARA ELIMINAR:',
            choices: [...items.map(i => ({ name: `[ID: ${i.id}] ${i.label}`, value: i })), { name: 'Cancelar', value: 'cancel' }]
        }]);

        if (selectedId === 'cancel') return;
        const { confirm } = await inquirer.prompt([{ type: 'confirm', name: 'confirm', message: chalk.bgRed.white(' ¿Confirma eliminación permanente del registro? '), default: false }]);
        if (confirm) {
            await client.delete(type === 'posts' ? `/posts/${selectedId.id}` : type === 'photos' ? `/gallery/${selectedId.id}` : '/videos/delete', { data: { publicId: selectedId.publicId } });
            console.log(chalk.green(' Purgado completado con éxito.'));
            await waitKey();
        }
    } catch (error) {
        spinner.fail('Error en la purga del servidor.');
        handleApiError(error);
        await waitKey();
    }
};

const performGlobalCleanup = async () => {
    const { confirm } = await inquirer.prompt([{ type: 'confirm', name: 'confirm', message: chalk.bgRed.white(' ¡PROTOCOLO DE DESTRUCCIÓN TOTAL! ¿Estás ABSOLUTAMENTE seguro? '), default: false }]);
    if (!confirm) return;

    const spinner = ora('Ejecutando desintegración de datos...').start();
    try {
        const user = conf.get('user');
        const postsRes = await client.get('/posts/me/posts');
        for (const p of postsRes.data) await client.delete(`/posts/${p._id}`);
        const photosRes = await client.get(`/gallery/user/${user._id}`);
        for (const p of photosRes.data) await client.delete(`/gallery/${p._id}`);
        const videosRes = await client.get('/videos/user/videos');
        for (const v of videosRes.data) await client.delete('/videos/delete', { data: { publicId: v.publicId } });
        spinner.succeed('Perfil purgado. No quedan rastro de tus contenidos.');
    } catch (error) {
        spinner.fail('Fallo crítico en la limpieza.');
        handleApiError(error);
    }
    await waitKey();
};

const lookupAnyId = async () => {
    while (true) {
        clear();
        showBanner();
        const { idType } = await inquirer.prompt([{
            type: 'list',
            name: 'idType',
            message: 'PROTOCOLO DE INVESTIGACIÓN X-ID:',
            choices: [
                { name: 'Escaneo de Usuario', value: 'user' },
                { name: 'Escaneo de Post', value: 'post' },
                { name: 'Escaneo de Video', value: 'video' },
                { name: 'Escaneo de Foto', value: 'photo' },
                new inquirer.Separator(),
                { name: 'Regresar', value: 'back' }
            ]
        }]);
        if (idType === 'back') return;
        const { targetId } = await inquirer.prompt([{ type: 'input', name: 'targetId', message: 'ID del recurso a investigar:' }]);
        const spinner = ora('Escaneando registros satelitales...').start();
        try {
            let res;
            if (idType === 'user') res = await client.get(`/user/profile/${targetId}`);
            if (idType === 'post') res = await client.get(`/posts/${targetId}`);
            if (idType === 'video') res = await client.get(`/videos/${targetId}`);
            if (idType === 'photo') res = await client.get(`/gallery/${targetId}`);
            spinner.stop();
            console.log(boxen(JSON.stringify(res.data, null, 2).substring(0, 1000), { title: 'RECURSO IDENTIFICADO', padding: 1, borderColor: 'green', borderStyle: 'round' }));
        } catch (error) {
            spinner.fail('ID inválido o recurso inexistente.');
            handleApiError(error);
        }
        await waitKey();
    }
};

const handleApiError = (error) => {
    console.log(chalk.red(`\n Detalle del fallo: ${error.response?.data?.error || error.response?.data?.message || error.message}`));
};

module.exports = { manageProfile, lookupAnyId, showFullUserProfile };

const ora = require('ora');
const { client } = require('../api/client');
const { clear, showBanner, chalk, emoji, inquirer, waitKey, boxen } = require('../utils/ui');
const { exec } = require('child_process');

const listPosts = async (page = 1) => {
    while (true) {
        clear();
        showBanner();
        const spinner = ora({
            text: chalk.yellow(`Estableciendo conexión con el satélite... Sincronizando Muro (Página ${page})`),
            color: 'red'
        }).start();
        try {
            // Correct endpoint in backend is /posts/friends
            const response = await client.get(`/posts/friends?page=${page}&limit=20`);
            spinner.stop();

            const posts = response.data.posts || [];
            const hasMore = response.data.currentPage < response.data.totalPages;

            if (posts.length === 0) {
                console.log(chalk.yellow(` ${emoji.get('desert')} El muro está vacío por ahora.`));
            } else {
                const postChoices = posts.map(p => ({
                    name: `${chalk.bold.green(`@${p.user?.username || 'Anónimo'}`)}: ${p.content?.substring(0, 50)}... ${chalk.gray(`(${p.likes?.length || 0} ${emoji.get('heart')} • ${p.comments?.length || 0} ${emoji.get('speech_balloon')})`)}`,
                    value: p
                }));

                const navigationChoices = [];
                if (hasMore) navigationChoices.push({ name: chalk.bold.blue(`${emoji.get('fast_forward')} Cargar más posts (Página ${page + 1})`), value: 'load_more' });
                navigationChoices.push({ name: chalk.cyan('Nueva Publicación'), value: 'create' });
                navigationChoices.push({ name: chalk.red('Regresar al Menú'), value: 'back' });

                const { action } = await inquirer.prompt([{
                    type: 'list',
                    name: 'action',
                    message: 'Selecciona un post para interactuar o navega:',
                    choices: [...postChoices, new inquirer.Separator(), ...navigationChoices]
                }]);

                if (action === 'back') return;
                if (action === 'load_more') { page++; continue; }
                if (action === 'create') { await createNewPost(); continue; }

                // If a post was selected
                await interactWithPost(action);
                continue;
            }
        } catch (error) {
            spinner.fail('Error al descargar el muro.');
            await waitKey();
            return;
        }
    }
};

const interactWithPost = async (post) => {
    while (true) {
        clear();
        showBanner();

        let mediaInfo = '';
        if (post.media && post.media.length > 0) {
            mediaInfo = `\n\n ${chalk.bold.magenta(`${emoji.get('camera')} MULTIMEDIA DETECTADA (${post.media.length}):`)}` +
                post.media.map((m, i) => `\n   ${chalk.magenta(`└─ [${i + 1}] ${m.mediaType === 'image' ? '🖼️ Imagen' : '🎬 Video'}`)}`).join('');
        }

        console.log(boxen(
            chalk.bold.green(`@${post.user?.username || 'Anónimo'}`) + `  ${chalk.dim('•')}  ${chalk.gray(new Date(post.createdAt || Date.now()).toLocaleString())}\n` +
            chalk.gray(' ────────────────────────────────────────────────────────────\n') +
            chalk.white(post.content || '') + mediaInfo + `\n` +
            chalk.gray(' ────────────────────────────────────────────────────────────\n') +
            chalk.magenta(`${emoji.get('heart')} ${post.likes?.length || 0} Likes`) + `  ${chalk.blue(`${emoji.get('speech_balloon')} ${post.comments?.length || 0} Comentarios`)}`,
            { padding: 1, borderColor: 'magenta', borderStyle: 'double', title: chalk.magenta(' DETALLE DE SEÑAL '), titleAlignment: 'center' }
        ));

        const choices = [
            { name: `${emoji.get('heart')} Reaccionar (Like/Unlike)`, value: 'like' },
            { name: `${emoji.get('speech_balloon')} Añadir Comentario`, value: 'comment' },
            { name: `${emoji.get('eye')} Leer Conversación`, value: 'view_comments' }
        ];

        if (post.media && post.media.length > 0) {
            choices.push({ name: chalk.bold.magenta(`${emoji.get('rocket')} LANZAR MULTIMEDIA EN SISTEMA`), value: 'open_media' });
        }

        choices.push({ name: 'Regresar al Muro', value: 'back' });

        const { action } = await inquirer.prompt([{
            type: 'list',
            name: 'action',
            message: 'CONTROL DE PUBLICACIÓN:',
            choices: choices
        }]);

        if (action === 'back') return;

        try {
            if (action === 'like') {
                const res = await client.post(`/posts/${post._id}/like`);
                post.likes = res.data.likes;
                console.log(chalk.green(' ¡Reacción actualizada!'));
                await new Promise(r => setTimeout(r, 800));
            } else if (action === 'comment') {
                const { comment } = await inquirer.prompt([{ type: 'input', name: 'comment', message: 'Escribe tu comentario:' }]);
                if (comment.trim()) {
                    const res = await client.post(`/posts/${post._id}/comment`, { comment });
                    post.comments = res.data.comments;
                    console.log(chalk.green(' Comentario enviado.'));
                    await waitKey();
                }
            } else if (action === 'view_comments') {
                if (!post.comments || post.comments.length === 0) {
                    console.log(chalk.yellow('\n No hay comentarios aún.'));
                } else {
                    console.log(chalk.bold('\n --- COMENTARIOS ---'));
                    post.comments.forEach(c => {
                        console.log(`${chalk.green(`@${c.user?.username || 'miembro'}`)}: ${c.comment}`);
                    });
                }
                await waitKey();
            } else if (action === 'open_media') {
                let mediaToOpen = post.media[0];

                if (post.media.length > 1) {
                    const { selectedMedia } = await inquirer.prompt([{
                        type: 'list',
                        name: 'selectedMedia',
                        message: 'Selecciona el archivo que deseas abrir:',
                        choices: post.media.map((m, i) => ({
                            name: `${emoji.get('file_folder')} Archivo #${i + 1} (${m.mediaType || 'media'})`,
                            value: m
                        }))
                    }]);
                    mediaToOpen = selectedMedia;
                }

                const url = mediaToOpen.url;
                const command = process.platform === 'win32' ? 'start' : process.platform === 'darwin' ? 'open' : 'xdg-open';
                exec(`${command} ${url}`);
                console.log(chalk.cyan(`\n ${emoji.get('rocket')} Lanzando archivo: ${url}`));
                await new Promise(r => setTimeout(r, 1000));
            }
        } catch (err) {
            console.log(chalk.red(`\n Error: ${err.response?.data?.message || err.message}`));
            await waitKey();
        }
    }
};

const createNewPost = async () => {
    clear();
    showBanner();
    console.log(chalk.yellow(` ${emoji.get('pencil2')} ESCRIBIR PENSAMIENTO\n`));

    const { content } = await inquirer.prompt([{
        type: 'input',
        name: 'content',
        message: '¿Qué quieres decir?:'
    }]);

    if (!content.trim()) return;

    const spinner = ora('Transmitiendo señal...').start();
    try {
        await client.post('/posts', { content });
        spinner.succeed('Publicación lanzada al satélite.');
    } catch (error) {
        spinner.fail('Error al publicar.');
    }
    await waitKey();
};

module.exports = { listPosts, createNewPost };

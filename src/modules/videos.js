const ora = require('ora');
const { client } = require('../api/client');
const { clear, showBanner, chalk, emoji, inquirer, waitKey, boxen } = require('../utils/ui');
const { exec } = require('child_process');

const listVideos = async () => {
    while (true) {
        clear();
        showBanner();
        const spinner = ora({
            text: chalk.magenta(` ${emoji.get('movie_camera')} Sincronizando Feed de Clips (Jandosoft Reels)...`),
            color: 'magenta'
        }).start();

        try {
            const response = await client.get('/videos/feed');
            spinner.stop();

            const videos = response.data || [];

            if (videos.length === 0) {
                console.log(chalk.yellow(` ${emoji.get('ghost')} No hay clips en la señal ahora mismo.`));
                await waitKey();
                return;
            }

            const videoChoices = videos.map(v => ({
                name: `${chalk.bold.magenta(`[CLIP]`)} ${chalk.white(v.title || v.description || 'Sin título')} ${chalk.gray(`(@${v.user?.username || 'anónimo'})`)} ${chalk.dim(`[${v.reactions?.length || 0} ❤️]`)}`,
                value: v
            }));

            const navigationChoices = [
                { name: chalk.red('Regresar al Menú Principal'), value: 'back' }
            ];

            const { action } = await inquirer.prompt([{
                type: 'list',
                name: 'action',
                message: 'SELECCIONA UN CLIP PARA REPRODUCIR:',
                choices: [...videoChoices, new inquirer.Separator(), ...navigationChoices],
                pageSize: 15
            }]);

            if (action === 'back') return;

            // If a video was selected
            await playVideo(action, videos);
            continue;
        } catch (error) {
            spinner.fail('Fallo al captar la señal de video.');
            console.error(chalk.red(error.message));
            await waitKey();
            return;
        }
    }
};

const playVideo = async (video, allVideos) => {
    while (true) {
        clear();
        showBanner();

        console.log(boxen(
            chalk.bold.magenta(`${emoji.get('clapper')} REPRODUCIENDO: `) + chalk.white(video.title || 'Clip de Jandosoft') + `\n\n` +
            chalk.gray(`Subido por: `) + chalk.bold.green(`@${video.user?.username}`) + `\n` +
            chalk.white(video.description || '') + `\n\n` +
            chalk.magenta(`${emoji.get('heart')} ${video.reactions?.length || 0} Reacciones  ${emoji.get('speech_balloon')} ${video.comments?.length || 0} Comentarios`),
            { padding: 1, borderColor: 'magenta', borderStyle: 'double' }
        ));

        const choices = [
            { name: `${emoji.get('arrow_forward')} REPRODUCIR EN SISTEMA (Full HD)`, value: 'play' },
            { name: `${emoji.get('heart')} Reaccionar (Like)`, value: 'like' },
            { name: `${emoji.get('speech_balloon')} Ver Comentarios`, value: 'comments' },
            { name: 'Siguiente Clip ⏭️', value: 'next' },
            { name: 'Clip Anterior ⏮️', value: 'prev' },
            { name: 'Regresar al Feed', value: 'back' }
        ];

        const { action } = await inquirer.prompt([{
            type: 'list',
            name: 'action',
            message: 'CONTROL DE REPRODUCCIÓN:',
            choices: choices
        }]);

        if (action === 'back') return;

        try {
            if (action === 'play') {
                const command = process.platform === 'win32' ? 'start' : process.platform === 'darwin' ? 'open' : 'xdg-open';
                exec(`${command} ${video.videoUrl}`);
                console.log(chalk.magenta(`\n ${emoji.get('rocket')} Transmitiendo a reproductor externo...`));
                await new Promise(r => setTimeout(r, 1200));
            } else if (action === 'like') {
                await client.post(`/videos/${video._id}/react`, { type: 'like' });
                console.log(chalk.green(' ¡Reacción enviada!'));
                // Actualizar localmente para no re-descargar
                if (!video.reactions) video.reactions = [];
                video.reactions.push({ user: 'me' });
                await new Promise(r => setTimeout(r, 800));
            } else if (action === 'comments') {
                if (!video.comments || video.comments.length === 0) {
                    console.log(chalk.yellow('\n El clip no tiene comentarios aún.'));
                } else {
                    console.log(chalk.bold.magenta('\n --- COMENTARIOS ---'));
                    video.comments.forEach(c => {
                        console.log(`${chalk.green(`@${c.user?.username || 'miembro'}`)}: ${c.comment}`);
                    });
                }
                await waitKey();
            } else if (action === 'next' || action === 'prev') {
                const currentIndex = allVideos.findIndex(v => v._id === video._id);
                let nextIndex = action === 'next' ? currentIndex + 1 : currentIndex - 1;

                if (nextIndex >= allVideos.length) nextIndex = 0;
                if (nextIndex < 0) nextIndex = allVideos.length - 1;

                video = allVideos[nextIndex];
            }
        } catch (err) {
            console.log(chalk.red(`\n Error en la señal: ${err.message}`));
            await waitKey();
        }
    }
};

module.exports = { listVideos };

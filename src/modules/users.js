const ora = require('ora');
const { client } = require('../api/client');
const { clear, showBanner, chalk, emoji, inquirer, waitKey, boxen } = require('../utils/ui');

const searchAndManageUsers = async (page = 1) => {
    while (true) {
        clear();
        showBanner();
        console.log(chalk.yellow(` ${emoji.get('mag')} BÚSQUEDA DE COMUNIDAD (Página ${page})`));

        const { query } = await inquirer.prompt([{
            type: 'input',
            name: 'query',
            message: 'Busca por nombre o username (Escribe /back para regresar):'
        }]);

        if (query === '/back') return null;

        const spinner = ora('Escaneando base de datos...').start();
        try {
            const endpoint = query ? `/user/search?query=${query}&page=${page}&limit=10` : `/user/users?page=${page}&limit=10`;
            const response = await client.get(endpoint);

            let users = [];
            if (response.data && response.data.users && Array.isArray(response.data.users)) {
                users = response.data.users;
            } else if (Array.isArray(response.data)) {
                users = response.data;
            }

            spinner.stop();

            if (users.length === 0) {
                console.log(chalk.red('\n No se encontraron usuarios con ese criterio.'));
            } else {
                const choices = users.map(u => ({
                    name: `${u.name} ${u.lastName} (@${u.username})`,
                    value: u
                }));

                choices.push(new inquirer.Separator());
                if (response.data.totalPages > page) {
                    choices.push({ name: chalk.bold.blue(`${emoji.get('fast_forward')} Cargar más resultados (Página ${page + 1})`), value: 'load_more' });
                }
                choices.push({ name: chalk.yellow('Nueva búsqueda / Reset'), value: 'retry' });
                choices.push({ name: chalk.red('Regresar al Menú'), value: 'back' });

                const { selected } = await inquirer.prompt([{
                    type: 'list',
                    name: 'selected',
                    message: `Se encontraron ${response.data.totalUsers || users.length} usuarios. Selecciona uno:`,
                    choices: choices
                }]);

                if (selected === 'back') return null;
                if (selected === 'retry') { page = 1; continue; }
                if (selected === 'load_more') { page++; continue; }

                const { showFullUserProfile } = require('./profile');
                const result = await showFullUserProfile(selected._id);
                if (result) return result;
            }
        } catch (error) {
            spinner.fail('Error en la búsqueda.');
            console.log(chalk.red(` Detalle: ${error.response?.data?.message || error.message}`));
        }
        await waitKey();
    }
};


module.exports = { searchAndManageUsers };

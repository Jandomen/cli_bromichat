const ora = require('ora');
const { client, conf } = require('../api/client');
const { clear, showBanner, chalk, emoji, inquirer } = require('../utils/ui');

const initialMenu = async () => {
    while (true) {
        clear();
        showBanner();
        console.log(chalk.bold.cyan(` ${emoji.get('satellite')} PUERTA DE ENLACE JANDOSOFT`));
        console.log(chalk.gray(' ────────────────────────────────────────────────────────────\n'));

        const { action } = await inquirer.prompt([{
            type: 'list',
            name: 'action',
            message: 'PROTOCOLO DE ACCESO:',
            choices: [
                { name: `${emoji.get('key')} Ingresar al Sistema`, value: 'login' },
                { name: `${emoji.get('pencil')} Registrarme`, value: 'register' },
                { name: `${emoji.get('email')} Recuperar Acceso`, value: 'forgot' },
                new inquirer.Separator(),
                { name: `${emoji.get('x')} Salir`, value: 'exit' }
            ]
        }]);

        if (action === 'exit') process.exit(0);

        let success = false;
        if (action === 'login') success = await login();
        else if (action === 'register') success = await register();
        else if (action === 'forgot') await forgotPassword();

        if (success) return true;
    }
};

const login = async () => {
    clear();
    showBanner();
    console.log(chalk.yellow(` ${emoji.get('lock')} INGRESO AL SISTEMA`));

    const questions = [
        {
            type: 'input',
            name: 'email',
            message: 'Email (o "back" para regresar):',
            validate: (input) => input.length > 0 || 'Email requerido',
        },
        {
            type: 'password',
            name: 'password',
            message: 'Password:',
            mask: '*',
            when: (answers) => answers.email.toLowerCase() !== 'back'
        },
    ];

    const answers = await inquirer.prompt(questions);
    if (answers.email.toLowerCase() === 'back') return false;

    const spinner = ora('Validando con el servidor...').start();
    try {
        const response = await client.post('/auth/login', answers);
        spinner.succeed('Acceso Concedido.');
        conf.set('token', response.data.token);
        conf.set('user', response.data.user);
        return true;
    } catch (error) {
        spinner.fail('Error: ' + (error.response?.data?.message || error.response?.data?.error || error.message));
        const { next } = await inquirer.prompt([{
            type: 'list',
            name: 'next',
            message: '¿Qué deseas hacer?',
            choices: [
                { name: 'Intentar de nuevo', value: 'retry' },
                { name: 'No tengo cuenta, registrarme', value: 'register' },
                { name: '@ Regresar al menú', value: 'back' }
            ]
        }]);

        if (next === 'retry') return await login();
        if (next === 'register') return await register();
        return false;
    }
};

const register = async () => {
    clear();
    showBanner();
    console.log(chalk.bold.green(` ${emoji.get('pencil')} PROTOCOLO DE REGISTRO`));
    console.log(chalk.gray(' Escribe "back" en el usuario para cancelar\n'));

    const questions = [
        { type: 'input', name: 'username', message: 'Nombre de Usuario:' },
        { type: 'input', name: 'name', message: 'Nombre:', when: (a) => a.username.toLowerCase() !== 'back' },
        { type: 'input', name: 'lastName', message: 'Apellidos:', when: (a) => a.username.toLowerCase() !== 'back' },
        { type: 'input', name: 'email', message: 'Email:', when: (a) => a.username.toLowerCase() !== 'back' },
        { type: 'password', name: 'password', message: 'Contraseña (mín 8 carac):', mask: '*', when: (a) => a.username.toLowerCase() !== 'back' },
        { type: 'input', name: 'phone', message: 'Teléfono:', when: (a) => a.username.toLowerCase() !== 'back' },
        { type: 'input', name: 'birthdate', message: 'Fecha Nac (YYYY-MM-DD):', when: (a) => a.username.toLowerCase() !== 'back' },
    ];

    const answers = await inquirer.prompt(questions);
    if (answers.username.toLowerCase() === 'back') return false;

    const spinner = ora('Tramitando solicitud de ingreso...').start();
    try {
        await client.post('/auth/register', answers);
        spinner.succeed('¡Registro exitoso! Ahora ingresa con tus credenciales.');
        await new Promise(r => setTimeout(r, 1500));
        return await login();
    } catch (error) {
        spinner.fail('Fallo en el registro: ' + (error.response?.data?.error || error.message));
        const { next } = await inquirer.prompt([{
            type: 'list',
            name: 'next',
            message: '¿Qué deseas hacer?',
            choices: [
                { name: 'Intentar de nuevo', value: 'retry' },
                { name: 'Ya tengo cuenta, ingresar', value: 'login' },
                { name: '@ Regresar al menú', value: 'back' }
            ]
        }]);
        if (next === 'retry') return await register();
        if (next === 'login') return await login();
        return false;
    }
};

const forgotPassword = async () => {
    clear();
    showBanner();
    console.log(chalk.cyan(` ${emoji.get('email')} RECUPERACIÓN DE ACCESO`));
    console.log(chalk.gray(' ────────────────────────────────────────────────────────────\n'));

    console.log(chalk.yellow(` ${emoji.get('construction')} PRÓXIMAMENTE...`));
    console.log(chalk.white(' Este servicio estará disponible en la próxima actualización del satélite.\n'));

    const { back } = await inquirer.prompt([{ type: 'list', name: 'back', message: 'Regresar:', choices: [{ name: 'Volver a la puerta de enlace', value: true }] }]);
    return false;
};

const adminLogin = async () => {
    clear();
    showBanner();
    console.log(chalk.bold.red(` ${emoji.get('warning')} ACCESO RESTRINGIDO - MODO MAESTRO`));
    console.log(chalk.red(' ────────────────────────────────────────────────────────────\n'));

    const { email, password } = await inquirer.prompt([
        { type: 'input', name: 'email', message: 'Email de Administrador:' },
        { type: 'password', name: 'password', message: 'Clave de Seguridad:', mask: 'X' }
    ]);

    const spinner = ora('Verificando privilegios de root...').start();
    try {
        const response = await client.post('/auth/login', { email, password });
        if (response.data.user.role !== 'admin') {
            spinner.fail('ACCESO DENEGADO: Tu cuenta no tiene privilegios de administración.');
            return false;
        }
        spinner.succeed('PRIVILEGIOS CONFIRMADOS. Bienvenido al núcleo, Master.');
        conf.set('token', response.data.token);
        conf.set('user', response.data.user);
        await new Promise(r => setTimeout(r, 1000));
        return true;
    } catch (error) {
        spinner.fail('Fallo en la autenticación maestra.');
        return false;
    }
};

const logout = () => {
    conf.clear();
    console.log(chalk.yellow('Conexión terminada.'));
};

module.exports = { initialMenu, login, adminLogin, logout };

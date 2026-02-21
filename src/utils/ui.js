const chalk = require('chalk');
const figlet = require('figlet');
const boxen = require('boxen');
const emoji = require('node-emoji');
const inquirer = require('inquirer');

const showBanner = () => {
    try {
        const bannerText = figlet.textSync('BROMICHAT', {
            font: 'Big',
            horizontalLayout: 'default',
            verticalLayout: 'default',
            width: 80,
            whitespaceBreak: true
        });
        console.log(chalk.bold.red(bannerText));
    } catch (e) {
        console.log(chalk.bold.red('\n  === BROMICHAT ===\n'));
    }

    const subHeader = boxen(
        chalk.bold.white(` ${emoji.get('zap')}  SISTEMA DE ADMINISTRACIÓN TERMINAL v2.1  ${emoji.get('zap')} `) + '\n' +
        chalk.gray(` [ Servidor: Connected • Protocol: Encrypted • Status: Ready ]`),
        {
            padding: 1,
            margin: { bottom: 1 },
            borderStyle: 'doubleSingle',
            borderColor: 'red',
            textAlignment: 'center'
        }
    );
    console.log(subHeader);
};

const clear = () => {
    process.stdout.write(process.platform === 'win32' ? '\x1B[2J\x1B[0f' : '\x1B[2J\x1B[3J\x1B[H');
};

const showFooter = () => {
    console.log('\n' + chalk.gray(' ────────────────────────────────────────────────────────────'));
    console.log(chalk.bold.red('   JANDOSOFT') + chalk.dim(' © 2026 • ') + chalk.italic.red('Connecting the Unconnected'));
    console.log(chalk.gray(' ────────────────────────────────────────────────────────────'));
};

const waitKey = async (message = '[ Presiona ENTER para continuar ]') => {
    console.log(chalk.gray(`\n${message}`));
    await inquirer.prompt([{ type: 'input', name: 'wait', message: '', prefix: '' }]);
};

module.exports = {
    showBanner,
    showFooter,
    clear,
    waitKey,
    chalk,
    emoji,
    boxen,
    inquirer
};

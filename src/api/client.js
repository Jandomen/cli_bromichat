const axios = require('axios');
const Configstore = require('configstore');
const { API_URL, CONFIG_NAME } = require('../utils/constants');

const conf = new Configstore(CONFIG_NAME);

const client = axios.create({
    baseURL: API_URL,
});

client.interceptors.request.use((config) => {
    const token = conf.get('token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

module.exports = {
    client,
    conf
};

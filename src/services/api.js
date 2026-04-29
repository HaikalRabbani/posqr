import axios from 'axios';

const api = axios.create({
    baseURL: 'https://api.etres.my.id/api/v1', 
    headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
    }
});

export default api;
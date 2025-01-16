import axios from 'axios';

export const reverseGeocodeApi = axios.create({
  baseURL: 'https://nominatim.openstreetmap.org',
  timeout: 10000,
});

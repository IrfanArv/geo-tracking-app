import {reverseGeocodeApi} from './axios';

export const fetchAddress = async (latitude: number, longitude: number) => {
  try {
    const response = await reverseGeocodeApi.get('/reverse', {
      params: {format: 'jsonv2', lat: latitude, lon: longitude},
    });

    const address = response.data.address;
    // return `${address.village || address.municipality || address.county}, ${
    //   address.municipality || address.county || address.state
    // }`;
    return JSON.stringify(address);
  } catch (error) {
    console.error('Error fetching address:', error);
    throw error;
  }
};

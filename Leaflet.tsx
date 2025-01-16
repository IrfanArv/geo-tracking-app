/* eslint-disable @typescript-eslint/no-unused-vars */
import React, {useEffect, useState, useRef} from 'react';
import {
  View,
  Text,
  Button,
  PermissionsAndroid,
  Platform,
  Alert,
  StyleSheet,
} from 'react-native';
import Geolocation from 'react-native-geolocation-service';
import {fetchAddress} from './reverseGeocodeApi';
import {LeafletView} from 'react-native-leaflet-view';

interface Location {
  latitude: number;
  longitude: number;
}
export const getLocationDetails = async (
  setLocation: (location: string) => void,
): Promise<{latitude: number; longitude: number} | null> => {
  try {
    // Ensure runtime permissions are handled
    const hasPermission = await requestLocationPermission();
    if (!hasPermission) {
      setLocation('Permission denied');
      return null;
    }

    return new Promise(resolve => {
      Geolocation.getCurrentPosition(
        position => {
          const {latitude, longitude} = position.coords;
          resolve({latitude, longitude});
        },
        error => {
          console.error('Error fetching location:', error);

          // Provide descriptive error messages
          let message = 'Failed to get location.';
          switch (error.code) {
            case 1:
              message = 'Permission denied.';
              break;
            case 2:
              message = 'Location unavailable.';
              break;
            case 3:
              message = 'Location request timed out.';
              break;
            default:
              message = 'An unknown error occurred.';
          }

          setLocation(message);
          resolve(null); // Resolve null to prevent crashing
        },
        {enableHighAccuracy: true, timeout: 15000, maximumAge: 10000},
      );
    });
  } catch (error) {
    console.error('Error in getLocationDetails:', error);
    setLocation('An unexpected error occurred.');
    return null;
  }
};

const requestLocationPermission = async (): Promise<boolean> => {
  if (Platform.OS === 'android') {
    const granted = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
      {
        title: 'Location Access Required',
        message: 'This app needs to access your location.',
        buttonPositive: 'Allow',
      },
    );
    return granted === PermissionsAndroid.RESULTS.GRANTED;
  }
  return true; // iOS permissions handled differently
};

const RealTimeMap = (): React.JSX.Element => {
  const [location, setLocation] = useState<Location | null>(null);
  const [address, setAddress] = useState<string>('');
  const [tracking, setTracking] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);

  const watchId = useRef<number | null>(null);

  const startTracking = async () => {
    try {
      const hasPermission = await requestLocationPermission();
      if (!hasPermission) {
        Alert.alert('Permission Denied', 'Izin mengkases lokasi dibutuhkan.');
        return;
      }

      setTracking(true);

      watchId.current = Geolocation.watchPosition(
        async position => {
          try {
            if (!position || !position.coords) {
              console.error('Invalid position data');
              return;
            }
            const {latitude, longitude} = position.coords;
            setLocation({latitude, longitude});
            const fetchedAddress = await fetchAddress(latitude, longitude);
            setAddress(fetchedAddress);
          } catch (innerError) {
            console.error('Error processing position data:', innerError);
          }
        },
        error => {
          console.error('Location Tracking Error:', error);
          Alert.alert('Error', `Gabisa track lokasi: ${error.message}`);
        },
        {
          enableHighAccuracy: true,
          distanceFilter: 1, // Update location every 10 meters
        },
      );
    } catch (error) {
      console.error('Error in startTracking:', error);
    }
  };

  const stopTracking = () => {
    if (watchId.current !== null) {
      Geolocation.clearWatch(watchId.current);
      watchId.current = null;
    }
    setTracking(false);
    setLocation(null);
    setAddress('');
  };

  useEffect(() => {
    return () => {
      if (watchId.current !== null) {
        Geolocation.clearWatch(watchId.current);
      }
    };
  }, []);

  return (
    <View style={styles.container}>
      {location ? (
        <LeafletView
          mapCenterPosition={{
            lat: location.latitude,
            lng: location.longitude,
          }}
          zoom={20}
          mapMarkers={[
            {
              position: {
                lat: location.latitude,
                lng: location.longitude,
              }, // Marker at the current location
              icon: '📍', // You can also use custom icons
              size: [32, 32], // Optional: Adjust the size of the icon
            },
          ]}
          onMessageReceived={message => {
            // console.log('Map Event:', message);
          }}
        />
      ) : (
        <Text style={styles.infoText}>Tekan "Mulai Tracking"</Text>
      )}
      <View style={styles.controls}>
        <Button
          title={tracking ? 'Berhenti Tracking' : 'Mulai Tracking'}
          onPress={tracking ? stopTracking : startTracking}
          color={tracking ? 'red' : 'green'}
        />
        {location && (
          <>
            <Text style={styles.addressText}>
              Alamat:
              {address
                ? address
                : 'Mendapatkan Alamat dari reverse geocode open street maps...'}
            </Text>
            <Text style={styles.addressText}>Lat: {location.latitude}</Text>
            <Text style={styles.addressText}>Long: {location.longitude}</Text>
          </>
        )}
      </View>
    </View>
  );
};

export default RealTimeMap;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  map: {
    flex: 1,
  },
  controls: {
    padding: 10,
    backgroundColor: 'white',
    borderTopWidth: 1,
    borderTopColor: '#ccc',
  },
  infoText: {
    flex: 1,
    textAlign: 'center',
    textAlignVertical: 'center',
    fontSize: 16,
  },
  addressText: {
    marginTop: 10,
    fontSize: 14,
    color: 'gray',
  },
});

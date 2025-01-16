import React, {useEffect, useState, useRef} from 'react';
import {
  View,
  Text,
  Button,
  PermissionsAndroid,
  Platform,
  Alert,
  StyleSheet,
  FlatList,
} from 'react-native';
import Geolocation from 'react-native-geolocation-service';
import DeviceInfo from 'react-native-device-info';
import {fetchAddress} from './reverseGeocodeApi';

interface Location {
  latitude: number;
  longitude: number;
  timestamp?: string;
  reverseData: string;
}

const RealTimeMap = (): React.JSX.Element => {
  const [tracking, setTracking] = useState<boolean>(false);
  const [locations, setLocations] = useState<Location[]>([]);
  const ws = useRef<WebSocket | null>(null);
  const watchId = useRef<number | null>(null);

  const getDeviceData = async () => {
    const deviceId = await DeviceInfo.getUniqueId();
    const deviceName = await DeviceInfo.getDeviceName();
    const os = `${DeviceInfo.getSystemName()} ${DeviceInfo.getSystemVersion()}`;

    return {deviceId, deviceName, os};
  };

  useEffect(() => {
    // Initialize WebSocket
    ws.current = new WebSocket('ws://103.153.60.118:3002');

    ws.current.onopen = () => {
      console.log('WebSocket connected');
    };

    ws.current.onclose = () => {
      console.log('WebSocket disconnected');
    };

    ws.current.onerror = error => {
      console.error('WebSocket error:', error);
    };

    return () => {
      if (ws.current) {
        ws.current.close();
      }
    };
  }, []);

  const startTracking = async () => {
    try {
      const hasPermission = await requestLocationPermission();
      if (!hasPermission) {
        Alert.alert('Permission Denied', 'Location access is required.');
        return;
      }

      setTracking(true);

      // Send START event with the first location
      const deviceData = await getDeviceData();
      Geolocation.getCurrentPosition(
        async position => {
          const {latitude, longitude} = position.coords;

          // Fetch reverse geocode data
          const reverseData = await fetchAddress(latitude, longitude);

          sendLocationEvent('START', deviceData, {
            latitude,
            longitude,
            reverseData,
          });
        },
        error => {
          console.error('Error fetching initial location:', error);
          sendLocationEvent('START', deviceData, {
            latitude: 0,
            longitude: 0,
            reverseData: 'Unknown',
          });
        },
        {enableHighAccuracy: true},
      );

      // Watch position changes
      watchId.current = Geolocation.watchPosition(
        async position => {
          try {
            if (!position || !position.coords) {
              console.error('Invalid position data');
              return;
            }

            const {latitude, longitude} = position.coords;
            const reverseData = await fetchAddress(latitude, longitude);

            // Add to local state for FlatList
            setLocations(prevLocations => [
              ...prevLocations,
              {latitude, longitude, reverseData},
            ]);

            // Send ONGOING event with location updates
            sendLocationEvent('ONGOING', deviceData, {
              latitude,
              longitude,
              reverseData,
            });
          } catch (error) {
            console.error('Error processing position data:', error);
          }
        },
        error => {
          console.error('Location Tracking Error:', error);
          Alert.alert('Error', `Unable to track location: ${error.message}`);
        },
        {
          enableHighAccuracy: true,
          distanceFilter: 20, // Update location every 100 meters
        },
      );
    } catch (error) {
      console.error('Error in startTracking:', error);
    }
  };

  const stopTracking = async () => {
    try {
      if (!tracking) {
        console.log('Tracking is not active.');
        return;
      }

      // Clear the location watcher if it exists
      if (watchId.current !== null) {
        Geolocation.clearWatch(watchId.current);
        watchId.current = null;
      }

      // Stop the tracking state
      setTracking(false);

      // Retrieve the last known location
      const lastLocation =
        locations.length > 0
          ? locations[locations.length - 1]
          : {latitude: 0, longitude: 0, reverseData: 'Unknown'};

      if (!lastLocation.reverseData || lastLocation.reverseData === 'Unknown') {
        lastLocation.reverseData = await fetchAddress(
          lastLocation.latitude,
          lastLocation.longitude,
        );
      }

      // Fetch device data
      const deviceData = await getDeviceData();

      // Send the FINISH event with the last known location
      sendLocationEvent('FINISH', deviceData, lastLocation);

      console.log('Tracking stopped. Last location sent:', lastLocation);
    } catch (error) {
      console.error('Error stopping tracking:', error);
    }
  };

  const sendLocationEvent = (
    eventType: 'START' | 'ONGOING' | 'FINISH',
    deviceData: any,
    location: Location | null,
  ) => {
    const payload = {
      event: 'locationUpdate',
      data: {
        ...deviceData,
        eventType,
        latitude: location?.latitude || null,
        longitude: location?.longitude || null,
        reverseData: location?.reverseData || 'Unknown',
      },
    };

    console.log('Sending payload:', payload);

    if (ws.current && ws.current.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify(payload));
    } else {
      console.log('WebSocket is not open.');
    }
  };

  const formatAddress = (reverseData: any) => {
    try {
      const address = JSON.parse(reverseData);
      return `${address.village || address.municipality || address.county}, ${
        address.municipality || address.county || address.state
      }`;
    } catch (error) {
      console.error('Error formatting address:', error);
      return 'Unknown Address';
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.infoText}>Real-Time Location</Text>

      <FlatList
        data={locations}
        keyExtractor={(item, index) => index.toString()}
        renderItem={({item}) => (
          <View style={styles.listItem}>
            <Text style={styles.listText}>
              Latitude: {item.latitude}, Longitude: {item.longitude}
            </Text>
            <Text style={styles.listTimestamp}>
              Address: {formatAddress(item.reverseData)}
            </Text>
          </View>
        )}
        contentContainerStyle={styles.listContainer}
      />

      <View style={styles.controls}>
        <Button
          title={tracking ? 'Stop Tracking' : 'Start Tracking'}
          onPress={tracking ? stopTracking : startTracking}
          color={tracking ? 'red' : 'green'}
        />
      </View>
    </View>
  );
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
  return true;
};

export default RealTimeMap;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  controls: {
    padding: 10,
    backgroundColor: 'white',
    borderTopWidth: 1,
    borderTopColor: '#ccc',
  },
  infoText: {
    fontSize: 16,
    margin: 10,
    textAlign: 'center',
  },
  listContainer: {
    paddingHorizontal: 10,
  },
  listItem: {
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#ccc',
  },
  listText: {
    fontSize: 14,
  },
  listTimestamp: {
    fontSize: 12,
    color: 'gray',
  },
});

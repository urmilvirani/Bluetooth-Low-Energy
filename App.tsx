import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, Button, StyleSheet, Alert, Image } from 'react-native';
import BleManager from 'react-native-ble-manager';
import { NativeEventEmitter, NativeModules } from 'react-native';
import { Buffer } from 'buffer';
import { launchImageLibrary } from 'react-native-image-picker';

const BleManagerModule = NativeModules.BleManager;
const BleManagerEmitter = new NativeEventEmitter(BleManagerModule);

const BleDeviceList = () => {
  const [devices, setDevices] = useState([]);
  const [connectedDeviceId, setConnectedDeviceId] = useState<string | null>(null);
  const [imageUri, setImageUri] = useState(null);
  const [base64Image, setBase64Image] = useState<any>(null);

  // Start BLE Manager on component mount
  useEffect(() => {
    BleManager.start({ showAlert: false })
      .then(() => console.log('BLE Manager started'))
      .catch((error) => console.error('Error starting BLE Manager:', error));

    // Clean up when component unmounts
    return () => {
      BleManager.stopScan();
    };
  }, []);

  const handleDiscoverPeripheral = (peripheral: any) => {
    if (peripheral.name) {
      setDevices((prevDevices: any) => {
        const exists = prevDevices.some((device: any) => device.id === peripheral.id);
        return exists ? prevDevices : [...prevDevices, peripheral];
      });
    }
  };

  // Start scanning for BLE devices
  const startScan = () => {
    BleManager.scan([], 5, true)
      .then(() => console.log('Scanning started...'))
      .catch((error) => console.error('Error starting scan:', error));
  };

  // Connect to selected BLE device
  const connectToDevice = async (id: string) => {
    try {
      await BleManager.connect(id);
      console.log(`Connected to device: ${id}`);
      setConnectedDeviceId(id);
    } catch (error) {
      console.error('Error connecting to device:', error);
      Alert.alert('Connection Error', `Could not connect to device: ${id}`);
    }
  };

  // Disconnect from the connected BLE device
  const disconnectDevice = async () => {
    if (!connectedDeviceId) {
      console.warn('No device is connected.');
      return;
    }
    try {
      await BleManager.disconnect(connectedDeviceId);
      console.log(`Disconnected from device: ${connectedDeviceId}`);
      setConnectedDeviceId(null);
    } catch (error) {
      console.error('Error disconnecting device:', error);
      Alert.alert('Disconnection Error', `Could not disconnect from device.`);
    }
  };

  // Read data from a BLE device
  const readData = async (id: string) => {
    try {
      const data = await BleManager.read(id, '0180', 'fef4');
      console.log('Data read:', data);
      const text = Buffer.from(data).toString('utf-8');
      console.log('Received text:', text);
    } catch (error) {
      console.error('Error reading data:', error);
    }
  };

  // Write data to a BLE device
  const writeData = async (id: string) => {
    try {
      const message = 'hello nikunj';
      const buffer = Buffer.from(message, 'utf-8');
      const dataArray = Array.from(buffer);
      await BleManager.write(id, '0180', 'dead', dataArray);
      console.log('Data written successfully');
    } catch (error) {
      console.error('Error writing data:', error);
    }
  };

  // Retrieve services and characteristics of the device
  const retrieveServices = async (id: string) => {
    try {
      const peripheralInfo: any = await BleManager.retrieveServices(id);
      const serviceUUID = peripheralInfo.characteristics.map((char: any) => char.service);
      console.log('Service UUIDs:', serviceUUID);
      const CharUUID = peripheralInfo.characteristics.map((char: any) => char.characteristic);
      console.log('Characteristic UUIDs:', CharUUID);
    } catch (error) {
      console.error('Error retrieving services:', error);
    }
  };

  // Handle image selection
  const handleImage = () => {
    launchImageLibrary({ mediaType: 'photo', includeBase64: true }, (response: any) => {
      if (response.didCancel) {
        console.log('User cancelled image picker');
      } else if (response.errorCode) {
        console.log('ImagePicker Error:', response.errorCode);
      } else {
        setImageUri(response.assets[0].uri);
        setBase64Image(response.assets[0].base64);
      }
    });
  };

  // Send image in chunks to the connected device
  const sendImage = (id: string) => {
    if (devices && base64Image) {
      const chunkSize = 20;
      let index = 0;

      const sendChunk = async () => {
        const chunk = base64Image.substring(index, index + chunkSize);
        index += chunkSize;

        try {
          await BleManager.write(id, '0180', 'dead', [chunk]);
          console.log(`Sent chunk: ${chunk}`);

          if (index < base64Image.length) {
            sendChunk();
          } else {
            console.log('Image transmission complete!');
          }
        } catch (error) {
          console.error('Error sending chunk:', error);
        }
      };

      sendChunk();
    } else {
      console.log('No device or image selected');
    }
  };

  // Listen for device discovery events
  useEffect(() => {
    const discoverListener = BleManagerEmitter.addListener(
      'BleManagerDiscoverPeripheral',
      handleDiscoverPeripheral
    );

    return () => {
      discoverListener.remove();
    };
  }, []);

  return (
    <View style={styles.container}>
      <Button title="Start Scan" onPress={startScan} />
      <FlatList
        data={devices}
        keyExtractor={(item: any) => item.id}
        renderItem={({ item }) => (
          <View style={styles.device}>
            <Text>Name: {item.name}</Text>
            <Text>ID: {item.id}</Text>
            <Button
              title={connectedDeviceId === item.id ? 'Disconnect' : 'Connect'}
              onPress={() => (connectedDeviceId === item.id ? disconnectDevice() : connectToDevice(item.id))}
            />
            {connectedDeviceId === item.id && (
              <>
                <Button title="Send Data" onPress={() => writeData(item.id)} />
                <Button title="Read" onPress={() => readData(item.id)} />
                <Button title="Retrieve Services" onPress={() => retrieveServices(item.id)} />
                <Button title="Choose Image" onPress={handleImage} />
                {imageUri && <Image source={{ uri: imageUri }} style={{ width: 200, height: 200 }} />}
                <Button title="Send Image" onPress={() => sendImage(item.id)} />
              </>
            )}
          </View>
        )}
        ListEmptyComponent={<Text>No devices found</Text>}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
  },
  device: {
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#ccc',
  },
});

export default BleDeviceList;

import React, { useState, useEffect } from 'react';
import { Text, View, StyleSheet, Button, Linking, Alert, ActivityIndicator } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { BarCodeScanner } from 'expo-barcode-scanner';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';

export default function QrScannerScreen() {
    const [permission, requestPermission] = useCameraPermissions();
    const [scanned, setScanned] = useState(false);
    const router = useRouter();
    const insets = useSafeAreaInsets();

    const { returnRoute } = useLocalSearchParams();

    useEffect(() => {
        if (permission && !permission.granted && permission.canAskAgain) {
            requestPermission();
        }
    }, [permission]);

    const handleBarCodeScanned = ({ type, data }) => {
        if (scanned) { return; }
        if (String(type).toLowerCase() === 'qr') {
            setScanned(true);
            Toast.show({type: 'success', text1: 'QR Code Scanned!', text2: 'Processing...'})

            const targetPath = typeof returnRoute === 'string' ? returnRoute : '/(tabs)';

            router.replace({
                pathname: targetPath,
                params: { qrData: data } 
            });

        } else {
             Alert.alert('Wrong Code Type', `Scanned a code of type "${type}", not a QR code.`);
             setTimeout(() => setScanned(false), 2000);
        }
    };

    if (!permission) {
        return (
            <View style={styles.container}>
                <ActivityIndicator size="large" color="white"/>
                <Text style={styles.infoText}>Loading camera...</Text>
            </View>
        );
    }

    if (!permission.granted) {
        return (
            <View style={[styles.container, { paddingTop: insets.top, paddingHorizontal: 20 }]}>
                <Text style={styles.infoText}>Camera permission is required to scan QR codes.</Text>
                {permission.canAskAgain ? (
                    <Button onPress={requestPermission} title="Grant Permission" />
                ) : (
                    <Button title="Open Settings" onPress={() => Linking.openSettings()} />
                )}
                 <View style={{marginTop: 15}}/>
                <Button title="Cancel" onPress={() => router.back()} />
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <CameraView
                style={StyleSheet.absoluteFillObject}
                barcodeScannerSettings={{
                    barCodeTypes: [BarCodeScanner.Constants.BarCodeType.qr],
                }}
                onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
                facing='back'>
                <View style={[styles.overlayTop, { paddingTop: insets.top + 10 }]}>
                    <Text style={styles.overlayText}>Scan Machine QR Code</Text>
                </View>
                 <View style={[styles.overlayBottom, { paddingBottom: insets.bottom + 10 }]}>
                     <Button title={'Cancel Scan'} onPress={() => router.back()} />
                 </View>
            </CameraView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'black' },
    infoText: { fontSize: 18, textAlign: 'center', color: 'white', padding: 20, marginBottom: 10 },
    overlayTop: { position: 'absolute', top: 0, left: 0, right: 0, alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.5)', padding: 15 },
    overlayBottom: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 20, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center' },
    overlayText: { color: 'white', fontSize: 18, fontWeight: 'bold' },
});
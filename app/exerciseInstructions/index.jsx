import React, { useState, useEffect } from 'react';
import { View, Text, Button, StyleSheet, ActivityIndicator, Alert, AppState } from 'react-native';
import { Stack, useRouter, useLocalSearchParams } from 'expo-router';
import NfcManager, { NfcTech } from 'react-native-nfc-manager';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext';
import Toast from 'react-native-toast-message';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import SegmentedControl from '@react-native-segmented-control/segmented-control';
import * as WebBrowser from 'expo-web-browser';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL;

export default function ExerciseInstructionsScreen() {
    const { token } = useAuth();
    const insets = useSafeAreaInsets();
    const router = useRouter();
    const params = useLocalSearchParams();

    const [scanMode, setScanMode] = useState('NFC');
    const [nfcSupported, setNfcSupported] = useState(true);
    const [isNfcEnabled, setIsNfcEnabled] = useState(true);
    const [isScanning, setIsScanning] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        const checkNfc = async () => {
            try {
                const supported = await NfcManager.isSupported();
                setNfcSupported(supported);
                if (supported) {
                    await NfcManager.start();
                    const enabled = await NfcManager.isEnabled();
                    setIsNfcEnabled(enabled);
                }
            } catch (nfcError) { console.error("NFC check/start error:", nfcError); setNfcSupported(false); }
        };
        checkNfc();
        const handleAppStateChange = (nextAppState) => {
            if (nextAppState === 'active') { checkNfc(); }
        };
        const appStateSubscription = AppState.addEventListener('change', handleAppStateChange);
        return () => { appStateSubscription.remove(); };
    }, []);

    useEffect(() => {
        if (params?.qrData) {
            const qrCodeId = String(params.qrData);
            console.log(`[InstructionsScreen] Received QR Data: ${qrCodeId}`);
            fetchAndOpenInstructions(qrCodeId);
        }
    }, [params?.qrData]);

    const fetchAndOpenInstructions = async (tagId) => {
        if (!tagId) { setError('No Tag ID provided.'); return; }
        if (!token) { setError('Please login.'); return; }

        setIsLoading(true);
        setError('');

        try {
            const response = await axios.get(`${API_BASE_URL}/api/machines/byTag/${tagId}`, {
                headers: { Authorization: `Bearer ${token}` },
                validateStatus: status => (status >= 200 && status < 300) || status === 404,
            });

            if (response.status === 404) {
                const msg = 'This Tag/QR is not registered to any machine.';
                setError(msg);
                Alert.alert('Not Found', msg);
            } else if (response.status >= 200 && response.status < 300) {
                const link = response.data?.instructionsLink;
                console.log('[InstructionsScreen] Found machine, link:', link);
                if (link && (link.startsWith('http://') || link.startsWith('https://'))) {
                    await WebBrowser.openBrowserAsync(link);
                    Toast.show({ type: 'success', text1: 'Opening Instructions...' });
                } else {
                    const msg = 'Machine found, but no instruction link is available.';
                    setError(msg);
                    Alert.alert('No Link', msg);
                }
            } else {
                const msg = `Received unexpected status: ${response.status}`;
                setError(msg);
                Alert.alert('Error', msg);
            }
        } catch (err) {
            let userFriendlyError = 'Could not connect to server or server error occurred.';
            setError(userFriendlyError);
            Alert.alert('Error', userFriendlyError);
        } finally {
            setIsLoading(false);
        }
    };

    const handleNfcScanLogic = async () => {
        if (isScanning || !nfcSupported || !isNfcEnabled) { return; }
        setIsScanning(true); setError('');
        try {
            await NfcManager.requestTechnology(NfcTech.Ndef);
            const tag = await NfcManager.getTag();
            if (tag?.id) {
                const tagId = tag.id;
                Toast.show({ type: 'info', text1: 'NFC Detected', text2: `ID: ${tagId}` });
                await fetchAndOpenInstructions(tagId);
            } else {
                setError('Tag scanned, but could not read ID.');
                Alert.alert('Scan Error', 'Could not read a valid ID.');
            }
        } catch (ex) {
            console.warn('NFC Scan Error:', ex);
            let errorMsg = 'NFC Scan failed or cancelled.';
            if (ex?.message?.includes('cancelled')) errorMsg = 'NFC Scan Cancelled.';
            if (ex?.message?.includes('timeout')) { errorMsg = 'NFC Scan Timed Out.'; Alert.alert('Scan Timeout', '...'); }
            setError(errorMsg);
        } finally {
            setIsScanning(false);
            NfcManager.cancelTechnologyRequest().catch(() => { });
        }
    };

    const handleQrScanLogic = () => {
        router.push({
            pathname: '/QRScanner',
            params: {
                returnRoute: '/exerciseInstructions'
            }
        });
    }

    const handleUniversalScanPress = () => {
        setError('');
        if (scanMode === 'NFC') {
            handleNfcScanLogic();
        } else {
            handleQrScanLogic();
        }
    };

    return (
        <View style={[styles.outerContainer, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
            <Stack.Screen options={{ title: 'Scan for Instructions' }} />

            <View style={styles.contentContainer}>
                <Text style={styles.title}>Scan Tag or QR</Text>
                <Text style={styles.instructions}>
                    Select the scan mode below, then press Scan.
                </Text>

                <View style={styles.section}>
                    {!nfcSupported && scanMode === 'NFC' && <Text style={styles.errorText}>NFC is not supported.</Text>}
                    {nfcSupported && !isNfcEnabled && scanMode === 'NFC' && <Text style={styles.errorText}>Please enable NFC.</Text>}

                    <Button
                        title={isScanning ? 'Scanning...' : `Scan using ${scanMode || 'NFC'}`}
                        onPress={handleUniversalScanPress}
                        disabled={isScanning || (scanMode === 'NFC' && (!nfcSupported || !isNfcEnabled))}
                    />
                    {(isScanning || isLoading) && <ActivityIndicator size="large" style={styles.spacerTop} />}
                    {error ? <Text style={styles.errorText}>{error}</Text> : null}
                </View>
            </View>

            <View style={styles.segmentedControlContainer}>
                <SegmentedControl
                    values={['NFC', 'QR']}
                    selectedIndex={scanMode === 'NFC' ? 0 : 1}
                    onChange={(event) => {
                        const selectedIndex = event.nativeEvent.selectedSegmentIndex;
                        const values = ['NFC', 'QR'];
                        if (typeof selectedIndex === 'number' && selectedIndex >= 0 && selectedIndex < values.length) {
                            setScanMode(values[selectedIndex]);
                            setError('');
                        }
                    }}
                    enabled={!isScanning && !isLoading}
                    style={{ opacity: (!isScanning && !isLoading) ? 1 : 0.6 }}
                />
            </View>
            <Toast />
        </View>
    );
}

const styles = StyleSheet.create({
    outerContainer: { flex: 1 },
    contentContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
    title: { fontSize: 24, fontWeight: 'bold', marginBottom: 20, textAlign: 'center' },
    section: { width: '80%', alignItems: 'center', marginBottom: 25, padding: 15 },
    instructions: { textAlign: 'center', marginBottom: 20, fontSize: 16, color: '#555' },
    errorText: { color: 'red', textAlign: 'center', marginVertical: 10, fontSize: 14 },
    spacerTop: { marginTop: 20 },
    segmentedControlContainer: { padding: 15, paddingBottom: 25, backgroundColor: '#f0f0f0', borderTopWidth: 1, borderTopColor: '#ccc' },
});
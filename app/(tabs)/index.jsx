import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TextInput, StyleSheet, ScrollView, ActivityIndicator, Alert, AppState, Pressable } from 'react-native';
import { Stack, useFocusEffect, useRouter, useLocalSearchParams } from 'expo-router';
import NfcManager, { NfcTech } from 'react-native-nfc-manager';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext';
import Toast from 'react-native-toast-message';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import SegmentedControl from '@react-native-segmented-control/segmented-control';
import { MaterialIcons } from '@expo/vector-icons';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL;

const formatTime = (totalSeconds) => {
  if (totalSeconds < 0) totalSeconds = 0;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
};

export default function NfcScanScreen() {
  const auth = useAuth();
  const token = auth?.token;
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams();

  const [scanMode, setScanMode] = useState('NFC');
  const [nfcSupported, setNfcSupported] = useState(true);
  const [isNfcEnabled, setIsNfcEnabled] = useState(true);
  const [isScanning, setIsScanning] = useState(false);
  const [machineData, setMachineData] = useState(null);
  const [currentExerciseInfo, setCurrentExerciseInfo] = useState(null);
  const [reps, setReps] = useState('');
  const [weight, setWeight] = useState('');
  const [elapsedTime, setElapsedTime] = useState(0);
  const timerIntervalRef = useRef(null);
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
    if (currentExerciseInfo?.startTime) {
      const startTimeDate = currentExerciseInfo.startTime instanceof Date
        ? currentExerciseInfo.startTime
        : new Date(currentExerciseInfo.startTime);

      if (!isNaN(startTimeDate.getTime())) {
        const startTimestamp = startTimeDate.getTime();
        if (timerIntervalRef.current) { clearInterval(timerIntervalRef.current); }
        timerIntervalRef.current = setInterval(() => {
          setElapsedTime(Math.floor((Date.now() - startTimestamp) / 1000));
        }, 1000);
      } else { console.error("Timer Error: Invalid startTime", currentExerciseInfo.startTime); }
    } else {
      if (timerIntervalRef.current) { clearInterval(timerIntervalRef.current); timerIntervalRef.current = null; }
      setElapsedTime(0);
    }
    return () => { if (timerIntervalRef.current) { clearInterval(timerIntervalRef.current); } };
  }, [currentExerciseInfo?.startTime]);

  useEffect(() => {
    if (params?.qrData) {
      const qrCodeId = String(params.qrData);
      fetchMachineData(qrCodeId);
    }
  }, [params?.qrData]);

  const handleNfcScanLogic = async () => {
    if (isScanning || !nfcSupported || !isNfcEnabled) { return; }
    setIsScanning(true); setMachineData(null); setCurrentExerciseInfo(null); setError('');
    try {
      await NfcManager.requestTechnology(NfcTech.Ndef);
      const tag = await NfcManager.getTag();
      if (tag?.id) {
        const tagId = tag.id;
        Toast.show({ type: 'info', text1: 'NFC Detected', text2: `ID: ${tagId}` });
        await fetchMachineData(tagId);
      } else {
        setError('Tag scanned, but could not read ID.');
        Alert.alert('Scan Error', 'Could not read a valid ID.');
      }
    } catch (ex) {
      let errorMsg = 'NFC Scan failed or cancelled.';
      if (ex?.message?.includes('cancelled')) errorMsg = 'NFC Scan Cancelled.';
      if (ex?.message?.includes('timeout')) { errorMsg = 'NFC Scan Timed Out.'; Alert.alert('Scan Timeout', 'No NFC tag detected in time.'); }
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
        returnRoute: '/(tabs)'
      }
    });
  };

  const handleUniversalScanPress = () => {
    if (scanMode === 'NFC') {
      handleNfcScanLogic();
    } else {
      handleQrScanLogic();
    }
  };

  const fetchMachineData = async (tagId) => {
    if (!token) { setError('Please login.'); return; }
    setIsLoading(true); setError(''); setMachineData(null);
    try {
      const response = await axios.get(`${API_BASE_URL}/api/machines/byTag/${tagId}`, {
        headers: { Authorization: `Bearer ${token}` },
        validateStatus: status => (status >= 200 && status < 300) || status === 404,
      });

      if (response.status === 404) {
        Alert.alert('Error', userFriendlyError);
        setMachineData(null);
      } else if (response.status >= 200 && response.status < 300) {
        setMachineData(response.data);
        setCurrentExerciseInfo(null);
      } else {
        Alert.alert('Error', userFriendlyError);
        setMachineData(null);
      }
    } catch (err) {
      let error = 'Tag not registered or server error.';
      setError(error);
      Alert.alert('Scan unsuccesfull', error);
      setMachineData(null);
    } finally {
      setIsLoading(false);
    }
  };

  const handleStartExercise = async () => {
    if (!machineData?._id || !token) return;
    setIsLoading(true); setError('');
    try {
      const startTime = new Date();
      const localDateString = startTime.toLocaleDateString('lt-LT');

      const response = await axios.post(`${API_BASE_URL}/api/workouts/startExercise`,
        { machineId: machineData._id, startTime: startTime.toISOString(), localDateString: localDateString },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setCurrentExerciseInfo({
        workoutId: response.data.workoutId,
        exerciseIndex: response.data.exerciseIndex,
        startTime: startTime
      });
      setReps(''); setWeight('');
    } catch (err) {
      let errorMsg = 'Failed to start exercise.';
      setError(errorMsg);
      Alert.alert('Error', errorMsg); setCurrentExerciseInfo(null);
    } finally { setIsLoading(false); }
  };

  const handleEndExercise = async () => {
    if (!currentExerciseInfo?.workoutId || !token) return;
    setIsLoading(true); setError('');
    try {
      const endTime = new Date();
      const durationSeconds = elapsedTime;
      const parsedReps = reps ? parseInt(reps, 10) : undefined;
      const parsedWeight = weight ? parseFloat(weight) : undefined;

      const updateData = {
        endTime: endTime.toISOString(),
        durationSeconds: durationSeconds,
        ...(Number.isInteger(parsedReps) && parsedReps >= 0 && { repetitions: parsedReps }),
        ...(Number.isFinite(parsedWeight) && parsedWeight >= 0 && { weight: parsedWeight }),
      };

      const url = `${API_BASE_URL}/api/workouts/${currentExerciseInfo.workoutId}/endExercise/${currentExerciseInfo.exerciseIndex}`;
      await axios.put(url, updateData, { headers: { Authorization: `Bearer ${token}` } });

      Toast.show({ type: 'success', text1: 'Exercise Ended!', text2: `${machineData?.exerciseName ?? 'Exercise'} recorded.` });
      setCurrentExerciseInfo(null);
      setMachineData(null);
      setReps('');
      setWeight('');
    } catch (err) {
      let errorMsg = 'Failed to end exercise.';
      setError(errorMsg);
      Alert.alert('Error', errorMsg);
    } finally { setIsLoading(false); }
  };

  const renderContent = () => {
    if (currentExerciseInfo && machineData) {
      return (
        <View style={styles.section}>
          <Text style={styles.exerciseTitle}>Current Exercise:</Text>
          <Text style={styles.exerciseDetail}>{machineData.exerciseName ?? 'Unknown Exercise'}</Text>
          <Text style={styles.timerText}>{formatTime(elapsedTime)}</Text>
          <Text style={styles.label}>Reps (Optional):</Text>
          <TextInput style={styles.input} value={reps} onChangeText={setReps} keyboardType="numeric" placeholder="e.g., 10" />
          <Text style={styles.label}>Weight (Optional, e.g., kg):</Text>
          <TextInput style={styles.input} value={weight} onChangeText={setWeight} keyboardType="numeric" placeholder="e.g., 50.5" />
          <Pressable
            style={({ pressed }) => [styles.button, styles.endButton, (isLoading || pressed) && styles.buttonDisabled]}
            onPress={handleEndExercise}
            disabled={isLoading}
          >
            <MaterialIcons name="stop-circle" size={20} color="#fff" />
            <Text style={styles.buttonText}>End Exercise</Text>
          </Pressable>
        </View>
      );
    }

    if (machineData) {
      return (
        <View style={styles.section}>
          <Text style={styles.machineTitle}>Machine Found:</Text>
          <Text style={styles.machineDetail}>Name: {machineData.exerciseName}</Text>
          <Text style={styles.machineDetail}>Type: {machineData.exerciseType}</Text>
          <Text style={styles.machineDetail}>Muscle: {machineData.trainedMuscle}</Text>
          <View style={styles.spacerTop}>
            <Pressable
              style={({ pressed }) => [styles.button, styles.startButton, (isLoading || pressed) && styles.buttonDisabled]}
              onPress={handleStartExercise}
              disabled={isLoading}
            >
              <MaterialIcons name="play-circle-outline" size={22} color="#fff" />
              <Text style={styles.buttonText}>Start Exercise</Text>
            </Pressable>
          </View>
          <View style={styles.spacerTop}>
            <Pressable
              style={({ pressed }) => [styles.button, styles.altButton, (isLoading || pressed) && styles.buttonDisabled]}
              onPress={() => { setMachineData(null); setError(''); }}
              disabled={isLoading}
            >
              <MaterialIcons name="find-replace" size={20} color="#fff" />
              <Text style={styles.buttonText}>Scan Different Tag</Text>
            </Pressable>
          </View>
        </View>
      );
    }

    return (
      <View style={styles.section}>
        <Text style={styles.instructions}>
          {scanMode === 'NFC'
            ? 'Please select scanning mode below. Press Scan and hold your device near an NFC tag on a gym equipment.'
            : 'Please select scanning mode below. Press Scan to open camera and scan a QR code.'}
        </Text>
        {!nfcSupported && scanMode === 'NFC' && <Text style={styles.errorText}>NFC is not supported.</Text>}
        {nfcSupported && !isNfcEnabled && scanMode === 'NFC' && <Text style={styles.errorText}>Please enable NFC.</Text>}
        <Pressable
          style={({ pressed }) => [styles.button, styles.scanButton, (isScanning || (scanMode === 'NFC' && (!nfcSupported || !isNfcEnabled)) || pressed) && styles.buttonDisabled]}
          onPress={handleUniversalScanPress}
          disabled={isScanning || (scanMode === 'NFC' && (!nfcSupported || !isNfcEnabled))}
        >

          {scanMode === 'NFC' ?
            <MaterialIcons name="nfc" size={22} color="#fff" /> :
            <MaterialIcons name="qr-code-scanner" size={22} color="#fff" />
          }
          <Text style={styles.buttonText}>
            {isScanning ? 'Scanning...' : `Scan using ${scanMode || 'NFC'}`}
          </Text>
        </Pressable>
        {isScanning && <ActivityIndicator style={styles.spacerTop} />}
      </View>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: styles.scrollView.backgroundColor }}>
      <ScrollView style={styles.scrollView} contentContainerStyle={[styles.container, { paddingTop: insets.top + 10 }]}>
        <Stack.Screen options={{ title: 'Scan' }} />
        <Text style={styles.title}>Scan and log your progress!</Text>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}
        {isLoading && <ActivityIndicator size="large" style={styles.spacerTop} />}

        {renderContent()}
      </ScrollView>

      <View style={[styles.segmentedControlContainer, { paddingBottom: insets.bottom || 10 }]}>
        <SegmentedControl
          values={['NFC', 'QR']}
          selectedIndex={scanMode === 'NFC' ? 0 : 1}
          onChange={(event) => {
            const selectedIndex = event.nativeEvent.selectedSegmentIndex;
            const values = ['NFC', 'QR'];
            if (typeof selectedIndex === 'number' && selectedIndex >= 0 && selectedIndex < values.length) {
              const newMode = values[selectedIndex];
              setScanMode(newMode);
              setError('');
              setMachineData(null);
              setCurrentExerciseInfo(null);
            } else {
              const receivedValue = event.nativeEvent.selectedSegmentValue;
            }
          }}
          enabled={!machineData && !currentExerciseInfo}
        />
      </View>
      <Toast />
    </View>
  );
}

const styles = StyleSheet.create({
  scrollView: { flex: 1 },
  container: { alignItems: 'center', paddingHorizontal: 16, paddingBottom: 90 },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 20, marginTop: 25, textAlign: 'center' },
  section: { width: '90%', alignItems: 'center', marginBottom: 25, padding: 15, borderWidth: 1, borderColor: '#eee', borderRadius: 8 },
  instructions: { textAlign: 'center', marginBottom: 15, fontSize: 16, color: '#555' },
  label: { fontSize: 16, fontWeight: '500', marginTop: 10, marginBottom: 5, width: '85%', alignSelf: 'center' },
  input: { height: 45, borderColor: '#ccc', borderWidth: 1, marginBottom: 15, paddingHorizontal: 15, borderRadius: 8, fontSize: 16, backgroundColor: '#f9f9f9', width: '85%', alignSelf: 'center' },
  errorText: { color: 'red', textAlign: 'center', marginVertical: 10, fontSize: 14 },
  spacerTop: { marginTop: 10 },
  machineTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 10 },
  machineDetail: { fontSize: 16, marginBottom: 5 },
  linkText: { fontSize: 16, color: 'blue', textDecorationLine: 'underline', marginBottom: 5 },
  exerciseTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 5 },
  exerciseDetail: { fontSize: 16, marginBottom: 10, fontStyle: 'italic' },
  timerText: { fontSize: 48, fontWeight: 'bold', textAlign: 'center', marginVertical: 20, color: '#333' },
  segmentedControlContainer: { padding: 15, backgroundColor: '#f0f0f0', borderTopWidth: 1, borderTopColor: '#ccc', },
  button: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, paddingHorizontal: 20, borderRadius: 8, marginVertical: 5, width: '85%', alignSelf: 'center', elevation: 2, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.2, shadowRadius: 2, },
  buttonText: { color: 'white', fontSize: 16, fontWeight: '500', marginLeft: 10, textAlign: 'center', },
  buttonDisabled: { opacity: 0.5, },
  scanButton: { backgroundColor: '#007AFF', },
  startButton: { backgroundColor: '#34C759', },
  endButton: { backgroundColor: '#dc3545', },
  altButton: { backgroundColor: '#8E8E93', },
});
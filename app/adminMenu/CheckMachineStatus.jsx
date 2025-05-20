import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, SafeAreaView, RefreshControl, Dimensions } from 'react-native';
import { Stack, useFocusEffect } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import axios from 'axios';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Picker } from '@react-native-picker/picker';
import { BarChart } from "react-native-chart-kit";

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL;
const screenWidth = Dimensions.get("window").width;

export default function CheckMachineStatus() {
  const { token, user } = useAuth();
  const insets = useSafeAreaInsets();

  const [allGyms, setAllGyms] = useState([]);
  const [selectedGymId, setSelectedGymId] = useState(user?.activeGymId || '');
  const [machinesInGym, setMachinesInGym] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchAllGyms = useCallback(async () => {
    if (!token) return;
    setIsLoading(true);
    setError('');
    try {
      const response = await axios.get(`${API_BASE_URL}/api/gyms`, { headers: { Authorization: `Bearer ${token}` } });
      const fetchedGyms = response.data || [];
      setAllGyms(fetchedGyms);

      if (!selectedGymId && fetchedGyms.length > 0) {
        setSelectedGymId(fetchedGyms[0]._id);
      }
      else if (fetchedGyms.length === 0) {
        setSelectedGymId('');
        setMachinesInGym([]);
      }
    } catch (err) {
      setError("Could not load list of gyms.");
      setAllGyms([]);
      setMachinesInGym([]);
      setSelectedGymId('');
    }
  }, [token, selectedGymId]);

  const fetchMachines = useCallback(async (isRefresh = false) => {
    if (!token || !selectedGymId) {
      setMachinesInGym([]);
      setIsLoading(false);
      return;
    }
    if (!isRefresh) setIsLoading(true);
    setError('');
    try {
      const response = await axios.get(`${API_BASE_URL}/api/machines`, {
        headers: { Authorization: `Bearer ${token}` }, params: { gymId: selectedGymId }
      });
      setMachinesInGym(response.data || []);
    } catch (err) {
      setError("Could not load machines for this gym.");
      setMachinesInGym([]);
    } finally {
      if (!isRefresh) setIsLoading(false);
    }
  }, [token, selectedGymId]);

  useFocusEffect(
    useCallback(() => {
      fetchAllGyms();
    }, [fetchAllGyms])
  );

  useEffect(() => {
    if (selectedGymId) {
      fetchMachines();
    } else {
      setMachinesInGym([]);
    }
  }, [selectedGymId, fetchMachines]);

  const usageChartData = useMemo(() => {
    if (!machinesInGym || machinesInGym.length === 0) return { labels: [], datasets: [{ data: [] }] };
    const topMachines = machinesInGym.sort((a, b) => (b.scanCount || 0) - (a.scanCount || 0)).slice(0, 7);
    return {
      labels: topMachines.map(m => m.exerciseName.substring(0, 10) + (m.exerciseName.length > 10 ? '...' : '')),
      datasets: [{ data: topMachines.map(m => m.scanCount || 0) }]
    };
  }, [machinesInGym]);

  const onRefresh = useCallback(async () => {
    setIsRefreshing(true);
    setError('');
    await fetchMachines(true);
    setIsRefreshing(false);
  }, [fetchMachines]);

  const chartConfig = {
    backgroundColor: "#f8f8f8", backgroundGradientFrom: "#f8f8f8", backgroundGradientTo: "#f8f8f8",
    decimalPlaces: 0, color: (opacity = 1) => `rgba(0, 122, 255, ${opacity})`,
    labelColor: (opacity = 1) => `rgba(50, 50, 50, ${opacity})`, style: { borderRadius: 8 },
    propsForLabels: { fontSize: 10 }
  };

  const renderMachineItem = ({ item }) => (
    <View style={styles.listItem}>
      <View style={styles.itemTextContainer}>
        <Text style={styles.itemName}>{item.exerciseName}</Text>
        <Text style={styles.itemDetail}>Type: {item.exerciseType} | Muscle: {item.trainedMuscle}</Text>
      </View>
      <Text style={styles.scanCount}>{item.scanCount || 0}</Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <Stack.Screen options={{ title: 'Machine Status & Usage' }} />

      <FlatList
        ListHeaderComponent={
          <>
            <Text style={styles.title}>Machine Status & Usage</Text>
            <View style={styles.filterContainer}>
              <Text style={styles.label}>Select Gym:</Text>
              <View style={styles.pickerContainer}>
                <Picker selectedValue={selectedGymId} onValueChange={setSelectedGymId} style={styles.picker} enabled={allGyms.length > 0 && !isLoading}>
                  <Picker.Item label="Select Gym" value="" />
                  {allGyms.map(gym => <Picker.Item key={gym._id} label={gym.name} value={gym._id} />)}
                </Picker>
              </View>
            </View>
            {isLoading && <ActivityIndicator size="large" style={styles.loader} />}
            {error && !isLoading && <Text style={styles.errorText}>{error}</Text>}
            {selectedGymId && !isLoading && !error && <Text style={styles.sectionTitle}>Machines at Selected Gym</Text>}
          </>
        }
        data={machinesInGym}
        renderItem={renderMachineItem}
        keyExtractor={(item) => item._id}
        ListEmptyComponent={
          !isLoading && !error && selectedGymId ? (<Text style={styles.infoText}>No machines registered for this gym.</Text>) :
            !isLoading && !error && !selectedGymId && allGyms.length > 0 ? (<Text style={styles.infoText}>Please select a gym.</Text>) :
              !isLoading && !error && allGyms.length === 0 ? (<Text style={styles.infoText}>No gyms found.</Text>) : null
        }
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />}
        contentContainerStyle={{ paddingBottom: 20 }}

        ListFooterComponent={
          !isLoading && !error && machinesInGym.length > 0 ? (
            <View style={styles.chartSection}>
              <Text style={styles.sectionTitle}>7 Most Used Machines</Text>
              {usageChartData.datasets[0].data.length > 0 ? (
                <BarChart data={usageChartData} width={screenWidth - 40} height={420}
                  yAxisLabel="" yAxisSuffix="" chartConfig={chartConfig} verticalLabelRotation={90}
                  fromZero={true} showValuesOnTopOfBars={true}
                  style={{ borderRadius: 8, paddingRight: 30 }}
                />
              ) : (<Text style={styles.infoText}>Not enough usage data for chart.</Text>)}
            </View>
          ) : null
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  container: { padding: 15 },
  title: { fontSize: 22, fontWeight: 'bold', marginVertical: 15, marginTop: 45, textAlign: 'center' },
  filterContainer: { paddingHorizontal: 10, marginBottom: 15 },
  label: { fontSize: 16, fontWeight: '500', marginBottom: 5 },
  pickerContainer: { height: 50, justifyContent: 'center', borderColor: '#ccc', borderWidth: 1, borderRadius: 8, backgroundColor: '#fff', marginBottom: 10 },
  picker: { height: 50 },
  loader: { marginVertical: 30 },
  errorText: { color: 'red', textAlign: 'center', marginVertical: 10, fontSize: 14, paddingHorizontal: 20 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', marginTop: 15, marginBottom: 10, paddingHorizontal: 5 },
  listItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 15, borderBottomWidth: 1, borderBottomColor: '#eee', backgroundColor: '#fff', marginHorizontal: 5, borderRadius: 4, marginBottom: 2 },
  itemTextContainer: { flex: 1, marginRight: 10 },
  itemName: { fontSize: 15, fontWeight: '500' },
  itemDetail: { fontSize: 12, color: 'grey', marginTop: 2 },
  scanCount: { fontSize: 16, fontWeight: 'bold', color: '#007AFF' },
  infoText: { textAlign: 'center', fontStyle: 'italic', color: 'grey', paddingVertical: 15, fontSize: 14 },
  chartSection: { marginTop: 25, paddingHorizontal: 0, alignItems: 'center', marginBottom: 30 }
});
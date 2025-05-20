import React, { useState, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, SafeAreaView, Dimensions } from 'react-native';
import { Stack, useFocusEffect } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import axios from 'axios';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';

import { PieChart } from "react-native-chart-kit";

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL;

const WORKOUT_COLORS = {
    Strength: '#d9534f', Cardio: '#0275d8', Flexibility: '#5cb85c',
    Mixed: '#f0ad4e', Other: '#6c757d', default: '#5bc0de'
};

const formatDisplayTime = (dateString) => {
    if (!dateString) return 'N/A';
    try {
        return new Date(dateString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch (e) {
        return 'Invalid Date';
    }
};

const screenWidth = Dimensions.get("window").width;

export default function StatisticsDetailScreen() {
    const { token } = useAuth();
    const insets = useSafeAreaInsets();

    const [statsData, setStatsData] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState('');

    const fetchDetailedStats = useCallback(async () => {
        if (!token) { setIsLoading(false); return; }
        setIsLoading(true);
        setError('');
        try {
            const response = await axios.get(`${API_BASE_URL}/api/statistics/detailed`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            setStatsData(response.data);
        } catch (err) {
            console.error("Failed to fetch detailed stats:", err.response?.data || err.message);
            setError('Could not load detailed statistics.');
            setStatsData(null);
        } finally {
            setIsLoading(false);
        }
    }, [token]);

    useFocusEffect(
        useCallback(() => {
            fetchDetailedStats();
        }, [fetchDetailedStats])
    );

    const pieChartData = useMemo(() => {
        if (!statsData?.typeDistribution) return [];

        const distribution = statsData.typeDistribution;
        const total = Object.values(distribution).reduce((sum, count) => sum + (count || 0), 0);
        if (total === 0) return [];

        return Object.entries(distribution)
            .filter(([key, value]) => value > 0)
            .map(([key, value]) => ({
                name: `${key} (${value})`,
                population: value,
                color: WORKOUT_COLORS[key] || WORKOUT_COLORS.default,
                legendFontColor: "#7F7F7F",
                legendFontSize: 14
            }));

    }, [statsData?.typeDistribution]);

    const chartConfig = {
        backgroundGradientFrom: "#ffffff",
        backgroundGradientFromOpacity: 0,
        backgroundGradientTo: "#ffffff",
        backgroundGradientToOpacity: 0,
        color: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
        strokeWidth: 2,
        barPercentage: 0.5,
        useShadowColorFromDataset: false
    };

    if (isLoading) {
        return <SafeAreaView style={styles.safeArea}><View style={styles.centered}><ActivityIndicator size="large" /></View></SafeAreaView>;
    }
    if (error) {
        return <SafeAreaView style={styles.safeArea}><View style={styles.centered}><Text style={styles.errorText}>{error}</Text></View></SafeAreaView>;
    }
    if (!statsData) {
        return <SafeAreaView style={styles.safeArea}><View style={styles.centered}><Text>No statistics data found for the period.</Text></View></SafeAreaView>;
    }

    return (
        <SafeAreaView style={styles.safeArea}>
            <Stack.Screen options={{ title: 'Detailed Statistics' }} />
            <ScrollView contentContainerStyle={styles.container}>
                <Text style={styles.title}>Stats (Last {statsData.periodDays} Days)</Text>
                <Text style={styles.dateRange}>{statsData.startDate} to {statsData.endDate}</Text>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Workout Types</Text>
                    {pieChartData.length > 0 ? (
                        <View>
                            <PieChart
                                data={pieChartData}
                                width={screenWidth - 60}
                                height={220}
                                chartConfig={chartConfig}
                                accessor={"population"}
                                backgroundColor={"transparent"}
                                paddingLeft={"15"}
                                center={[10, 0]}
                                hasLegend={false}
                                allignItems="center"
                            />
                            <View style={styles.legendContainer}>
                                {pieChartData.map(item => (
                                    <View key={item.name} style={styles.legendItem}>
                                        <View style={[styles.legendColorBox, { backgroundColor: item.color }]} />
                                        <Text style={styles.legendText}>{item.name}</Text>
                                    </View>
                                ))}
                            </View>
                        </View>
                    ) : (
                        <Text style={styles.infoText}>No workout types recorded.</Text>
                    )}
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Personal Records (Max Weight)</Text>
                    {statsData.prs && statsData.prs.length > 0 ? (
                        statsData.prs.map((pr) => (
                            <View key={pr.name} style={styles.prItem}>
                                <Text style={styles.prName}>{pr.name}:</Text>
                                <Text style={styles.prValue}>{pr.maxWeight} {pr.unit} (on {pr.date})</Text>
                            </View>
                        ))
                    ) : (<Text style={styles.infoText}>No strength exercises with weight logged.</Text>)}
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Total sum of weight lifted per muscle group</Text>
                    {statsData.weightByMuscle && Object.keys(statsData.weightByMuscle).length > 0 ? (
                        Object.entries(statsData.weightByMuscle).sort(([, a], [, b]) => b - a).map(([muscle, totalWeight]) => (
                            <View key={muscle} style={styles.muscleItem}>
                                <Text style={styles.muscleName}>{muscle}:</Text>
                                <Text style={styles.muscleValue}>{totalWeight.toFixed(0)} kg </Text>
                            </View>
                        ))
                    ) : (<Text style={styles.infoText}>No weight logged for exercises.</Text>)}
                    <Text style={styles.infoTextSmall}>Note: Sum of the weight field.</Text>
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Average Rest Between Exercises</Text>
                    <Text style={styles.avgRestText}>
                        {statsData.avgRestSeconds > 0 ? `${statsData.avgRestSeconds} seconds` : 'N/A'}
                    </Text>
                    <Text style={styles.infoTextSmall}>Calculated between consecutive exercises. Excludes long breaks.</Text>
                </View>

            </ScrollView>
            <Toast />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safeArea: { flex: 1 },
    container: { padding: 15, paddingBottom: 30 },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    title: { fontSize: 24, fontWeight: 'bold', marginBottom: 5, marginTop: 30, textAlign: 'center' },
    dateRange: { fontSize: 14, color: 'grey', marginBottom: 20, textAlign: 'center' },
    section: { marginBottom: 25, padding: 15, backgroundColor: '#f8f8f8', borderRadius: 8 },
    sectionTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 15 },
    loader: { marginVertical: 30 },
    prItem: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8, paddingBottom: 5, borderBottomWidth: 1, borderBottomColor: '#eee' },
    prName: { fontSize: 15, fontWeight: '500', flexShrink: 1, marginRight: 5 },
    prValue: { fontSize: 15, textAlign: 'right' },
    muscleItem: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 },
    muscleName: { fontSize: 15 },
    muscleValue: { fontSize: 15, fontWeight: '500' },
    avgRestText: { fontSize: 20, fontWeight: 'bold', textAlign: 'center', marginVertical: 10 },
    infoText: { textAlign: 'center', marginTop: 10, color: 'grey', fontSize: 14 },
    infoTextSmall: { textAlign: 'center', marginTop: 5, fontSize: 11, color: 'grey' },
    errorText: { color: 'red', textAlign: 'center', marginVertical: 10, fontSize: 14 },
    legendContainer: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center', marginTop: 15, marginHorizontal: 10 },
    legendItem: { flexDirection: 'row', alignItems: 'center', marginRight: 15, marginBottom: 8 },
    legendColorBox: { width: 14, height: 14, marginRight: 6 },
    legendText: { fontSize: 13, color: '#333' },
});
import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { useFocusEffect } from 'expo-router';

const API_BASE_URL = 'https://sportstracker.icu';

const typeInfo = {
    Strength: { icon: 'fitness-center', color: '#d9534f'},
    Cardio: { icon: 'directions-run', color: '#0275d8'},
    Mixed: { icon: 'shuffle', color: '#f0ad4e'},
    Flexibility: { icon: 'self-improvement', color: '#5cb85c'},
    Other: { icon: 'help-outline', color: '#6c757d'},
    'N/A': { icon: 'help-outline', color: '#6c757d'}
};

export default function StatisticsSummary (){
    const { token } = useAuth();

    const [summaryData, setSummaryData] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState('');

    const fetchStatsSummary = useCallback(async () => {
        if (!token) {
            setIsLoading(false);
            return;
        }
        setIsLoading(true);
        setError('');

        try {
            const response = await axios.get(`${API_BASE_URL}/api/statistics/summary`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setSummaryData(response.data);
        } catch (err) {
            setError('Could not load summary.');
            setSummaryData(null);
        } finally {
            setIsLoading(false);
        }
    }, [token]);

    useFocusEffect(
        useCallback(() => {
          fetchStatsSummary();
        }, [fetchStatsSummary])
      );

    if (isLoading) {
        return (
            <View style={[styles.summaryContainer, styles.centerContent]}>
                <ActivityIndicator size="small" />
            </View>
        );
    }

    if (error) {
        return (
             <View style={[styles.summaryContainer, styles.centerContent]}>
                <Text style={styles.errorText}>{error}</Text>
             </View>
        );
    }

    if (!summaryData) {
         return (
             <View style={[styles.summaryContainer, styles.centerContent]}>
                <Text style={styles.infoText}>No summary data available.</Text>
             </View>
         );
    }

    const weeklyWorkouts = summaryData.workoutsThisWeek ?? 0;
    const weeklyDuration = summaryData.durationThisWeek ?? 0;
    const dominantType = summaryData.dominantTypeLastMonth ?? 'N/A';
    const iconInfo = typeInfo[dominantType] || typeInfo['N/A'];

    return (
        <View style={styles.summaryContainer}>
            <View style={styles.statBox}>
                 <MaterialIcons name="event-repeat" size={24} color="#555" />
                 <Text style={styles.statValue}>{weeklyWorkouts}</Text>
                 <Text style={styles.statLabel}>Workouts This Week</Text>
            </View>
            <View style={styles.statBox}>
                 <MaterialIcons name="timer" size={24} color="#555" />
                 <Text style={styles.statValue}>{weeklyDuration} min</Text>
                 <Text style={styles.statLabel}>Total Time This Week</Text>
            </View>
             <View style={styles.statBox}>
                 <MaterialIcons name={iconInfo.icon} size={24} color={iconInfo.color} />
                 <Text style={[styles.statValue, {color: iconInfo.color}]}>{dominantType}</Text>
                 <Text style={styles.statLabel}>Focus Last 30 Days</Text>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    summaryContainer: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'flex-start', paddingVertical: 15, paddingHorizontal: 5, minHeight: 80 },
    centerContent: { justifyContent: 'center', alignItems: 'center' },
    statBox: { flex: 1, alignItems: 'center', paddingHorizontal: 5 },
    statValue: { fontSize: 20, fontWeight: 'bold', color: '#333', marginTop: 5 },
    statLabel: { fontSize: 12, color: '#666', marginTop: 3, textAlign: 'center' },
    errorText: { color: 'grey', fontSize: 13, textAlign: 'center' },
    infoText: { color: 'grey', fontSize: 13, textAlign: 'center' },
});
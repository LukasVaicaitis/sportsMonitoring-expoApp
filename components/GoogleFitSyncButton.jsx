import React, { useState, useCallback, useEffect } from 'react';
import { Alert, ActivityIndicator, StyleSheet, View, Text, ScrollView } from 'react-native';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import axios from 'axios';

const fetchAggregateData = async (token, dataTypes, startTimeMillis, endTimeMillis) => {
    const aggregateRequestBody = {
        aggregateBy: dataTypes.map(dataTypeName => ({ dataTypeName })),
        startTimeMillis: startTimeMillis,
        endTimeMillis: endTimeMillis,
    };
    const fitAggregateUrl = 'https://www.googleapis.com/fitness/v1/users/me/dataset:aggregate';
    const response = await axios.post(fitAggregateUrl, aggregateRequestBody, {
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
    });
    return response.data;
};

export default function GoogleFitStatsDisplay({ style }) {
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [stats, setStats] = useState({
        stepsToday: null,
        distanceToday: null,
        caloriesToday: null,
        activeMinutesToday: null,
        latestWeight: null,
    });
    const [accessToken, setAccessToken] = useState(null);

    const fetchFitStats = useCallback(async (token) => {
        if (!token) {
            setError("Token missing");
            setIsLoading(false);
            return;
        }
        setIsLoading(true);
        setError(null);

        try {
            const now = new Date();
            const midnight = new Date(now);
            midnight.setHours(0, 0, 0, 0);
            const startTimeMillis = midnight.getTime();
            const endTimeMillis = now.getTime();

            const weightStartTime = new Date(now);
            weightStartTime.setDate(now.getDate() - 90);
            const weightStartTimeMillis = weightStartTime.getTime();

            let dailyData = null;
            let weightData = null;
            let bmrData = null;

            try {
                dailyData = await fetchAggregateData(
                    token,
                    [
                        "com.google.step_count.delta",
                        "com.google.distance.delta",
                        "com.google.calories.expended",
                        "com.google.active_minutes"
                    ],
                    startTimeMillis,
                    endTimeMillis
                );
            } catch (err) {
                setError("Failed to fetch daily stats");
            }

            try {
                weightData = await fetchAggregateData(
                    token,
                    ["com.google.weight"],
                    weightStartTimeMillis,
                    endTimeMillis
                );
            } catch (err) {
                console.warn("Error fetching weight data:", err.message);
            }

            try {
                bmrData = await fetchAggregateData(
                    token,
                    ["com.google.calories.bmr"],
                    startTimeMillis,
                    endTimeMillis
                );
            } catch (err) {
                if (!err.message?.includes("no default datasource found")) {
                    console.warn("Error fetching BMR:", err.message);
                }
                bmrData = null;
            }

            const newStats = {
                stepsToday: null,
                distanceToday: null,
                caloriesToday: 0,
                activeMinutesToday: null,
                latestWeight: null,
            };

            if (dailyData) {
                dailyData.bucket?.[0]?.dataset?.forEach(ds => {
                    const type = ds.dataSourceId?.split(':')[1];
                    const point = ds.point?.[0];
                    const value = point?.value?.[0];
                    if (value) {
                        if (type?.includes('step_count')) newStats.stepsToday = value.intVal;
                        else if (type?.includes('distance')) newStats.distanceToday = value.fpVal;
                        else if (type?.includes('calories.expended')) newStats.caloriesToday += value.fpVal ?? 0;
                        else if (type?.includes('active_minutes')) newStats.activeMinutesToday = value.intVal;
                    }
                });
            }

            if (bmrData) {
                const bmrValue = bmrData.bucket?.[0]?.dataset?.[0]?.point?.[0]?.value?.[0]?.fpVal;
                if (bmrValue) newStats.caloriesToday += bmrValue;
            }

            if (newStats.caloriesToday === 0) newStats.caloriesToday = null;

            if (weightData) {
                const weightDataSet = weightData.bucket?.[0]?.dataset?.[0];
                if (weightDataSet?.point?.length > 0) {
                    const lastPoint = weightDataSet.point[weightDataSet.point.length - 1];
                    const weightVal = lastPoint?.value?.[0]?.fpVal;
                    if (weightVal !== undefined) {
                        newStats.latestWeight = weightVal;
                    }
                }
            }

            setStats(newStats);

        } catch (err) {
            setError(`Failed to fetch user data: ${err.message}`);
        } finally {
            setIsLoading(false);
        }

    }, []);

    useEffect(() => {
        const initialize = async () => {
            setIsLoading(true);
            setError(null);
            let token = null;
            try {
                const currentUser = await GoogleSignin.getCurrentUser();
                if (!currentUser) {
                    setError("Not signed in with Google");
                    setIsLoading(false);
                    return;
                }

                const scopes = currentUser.scopes || [];
                const requiredScopes = [
                    'https://www.googleapis.com/auth/fitness.activity.read',
                    'https://www.googleapis.com/auth/fitness.body.read'
                ];
                const hasScopes = requiredScopes.every(s => scopes.includes(s));

                if (!hasScopes) {
                    setError(`Missing permissions to get user data`);
                    setIsLoading(false);
                    return;
                }

                const tokens = await GoogleSignin.getTokens();
                token = tokens?.accessToken;
                if (!token) throw new Error("Could not get token.");
                setAccessToken(token);
                await fetchFitStats(token);

            } catch (err) {
                if (err.message?.includes("SIGN_IN_REQUIRED")) {
                    setError("Please sign in with Google.");
                } else {
                    setError(`Error: ${err.message}`);
                }
                setIsLoading(false);
            }
        };
        initialize();
    }, [fetchFitStats]);

    const renderStat = (label, value, unit = '') => {
        let displayValue = "";
        if (value !== null && value !== undefined) {
            if (typeof value === 'number') {
                if (['Steps', 'Active Minutes'].includes(label)) {
                    displayValue = Math.round(value).toLocaleString();
                }
                else if (label === 'Distance' && unit === 'm') {
                    displayValue = value > 0 ? `${(value / 1000).toFixed(2)} km` : `0 km`;
                }
                else {
                    if (label === 'Calories Burned') {
                        displayValue = value > 0 ? `${Math.round(value)} ${unit}` : "None";
                    } else {
                        displayValue = `${value.toFixed(1)} ${unit}`;
                    }
                }
            } else {
                displayValue = `${value} ${unit}`;
            }
        }

        return (
            <View style={styles.statRow}>
                <Text style={styles.statLabel}>{label}:</Text>
                <Text style={styles.statValue}>{displayValue}</Text>
            </View>
        );
    };

    if (!isLoading && error && !stats.stepsToday && !stats.latestWeight) {
        return (
            <View style={[styles.container, style]}>
                <Text style={styles.title}>Google Fit Stats</Text>
                <Text style={styles.errorText}>{error}</Text>
            </View>
        );
    }


    return (
        <View style={[styles.container, style]}>
            <Text style={styles.title}>Today's Google Fit Stats</Text>

            {error && !isLoading && <Text style={styles.errorText}>{error}</Text>}
            {isLoading && <ActivityIndicator size="large" color="#007AFF" style={styles.loader} />}

            {!isLoading && (
                <ScrollView contentContainerStyle={styles.statsContainer}>
                    {renderStat("Steps Today", stats.stepsToday)}
                    {renderStat("Distance today", stats.distanceToday, "m")}
                    {renderStat("Calories Burned", stats.caloriesToday, "kcal")}
                    {renderStat("Active Minutes", stats.activeMinutesToday)}
                    {renderStat("Your Weight", stats.latestWeight, "kg")}
                </ScrollView>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: { backgroundColor: '#f0f0f0', borderRadius: 15, padding: 10, margin: 5, shadowColor: "#000000",
        shadowOffset: { height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 2,
        elevation: 4,
        minHeight: 150,
    },
    title: { fontSize: 20, fontWeight: 'bold', marginBottom: 15, textAlign: 'center', color: '#333' },
    statsContainer: { paddingBottom: 10 },
    statRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#e0e0e0' },
    statLabel: { fontSize: 16, color: '#555', fontWeight: '500' },
    statValue: { fontSize: 16, color: '#007AFF', fontWeight: 'bold' },
    errorText: { color: 'red', textAlign: 'center', marginVertical: 10, fontSize: 14 },
    loader: { marginVertical: 20 }
});

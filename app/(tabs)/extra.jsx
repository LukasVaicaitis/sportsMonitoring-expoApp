import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, RefreshControl, ActivityIndicator } from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { useAuth } from '../../context/AuthContext'; 
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import Ionicons from '@expo/vector-icons/Ionicons';
import StatisticsSummary from '../../components/StatisticsSummary';
import GoogleFitSyncButton from '../../components/GoogleFitSyncButton';

export default function ExtraScreen() {
    const router = useRouter();
    const { user, logout, refreshUserProfile } = useAuth();
    const insets = useSafeAreaInsets();

    const [isRefreshing, setIsRefreshing] = useState(false);

    const isAdmin = user?.isAdministrator === true;
    const username = user?.name || 'User';
    const userEmail = user?.email || 'No Email';

    const signedInWithGoogle = user?.provider === 'google';  

    const onRefresh = useCallback(async () => {
        setIsRefreshing(true);
        if (refreshUserProfile) {
            await refreshUserProfile();
        }
        setIsRefreshing(false);
    }, [refreshUserProfile]);

    const handleSignOut = async () => {
        if (logout) {
            await logout();
        }
    };

    return (
        <ScrollView
            style={styles.scrollView}
            contentContainerStyle={[styles.container, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 20 }]}
            refreshControl={
                <RefreshControl
                    refreshing={isRefreshing}
                    onRefresh={onRefresh}
                    tintColor="#888888"
                    colors={["#888888", "#007AFF"]}
                />
            }
        >
            <Stack.Screen options={{ title: 'More', headerShown: false }} />

            <View style={styles.profileContainer}>
                <View style={styles.userInfoRow}>
                    <View style={styles.userInfoColumn}>
                         <Text style={styles.profileLabel}>Username:</Text>
                         <Text style={styles.profileValue} numberOfLines={1} ellipsizeMode="tail">{username}</Text>
                    </View>
                     <View style={styles.userInfoColumn}>
                         <Text style={styles.profileLabel}>Email:</Text>
                         <Text style={styles.profileValue} numberOfLines={1} ellipsizeMode="tail">{userEmail}</Text>
                     </View>
                </View>
            </View>

            <View style={styles.buttonGroup}>
                <Text style={styles.groupTitle}>Activity Summary</Text>
                <StatisticsSummary />

                <Pressable style={[styles.viewMoreButton]} onPress={() => router.push('/statisticsScreen')}>
                    <Ionicons name="stats-chart" size={20} color="#fff" />
                    <Text style={styles.buttonText}>View More Stats</Text>
                </Pressable>
            </View>

            <View style={styles.buttonGroup}>
                <Text style={styles.groupTitle}>Google Fit</Text>
                {signedInWithGoogle ? (
                    <GoogleFitSyncButton style={{ marginBottom: 10 }} />
                ) : (
                     <View style={styles.connectContainer}>
                        <Text style={styles.connectText}>
                            Sign in with Google to connect Google Fit and view your activity information here.
                        </Text>
                     </View>
                )}
            </View>

            <View style={styles.separator} />

            <View style={styles.buttonGroup}>
                <Text style={styles.groupTitle}>Additional functions</Text>
                <Pressable style={styles.button} onPress={() => router.push('/exerciseInstructions')}>
                    <MaterialIcons name="help-outline" size={20} color="#fff" />
                    <Text style={styles.buttonText}>Get Exercise Instructions</Text>
                </Pressable>
            </View>

            {isAdmin && (
                <View style={styles.buttonGroup}>
                    <Text style={styles.groupTitle}>Admin</Text>
                    <Pressable style={[styles.button, styles.adminButton]} onPress={() => router.push('/adminMenu')}>
                        <MaterialIcons name="admin-panel-settings" size={20} color="#fff" />
                        <Text style={styles.buttonText}>Admin Menu</Text>
                    </Pressable>
                </View>
            )}

            <View style={styles.buttonGroup}>
                <Text style={styles.groupTitle}>Account</Text>
                <Pressable style={styles.settingsButton} onPress={() => router.push('/settings')}>
                    <MaterialIcons name="settings" size={20} color="#fff" />
                    <Text style={styles.buttonText}>Profile Settings</Text>
                </Pressable>
                <Pressable style={[styles.button, styles.signOutButton]} onPress={handleSignOut}>
                    <MaterialIcons name="logout" size={20} color="#fff" />
                    <Text style={styles.buttonText}>Sign Out</Text>
                </Pressable>
            </View>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    scrollView: { flex: 1 },
    container: { alignItems: 'stretch', paddingHorizontal: 16 },
    profileContainer: { backgroundColor: '#fff', borderRadius: 10, padding: 10, marginBottom: 20, alignItems: 'center', shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 3, elevation: 3 },
    userInfoRow: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start'},
    userInfoColumn: { flex: 1, paddingHorizontal: 5},
    profileIcon: { marginBottom: 10 },
    profileText: { fontSize: 22, marginBottom: 10, fontWeight: '600', color: '#333' },
    profileDetails: { fontSize: 16, marginBottom: 5, color: '#555' },
    separator: { height: 1, backgroundColor: '#e0e0e0', width: '90%', alignSelf: 'center', marginVertical: 15 },
    buttonGroup: { backgroundColor: '#fff', borderRadius: 10, padding: 15, marginBottom: 20, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 3, elevation: 3 },
    groupTitle: { fontSize: 14, fontWeight: 'bold', color: '#888', marginBottom: 10, textTransform: 'uppercase', marginLeft: 5 },
    button: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#007AFF', paddingVertical: 12, paddingHorizontal: 15, borderRadius: 8, marginBottom: 10, width: '100%', elevation: 2 },
    settingsButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#5856D6', paddingVertical: 12, paddingHorizontal: 15, borderRadius: 8, marginBottom: 10, width: '100%', elevation: 2 },
    buttonText: { color: 'white', fontSize: 16, fontWeight: '500', marginLeft: 10 },
    adminButton: { backgroundColor: '#ff9500'},
    signOutButton: { backgroundColor: '#dc3545'},
    viewMoreButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#5cb85c', paddingVertical: 12, paddingHorizontal: 15, borderRadius: 8, marginBottom: 10, width: '100%', elevation: 2 },
    connectContainer: { alignItems: 'center', paddingVertical: 10},
    connectText: {marginBottom: 10, color: '#555', fontSize: 15}
});
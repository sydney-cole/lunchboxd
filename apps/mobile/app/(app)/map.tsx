import React, { useState } from 'react'
import {
  View,
  Text,
  TextInput,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  SafeAreaView,
  Platform,
} from 'react-native'
import MapView, { Marker, Callout, PROVIDER_GOOGLE } from 'react-native-maps'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@clerk/expo'
import { colors } from '@lunchboxd/shared'

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000'

interface MapPin {
  id: string
  name: string
  lat: string   // Drizzle numeric returns string — MUST parseFloat before use
  lng: string
  reviewedByFollowed: boolean
}

interface ReviewedRestaurant {
  id: string
  name: string
  city: string | null
  address: string | null
  lat: string | null
  lng: string | null
  reviewedByFollowed: boolean
}

export default function MapScreen() {
  const { getToken } = useAuth()
  const [searchQuery, setSearchQuery] = useState('')

  // Map pins (coordinate-bearing restaurants only)
  const { data: mapPins, isLoading: mapLoading } = useQuery<MapPin[]>({
    queryKey: ['restaurants-map'],
    queryFn: async () => {
      const token = await getToken()
      const res = await fetch(`${API_BASE_URL}/api/v1/restaurants/map`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error('Failed to load map data')
      return res.json()
    },
    staleTime: 60_000,
  })

  // List with optional search (all reviewed restaurants, including null lat/lng — D-11)
  const { data: listData, isLoading: listLoading } = useQuery<ReviewedRestaurant[]>({
    queryKey: ['restaurants-reviewed', searchQuery],
    queryFn: async () => {
      const token = await getToken()
      const url = searchQuery.trim()
        ? `${API_BASE_URL}/api/v1/restaurants/reviewed?q=${encodeURIComponent(searchQuery)}`
        : `${API_BASE_URL}/api/v1/restaurants/reviewed`
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error('Failed to load restaurants')
      return res.json()
    },
    staleTime: 30_000,
  })

  return (
    <SafeAreaView style={styles.container}>
      {/* Map (top half of screen) */}
      <View style={styles.mapContainer}>
        {mapLoading && (
          <View style={styles.mapLoader}>
            <ActivityIndicator size="large" color={colors.accent} />
          </View>
        )}
        <MapView
          // Android uses Google Maps; iOS uses Apple Maps by default (no key needed per A3)
          provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
          style={StyleSheet.absoluteFillObject}
          initialRegion={{
            latitude: 40.7128,
            longitude: -74.006,
            latitudeDelta: 0.05,
            longitudeDelta: 0.05,
          }}
        >
          {(mapPins ?? []).map(pin => (
            <Marker
              key={pin.id}
              coordinate={{
                latitude: parseFloat(pin.lat),   // CRITICAL: string → number
                longitude: parseFloat(pin.lng),  // CRITICAL: string → number
              }}
              pinColor={pin.reviewedByFollowed ? '#E85D4A' : '#9CA3AF'}
              tracksViewChanges={false}           // CRITICAL: prevents re-render jank
            >
              <Callout>
                <Text style={calloutStyles.name}>{pin.name}</Text>
              </Callout>
            </Marker>
          ))}
        </MapView>
      </View>

      {/* List panel (bottom half) */}
      <View style={styles.listPanel}>
        <TextInput
          style={styles.searchInput}
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Search by neighborhood or city"
          placeholderTextColor={colors.textSecondary}
        />
        {listLoading && (
          <ActivityIndicator size="small" color={colors.accent} style={{ marginTop: 16 }} />
        )}
        <FlatList
          data={listData ?? []}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <View style={listStyles.row}>
              <View style={listStyles.textCol}>
                <Text style={listStyles.name} numberOfLines={1}>{item.name}</Text>
                {(item.city ?? item.address) ? (
                  <Text style={listStyles.subtitle} numberOfLines={1}>
                    {item.city ?? item.address}
                  </Text>
                ) : null}
              </View>
              {item.reviewedByFollowed && (
                <View style={listStyles.badge}>
                  <Text style={listStyles.badgeText}>Following</Text>
                </View>
              )}
            </View>
          )}
          ListEmptyComponent={
            !listLoading ? (
              <View style={styles.emptyList}>
                <Text style={styles.emptyHeading}>No restaurants found</Text>
                <Text style={styles.emptyBody}>Try a different neighborhood or city name.</Text>
              </View>
            ) : null
          }
        />
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  mapContainer: { flex: 1, position: 'relative' },
  mapLoader: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg, zIndex: 1 },
  listPanel: { flex: 1, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.bg },
  searchInput: {
    margin: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    fontSize: 14,
    color: colors.textPrimary,
    backgroundColor: 'white',
  },
  emptyList: { alignItems: 'center', padding: 24 },
  emptyHeading: { fontSize: 16, fontWeight: '600', color: colors.textPrimary, marginBottom: 4 },
  emptyBody: { fontSize: 14, color: colors.textSecondary, textAlign: 'center' },
})

const listStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  textCol: { flex: 1, minWidth: 0 },
  name: { fontSize: 14, fontWeight: '600', color: colors.textPrimary },
  subtitle: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
  badge: { backgroundColor: `${colors.accent}1A`, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, marginLeft: 8 },
  badgeText: { fontSize: 11, fontWeight: '600', color: colors.accent },
})

const calloutStyles = StyleSheet.create({
  name: { fontSize: 14, fontWeight: '600', color: '#1C1917', padding: 4, minWidth: 80 },
})

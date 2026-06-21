import React, { useEffect, useState } from 'react';
import { View, Text, Button, StyleSheet, AppState } from 'react-native';
import { watchScreenForThreats, isAccessibilityServiceEnabled, openAccessibilitySettings } from './src/AndroidScreenWatcher';

export default function App() {
  const [enabled, setEnabled] = useState(false);
  const [alert, setAlert] = useState<string | null>(null);

  const checkEnabled = () => {
    isAccessibilityServiceEnabled().then(setEnabled);
  };

  useEffect(() => {
    checkEnabled();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') checkEnabled();
    });
    const handle = watchScreenForThreats((result) => {
      setAlert(result.summary);
    });
    return () => {
      subscription.remove();
      handle.unsubscribe();
    };
  }, []);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>LIGHTHOUSE</Text>
        <Text style={styles.subtitle}>CYBERSECURITY</Text>
      </View>

      <View style={[styles.statusBox, enabled ? styles.statusOn : styles.statusOff]}>
        <Text style={styles.statusLabel}>PROTECTION</Text>
        <Text style={styles.statusValue}>{enabled ? 'ACTIVE' : 'INACTIVE'}</Text>
      </View>

      {!enabled && (
        <View style={styles.buttonWrapper}>
          <Button
            title="Enable Protection"
            onPress={openAccessibilitySettings}
            color="#1a7a8a"
          />
          <Text style={styles.hint}>
            Go to Accessibility Settings and enable Lighthouse Screen Protection
          </Text>
        </View>
      )}

      {enabled && !alert && (
        <Text style={styles.safeText}>Monitoring your screen for threats...</Text>
      )}

      {alert && (
        <View style={styles.alertBox}>
          <Text style={styles.alertTitle}>THREAT DETECTED</Text>
          <Text style={styles.alertText}>{alert}</Text>
          <Button title="Dismiss" onPress={() => setAlert(null)} color="#cc0000" />
        </View>
      )}

      <Text style={styles.footer}>Lighthouse Cybersecurity</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f0f4f8',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#0d4f5c',
    letterSpacing: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#1a7a8a',
    letterSpacing: 6,
    marginTop: 4,
  },
  statusBox: {
    width: 200,
    height: 200,
    borderRadius: 100,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 40,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
  },
  statusOn: {
    backgroundColor: '#1a7a8a',
  },
  statusOff: {
    backgroundColor: '#999',
  },
  statusLabel: {
    color: 'white',
    fontSize: 12,
    letterSpacing: 3,
    marginBottom: 8,
  },
  statusValue: {
    color: 'white',
    fontSize: 22,
    fontWeight: 'bold',
    letterSpacing: 2,
  },
  buttonWrapper: {
    alignItems: 'center',
    width: '100%',
  },
  hint: {
    color: '#666',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 12,
    paddingHorizontal: 20,
  },
  safeText: {
    color: '#1a7a8a',
    fontSize: 14,
    letterSpacing: 1,
  },
  alertBox: {
    backgroundColor: '#fff0f0',
    borderLeftWidth: 4,
    borderLeftColor: '#cc0000',
    padding: 20,
    borderRadius: 8,
    width: '100%',
    marginBottom: 20,
  },
  alertTitle: {
    color: '#cc0000',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
    letterSpacing: 2,
  },
  alertText: {
    color: '#333',
    fontSize: 14,
    marginBottom: 16,
    lineHeight: 20,
  },
  footer: {
    position: 'absolute',
    bottom: 24,
    color: '#aaa',
    fontSize: 11,
    letterSpacing: 2,
  },
});